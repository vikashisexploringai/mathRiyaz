// app.js - Main application controller

// ===== APP STATE =====
const AppState = {
    currentUser: null,
    currentView: 'home',
    currentSubject: null,
    currentChapter: null,
    currentSubchapter: null,
    currentLevel: null,
    config: null,
    progress: {}
};

let currentQuizData = null;
let questionTimer = null;
let timeRemaining = 0;
let questionStartTime = 0;
let currentFormatter = null;

// Store temporary verification state
let passwordResetVerified = false;
let passwordResetUsername = null;
let passwordResetEmail = null;
let passwordResetDay = null;
let passwordResetMonth = null;
let passwordResetYear = null;
let quizStartTime = 0;

// ===== FIREBASE CONFIG =====
const firebaseConfig = {
    apiKey: "AIzaSyACO39eJRrdbgowWcqgdp0DFkDPUhbQQfQ",
    authDomain: "database-367af.firebaseapp.com",
    projectId: "database-367af",
    storageBucket: "database-367af.firebasestorage.app",
    messagingSenderId: "246204653332",
    appId: "1:246204653332:web:8daf25ea24112de940ec01"
};

// Initialize Firebase
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

// ===== TOAST NOTIFICATION SYSTEM =====
function showToast(message, type = 'info', duration = 3000) {
    const existingToast = document.querySelector('.toast-notification');
    if (existingToast) existingToast.remove();
    
    const toast = document.createElement('div');
    toast.className = `toast-notification toast-${type}`;
    toast.textContent = message;
    
    document.body.appendChild(toast);
    
    setTimeout(() => toast.classList.add('show'), 10);
    
    setTimeout(() => {
        toast.classList.remove('show');
        setTimeout(() => toast.remove(), 300);
    }, duration);
}

// ===== INLINE MESSAGE HELPER =====
function showInlineMessage(inputId, message, type = 'error') {
    const input = document.getElementById(inputId);
    if (!input) return;
    
    const existingMessage = input.parentElement.querySelector('.inline-message');
    if (existingMessage) existingMessage.remove();
    
    input.classList.add('input-error');
    
    const messageEl = document.createElement('div');
    messageEl.className = `inline-message inline-${type}`;
    messageEl.textContent = message;
    
    input.parentElement.appendChild(messageEl);
    
    input.addEventListener('input', function clearError() {
        input.classList.remove('input-error');
        if (messageEl.parentElement) messageEl.remove();
        input.removeEventListener('input', clearError);
    }, { once: true });
}

function clearInlineMessages() {
    document.querySelectorAll('.inline-message').forEach(el => el.remove());
    document.querySelectorAll('.input-error').forEach(el => el.classList.remove('input-error'));
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    renderLogin();
});

// ===== LOAD CONFIGURATION =====
async function loadConfig() {
    try {
        const response = await fetch('config.json');
        AppState.config = await response.json();
        console.log('Config loaded:', AppState.config);
    } catch (error) {
        console.error('Failed to load config:', error);
        showError('Failed to load app configuration');
    }
}

// ===== AUTH STATE OBSERVER =====
auth.onAuthStateChanged(async (user) => {
    if (user) {
        console.log('User signed in:', user.email);
        AppState.currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
        };
        
        await loadUserProgress(user.uid);
        
        if (['login', 'register', 'forgotUsername', 'forgotPassword', 'resetPassword'].includes(AppState.currentView)) {
            renderHome();
        }
    } else {
        console.log('User signed out');
        AppState.currentUser = null;
        
        if (!['login', 'register', 'forgotUsername', 'forgotPassword', 'resetPassword'].includes(AppState.currentView)) {
            renderLogin();
        }
    }
});

// ===== FORMATTER LOADING =====
async function loadSubjectFormatter(subjectId) {
    try {
        const formatterModule = await import(`./shared/formatters/${subjectId}-formatter.js`);
        currentFormatter = formatterModule.default || formatterModule;
        console.log(`Loaded formatter for ${subjectId}`);
        return currentFormatter;
    } catch (error) {
        console.warn(`No specific formatter for ${subjectId}, using default`);
        currentFormatter = {
            formatQuestion: (text) => text,
            formatOptions: (options) => options,
            formatAnswer: (text) => text
        };
        return currentFormatter;
    }
}

// ===== HELPER FUNCTIONS =====
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}.${Math.floor(minutes/6)} hrs`;
    } else if (minutes > 0) {
        return `${minutes} mins`;
    } else {
        return `${seconds} sec`;
    }
}

function formatDate(timestamp) {
    if (!timestamp) return 'Unknown';
    
    const date = timestamp.toDate();
    const now = new Date();
    const diffDays = Math.floor((now - date) / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) {
        return `Today, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays === 1) {
        return `Yesterday, ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    } else if (diffDays < 7) {
        return `${diffDays} days ago`;
    } else {
        return date.toLocaleDateString();
    }
}

function loadSubjectCSS(subjectId) {
    const existing = document.getElementById('subject-css');
    if (existing) existing.remove();
    
    const link = document.createElement('link');
    link.id = 'subject-css';
    link.rel = 'stylesheet';
    link.href = `${subjectId}.css`;
    document.head.appendChild(link);
}

function updateHeader(title, showBackButton = false, backFunction = null) {
    const header = document.getElementById('app-header');
    if (!header) return;
    
    if (showBackButton) {
        header.innerHTML = `
            <div class="centered-header">
                <button class="header-back-btn" onclick="${backFunction}">‹</button>
                <span class="header-title">${title}</span>
                <div class="header-placeholder"></div>
            </div>
        `;
    } else {
        header.innerHTML = `<h1>${title}</h1>`;
    }
}

function updateBottomNav(activeView) {
    const nav = document.getElementById('bottom-nav');
    if (!nav) return;
    
    if (['login', 'register', 'forgotUsername', 'forgotPassword', 'resetPassword'].includes(activeView)) {
        nav.style.display = 'none';
        return;
    }
    
    nav.style.display = 'flex';
    nav.innerHTML = `
        <button class="nav-item ${activeView === 'home' ? 'active' : ''}" onclick="renderHome()">
            <span class="nav-icon">🏠</span>
            <span>Home</span>
        </button>
        <button class="nav-item ${activeView === 'progress' ? 'active' : ''}" onclick="renderProgress()">
            <span class="nav-icon">📊</span>
            <span>Progress</span>
        </button>
        <button class="nav-item ${activeView === 'profile' ? 'active' : ''}" onclick="renderProfile()">
            <span class="nav-icon">👤</span>
            <span>Profile</span>
        </button>
        <button class="nav-item ${activeView === 'settings' ? 'active' : ''}" onclick="showSettings()">
            <span class="nav-icon">⚙️</span>
            <span>Settings</span>
        </button>
    `;
}

function showError(message) {
    const content = document.getElementById('main-content');
    if (content) {
        content.innerHTML = `
            <div style="text-align: center; padding: 40px; color: #ef4444;">
                <p>${message}</p>
                <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px;">Retry</button>
            </div>
        `;
    }
}

async function loadUserProgress(uid) {
    try {
        const userDoc = await db.collection('users').doc(uid).get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            AppState.progress = userData.progress || {};
            AppState.userDisplayName = userData.displayName;
            console.log('User progress loaded:', AppState.progress);
        }
    } catch (error) {
        console.error('Error loading user progress:', error);
    }
}

// ===== AUTH VIEWS =====
function renderLogin() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'flex';
    
    AppState.currentView = 'login';
    const content = document.getElementById('main-content');
    
    updateHeader('Welcome Back');
    
    const html = `
        <div class="auth-container">
            <div class="auth-card">
                <h2>Login to Math Riyaz</h2>
                
                <div class="form-group">
                    <label for="username">Username</label>
                    <input type="text" id="username" placeholder="Enter your username" class="auth-input">
                </div>
                
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" placeholder="Enter your password" class="auth-input">
                </div>
                
                <div class="form-row">
                    <label class="checkbox-label">
                        <input type="checkbox" id="rememberMe" checked>
                        <span>Remember me</span>
                    </label>
                </div>
                
                <button class="auth-btn" onclick="handleLogin()">Login</button>
                
                <div class="auth-links">
                    <button class="link-btn" onclick="renderForgotUsername()">Forgot Username?</button>
                    <button class="link-btn" onclick="renderForgotPassword()">Forgot Password?</button>
                    <button class="link-btn" onclick="renderRegister()">Create Account</button>
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    updateBottomNav('login');
}

async function handleLogin() {
    const username = document.getElementById('username')?.value;
    const password = document.getElementById('password')?.value;
    const rememberMe = document.getElementById('rememberMe')?.checked;
    
    clearInlineMessages();
    
    if (!username || !password) {
        if (!username) showInlineMessage('username', 'Please enter username');
        if (!password) showInlineMessage('password', 'Please enter password');
        return;
    }
    
    try {
        const loginBtn = document.querySelector('.auth-btn');
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;
        
        const email = `${username}@mathriyaz.local`;
        
        await auth.setPersistence(
            rememberMe ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION
        );
        
        await auth.signInWithEmailAndPassword(email, password);
        showToast('Login successful!', 'success');
        
    } catch (error) {
        console.error('Login error:', error);
        
        if (error.code === 'auth/user-not-found') {
            showInlineMessage('username', 'Username not found');
        } else if (error.code === 'auth/wrong-password') {
            showInlineMessage('password', 'Incorrect password');
        } else if (error.code === 'auth/invalid-email') {
            showInlineMessage('username', 'Invalid username format');
        } else {
            showToast(error.message, 'error');
        }
        
        const loginBtn = document.querySelector('.auth-btn');
        loginBtn.textContent = 'Login';
        loginBtn.disabled = false;
    }
}

function renderRegister() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'flex';
    
    AppState.currentView = 'register';
    const content = document.getElementById('main-content');
    
    updateHeader('Create Account');
    
    const today = new Date();
    const maxYear = today.getFullYear() - 2;
    const minYear = today.getFullYear() - 100;
    
    let yearOptions = '';
    for (let year = maxYear; year >= minYear; year--) {
        yearOptions += `<option value="${year}">${year}</option>`;
    }
    
    let monthOptions = '';
    for (let month = 1; month <= 12; month++) {
        monthOptions += `<option value="${month}">${month}</option>`;
    }
    
    let dayOptions = '';
    for (let day = 1; day <= 31; day++) {
        dayOptions += `<option value="${day}">${day}</option>`;
    }
    
    const html = `
        <div class="auth-container">
            <div class="auth-card">
                <h2>Join Math Riyaz</h2>
                
                <div class="form-group">
                    <label for="fullName">Child's Full Name</label>
                    <input type="text" id="fullName" placeholder="e.g., John Doe" class="auth-input">
                </div>
                
                <div class="form-group">
                    <label for="username">Choose Username</label>
                    <input type="text" id="username" placeholder="e.g., johndoe123" class="auth-input">
                    <small style="color: #64748b; font-size: 12px; margin-top: 4px; display: block;">Letters, numbers, and underscores only</small>
                </div>
                
                <div class="form-group">
                    <label>Date of Birth</label>
                    <div style="display: flex; gap: 8px;">
                        <select id="dobDay" class="auth-input" style="flex: 1;">
                            <option value="">Day</option>
                            ${dayOptions}
                        </select>
                        <select id="dobMonth" class="auth-input" style="flex: 1;">
                            <option value="">Month</option>
                            ${monthOptions}
                        </select>
                        <select id="dobYear" class="auth-input" style="flex: 1;">
                            <option value="">Year</option>
                            ${yearOptions}
                        </select>
                    </div>
                </div>
                
                <div class="form-group">
                    <label for="password">Password</label>
                    <input type="password" id="password" placeholder="At least 6 characters" class="auth-input">
                </div>
                
                <div class="form-group">
                    <label for="confirmPassword">Confirm Password</label>
                    <input type="password" id="confirmPassword" placeholder="Re-enter password" class="auth-input">
                </div>
                
                <div class="form-row">
                    <label class="checkbox-label">
                        <input type="checkbox" id="rememberMe" checked>
                        <span>Remember me</span>
                    </label>
                </div>
                
                <button class="auth-btn" onclick="handleRegister()">Create Account</button>
                
                <div class="auth-links">
                    <button class="link-btn" onclick="renderLogin()">Already have an account? Login</button>
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    updateBottomNav('register');
}

async function handleRegister() {
    const fullName = document.getElementById('fullName')?.value;
    const username = document.getElementById('username')?.value;
    const day = document.getElementById('dobDay')?.value;
    const month = document.getElementById('dobMonth')?.value;
    const year = document.getElementById('dobYear')?.value;
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const rememberMe = document.getElementById('rememberMe')?.checked;
    
    clearInlineMessages();
    let hasError = false;
    
    if (!fullName) { showInlineMessage('fullName', 'Please enter full name'); hasError = true; }
    if (!username) { showInlineMessage('username', 'Please choose a username'); hasError = true; }
    else if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        showInlineMessage('username', 'Username can only contain letters, numbers, and underscores');
        hasError = true;
    }
    
    if (!day || !month || !year) { showInlineMessage('dobDay', 'Please select date of birth'); hasError = true; }
    if (!password) { showInlineMessage('password', 'Please enter password'); hasError = true; }
    else if (password.length < 6) { showInlineMessage('password', 'Password must be at least 6 characters'); hasError = true; }
    
    if (!confirmPassword) { showInlineMessage('confirmPassword', 'Please confirm password'); hasError = true; }
    else if (password !== confirmPassword) { showInlineMessage('confirmPassword', 'Passwords do not match'); hasError = true; }
    
    if (hasError) return;
    
    try {
        const registerBtn = document.querySelector('.auth-btn');
        registerBtn.textContent = 'Checking...';
        registerBtn.disabled = true;
        
        const snapshot = await db.collection('users').where('username', '==', username).get();
        
        if (!snapshot.empty) {
            showInlineMessage('username', 'Username already taken. Please choose another.');
            registerBtn.textContent = 'Create Account';
            registerBtn.disabled = false;
            return;
        }
        
        registerBtn.textContent = 'Creating Account...';
        
        const email = `${username}@mathriyaz.local`;
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        await user.updateProfile({ displayName: fullName });
        
        await auth.setPersistence(
            rememberMe ? firebase.auth.Auth.Persistence.LOCAL : firebase.auth.Auth.Persistence.SESSION
        );
        
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            username: username,
            displayName: fullName,
            email: email,
            dateOfBirth: { day: parseInt(day), month: parseInt(month), year: parseInt(year) },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            overall: { totalPoints: 0, quizzesTaken: 0, totalTimeSpent: 0 }
        });
        
        showToast('Account created successfully!', 'success');
        
    } catch (error) {
        console.error('Registration error:', error);
        
        if (error.code === 'auth/email-already-in-use') {
            showInlineMessage('username', 'Username already taken. Please choose another.');
        } else {
            showToast('Registration failed: ' + error.message, 'error');
        }
        
        const registerBtn = document.querySelector('.auth-btn');
        registerBtn.textContent = 'Create Account';
        registerBtn.disabled = false;
    }
}

function renderForgotUsername() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'flex';
    
    AppState.currentView = 'forgotUsername';
    const content = document.getElementById('main-content');
    
    updateHeader('Find Username');
    
    const today = new Date();
    const maxYear = today.getFullYear() - 2;
    const minYear = today.getFullYear() - 100;
    
    let yearOptions = '';
    for (let year = maxYear; year >= minYear; year--) {
        yearOptions += `<option value="${year}">${year}</option>`;
    }
    
    let monthOptions = '';
    for (let month = 1; month <= 12; month++) {
        monthOptions += `<option value="${month}">${month}</option>`;
    }
    
    let dayOptions = '';
    for (let day = 1; day <= 31; day++) {
        dayOptions += `<option value="${day}">${day}</option>`;
    }
    
    const html = `
        <div class="auth-container">
            <div class="auth-card">
                <h2>Find Your Username</h2>
                <p style="color: #64748b; font-size: 14px; text-align: center; margin-bottom: 24px;">
                    Enter your child's full name and date of birth to retrieve the username.
                </p>
                
                <div class="form-group">
                    <label for="fullName">Child's Full Name</label>
                    <input type="text" id="fullName" placeholder="e.g., John Doe" class="auth-input">
                </div>
                
                <div class="form-group">
                    <label>Date of Birth</label>
                    <div style="display: flex; gap: 8px;">
                        <select id="dobDay" class="auth-input" style="flex: 1;">
                            <option value="">Day</option>
                            ${dayOptions}
                        </select>
                        <select id="dobMonth" class="auth-input" style="flex: 1;">
                            <option value="">Month</option>
                            ${monthOptions}
                        </select>
                        <select id="dobYear" class="auth-input" style="flex: 1;">
                            <option value="">Year</option>
                            ${yearOptions}
                        </select>
                    </div>
                </div>
                
                <button class="auth-btn" onclick="handleFindUsername()">Find Username</button>
                
                <div id="usernameResult" style="display: none; margin: 20px 0; padding: 16px; background: #f0f9ff; border-radius: 12px; text-align: center;">
                    <p style="color: #0369a1; margin-bottom: 4px;">Your username is:</p>
                    <p id="foundUsername" style="font-size: 20px; font-weight: 600; color: #0f172a;"></p>
                </div>
                
                <div class="auth-links">
                    <button class="link-btn" onclick="renderLogin()">Back to Login</button>
                    <button class="link-btn" onclick="renderForgotPassword()">Forgot Password?</button>
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    updateBottomNav('forgotUsername');
}

async function handleFindUsername() {
    const fullName = document.getElementById('fullName')?.value;
    const day = document.getElementById('dobDay')?.value;
    const month = document.getElementById('dobMonth')?.value;
    const year = document.getElementById('dobYear')?.value;
    
    clearInlineMessages();
    
    if (!fullName || !day || !month || !year) {
        if (!fullName) showInlineMessage('fullName', 'Please enter full name');
        if (!day || !month || !year) showInlineMessage('dobDay', 'Please select date of birth');
        return;
    }
    
    try {
        const findBtn = document.querySelector('.auth-btn');
        findBtn.textContent = 'Searching...';
        findBtn.disabled = true;
        
        const snapshot = await db.collection('users')
            .where('displayName', '==', fullName)
            .where('dateOfBirth.day', '==', parseInt(day))
            .where('dateOfBirth.month', '==', parseInt(month))
            .where('dateOfBirth.year', '==', parseInt(year))
            .get();
        
        findBtn.textContent = 'Find Username';
        findBtn.disabled = false;
        
        if (snapshot.empty) {
            showToast('No account found with these details', 'error');
            return;
        }
        
        const userData = snapshot.docs[0].data();
        
        document.getElementById('foundUsername').textContent = userData.username;
        document.getElementById('usernameResult').style.display = 'block';
        showToast('Username found!', 'success');
        
    } catch (error) {
        console.error('Error finding username:', error);
        showToast('An error occurred. Please try again.', 'error');
        
        const findBtn = document.querySelector('.auth-btn');
        findBtn.textContent = 'Find Username';
        findBtn.disabled = false;
    }
}

function renderForgotPassword() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'flex';
    
    AppState.currentView = 'forgotPassword';
    const content = document.getElementById('main-content');
    
    passwordResetVerified = false;
    passwordResetUsername = null;
    
    updateHeader('Reset Password');
    
    const today = new Date();
    const maxYear = today.getFullYear() - 2;
    const minYear = today.getFullYear() - 100;
    
    let yearOptions = '';
    for (let year = maxYear; year >= minYear; year--) {
        yearOptions += `<option value="${year}">${year}</option>`;
    }
    
    let monthOptions = '';
    for (let month = 1; month <= 12; month++) {
        monthOptions += `<option value="${month}">${month}</option>`;
    }
    
    let dayOptions = '';
    for (let day = 1; day <= 31; day++) {
        dayOptions += `<option value="${day}">${day}</option>`;
    }
    
    const html = `
        <div class="auth-container">
            <div class="auth-card">
                <h2>Reset Password</h2>
                <p style="color: #64748b; font-size: 14px; text-align: center; margin-bottom: 24px;">
                    Step 1: Verify your identity
                </p>
                
                <div class="form-group">
                    <label for="resetUsername">Username</label>
                    <input type="text" id="resetUsername" placeholder="Enter your username" class="auth-input">
                </div>
                
                <div class="form-group">
                    <label>Date of Birth</label>
                    <div style="display: flex; gap: 8px;">
                        <select id="resetDobDay" class="auth-input" style="flex: 1;">
                            <option value="">Day</option>
                            ${dayOptions}
                        </select>
                        <select id="resetDobMonth" class="auth-input" style="flex: 1;">
                            <option value="">Month</option>
                            ${monthOptions}
                        </select>
                        <select id="resetDobYear" class="auth-input" style="flex: 1;">
                            <option value="">Year</option>
                            ${yearOptions}
                        </select>
                    </div>
                </div>
                
                <button class="auth-btn" onclick="handleVerifyIdentity()">Verify Identity</button>
                
                <div class="auth-links">
                    <button class="link-btn" onclick="renderLogin()">Back to Login</button>
                    <button class="link-btn" onclick="renderForgotUsername()">Forgot Username?</button>
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    updateBottomNav('forgotPassword');
}

async function handleVerifyIdentity() {
    const username = document.getElementById('resetUsername')?.value;
    const day = document.getElementById('resetDobDay')?.value;
    const month = document.getElementById('resetDobMonth')?.value;
    const year = document.getElementById('resetDobYear')?.value;
    
    clearInlineMessages();
    
    if (!username || !day || !month || !year) {
        if (!username) showInlineMessage('resetUsername', 'Please enter username');
        if (!day || !month || !year) showInlineMessage('resetDobDay', 'Please select date of birth');
        return;
    }
    
    try {
        const verifyBtn = document.querySelector('.auth-btn');
        verifyBtn.textContent = 'Verifying...';
        verifyBtn.disabled = true;
        
        const snapshot = await db.collection('users').where('username', '==', username).get();
        
        if (snapshot.empty) {
            showInlineMessage('resetUsername', 'Username not found');
            verifyBtn.textContent = 'Verify Identity';
            verifyBtn.disabled = false;
            return;
        }
        
        const userData = snapshot.docs[0].data();
        
        if (userData.dateOfBirth.day !== parseInt(day) ||
            userData.dateOfBirth.month !== parseInt(month) ||
            userData.dateOfBirth.year !== parseInt(year)) {
            showInlineMessage('resetDobDay', 'Date of birth does not match');
            verifyBtn.textContent = 'Verify Identity';
            verifyBtn.disabled = false;
            return;
        }
        
        passwordResetVerified = true;
        passwordResetUsername = username;
        passwordResetDay = day;
        passwordResetMonth = month;
        passwordResetYear = year;
        
        renderResetPassword();
        
    } catch (error) {
        console.error('Verification error:', error);
        showToast('Verification failed. Please try again.', 'error');
        
        const verifyBtn = document.querySelector('.auth-btn');
        verifyBtn.textContent = 'Verify Identity';
        verifyBtn.disabled = false;
    }
}

function renderResetPassword() {
    if (!passwordResetVerified) {
        renderForgotPassword();
        return;
    }
    
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'flex';
    
    AppState.currentView = 'resetPassword';
    const content = document.getElementById('main-content');
    
    updateHeader('Reset Password');
    
    const html = `
        <div class="auth-container">
            <div class="auth-card">
                <h2>Reset Password</h2>
                <p style="color: #64748b; font-size: 14px; text-align: center; margin-bottom: 24px;">
                    Step 2: Set new password for <strong>${passwordResetUsername}</strong>
                </p>
                
                <div class="form-group">
                    <label for="newPassword">New Password</label>
                    <input type="password" id="newPassword" placeholder="At least 6 characters" class="auth-input">
                </div>
                
                <div class="form-group">
                    <label for="confirmNewPassword">Confirm New Password</label>
                    <input type="password" id="confirmNewPassword" placeholder="Re-enter new password" class="auth-input">
                </div>
                
                <button class="auth-btn" onclick="handleCloudPasswordReset()">Update Password</button>
                
                <div class="auth-links">
                    <button class="link-btn" onclick="renderForgotPassword()">Start Over</button>
                    <button class="link-btn" onclick="renderLogin()">Back to Login</button>
                </div>
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    updateBottomNav('resetPassword');
}

async function handleCloudPasswordReset() {
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmPassword = document.getElementById('confirmNewPassword')?.value;
    
    clearInlineMessages();
    let hasError = false;
    
    if (!newPassword) { showInlineMessage('newPassword', 'Please enter new password'); hasError = true; }
    else if (newPassword.length < 6) { showInlineMessage('newPassword', 'Password must be at least 6 characters'); hasError = true; }
    
    if (!confirmPassword) { showInlineMessage('confirmNewPassword', 'Please confirm password'); hasError = true; }
    else if (newPassword !== confirmPassword) { showInlineMessage('confirmNewPassword', 'Passwords do not match'); hasError = true; }
    
    if (hasError) return;
    
    try {
        const resetBtn = document.querySelector('.auth-btn');
        resetBtn.textContent = 'Updating...';
        resetBtn.disabled = true;
        
        const response = await fetch('https://us-central1-database-367af.cloudfunctions.net/resetPassword', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                username: passwordResetUsername,
                day: parseInt(passwordResetDay),
                month: parseInt(passwordResetMonth),
                year: parseInt(passwordResetYear),
                newPassword
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            showToast('Password updated successfully! Please login with your new password.', 'success');
            
            passwordResetVerified = false;
            passwordResetUsername = null;
            passwordResetDay = passwordResetMonth = passwordResetYear = null;
            
            renderLogin();
        } else {
            throw new Error(result.error || 'Failed to reset password');
        }
        
    } catch (error) {
        console.error('Password reset error:', error);
        showToast(error.message, 'error');
        
        const resetBtn = document.querySelector('.auth-btn');
        resetBtn.textContent = 'Update Password';
        resetBtn.disabled = false;
    }
}

async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await auth.signOut();
            renderLogin();
            showToast('Logged out successfully', 'success');
        } catch (error) {
            console.error('Logout error:', error);
            showToast('Failed to logout. Please try again.', 'error');
        }
    }
}

// ===== PROFILE PAGE =====
function renderProfile() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'flex';
    
    AppState.currentView = 'profile';
    const content = document.getElementById('main-content');
    
    updateHeader('Profile');
    
    const user = auth.currentUser;
    if (!user) {
        renderLogin();
        return;
    }
    
    db.collection('users').doc(user.uid).get().then(doc => {
        if (!doc.exists) {
            console.error('User document not found');
            return;
        }
        
        const userData = doc.data();
        const displayName = userData.displayName || 'User';
        const username = userData.username || 'username';
        const dob = userData.dateOfBirth || { day: '?', month: '?', year: '?' };
        const createdAt = userData.createdAt ? new Date(userData.createdAt.toDate()) : new Date();
        
        const joinMonth = createdAt.toLocaleString('default', { month: 'long' });
        const joinYear = createdAt.getFullYear();
        const dobString = `${dob.day} ${new Date(2000, dob.month-1).toLocaleString('default', { month: 'long' })} ${dob.year}`;
        
        const html = `
            <div class="profile-container">
                <div class="profile-avatar">
                    <div class="avatar-circle">
                        <span class="avatar-text">${displayName.charAt(0)}</span>
                    </div>
                </div>
                
                <div class="profile-name">
                    <h2>${displayName}</h2>
                    <p class="profile-username">@${username}</p>
                </div>
                
                <div class="profile-card">
                    <div class="profile-card-icon">🎂</div>
                    <div class="profile-card-content">
                        <div class="profile-card-label">Date of Birth</div>
                        <div class="profile-card-value">${dobString}</div>
                    </div>
                </div>
                
                <div class="profile-card">
                    <div class="profile-card-icon">📅</div>
                    <div class="profile-card-content">
                        <div class="profile-card-label">Member Since</div>
                        <div class="profile-card-value">${joinMonth} ${joinYear}</div>
                    </div>
                </div>
                
                <button class="logout-btn" onclick="handleLogout()">
                    <span class="logout-icon">🚪</span>
                    Logout
                </button>
            </div>
        `;
        
        content.innerHTML = html;
        updateBottomNav('profile');
    }).catch(error => {
        console.error('Error fetching user data:', error);
        content.innerHTML = '<div class="error-message">Failed to load profile</div>';
    });
}

// ===== PROGRESS PAGE =====
function renderProgress() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'flex';
    
    AppState.currentView = 'progress';
    const content = document.getElementById('main-content');
    
    updateHeader('📊 Progress');
    
    const user = auth.currentUser;
    if (!user) {
        renderLogin();
        return;
    }
    
    content.innerHTML = `<div class="loading-spinner"></div>`;
    
    Promise.all([
        db.collection('users').doc(user.uid).get(),
        db.collection('attempts')
            .where('userId', '==', user.uid)
            .orderBy('completedAt', 'desc')
            .limit(5)
            .get()
    ]).then(([userDoc, attemptsSnapshot]) => {
        if (!userDoc.exists) {
            content.innerHTML = '<div class="error-message">User data not found</div>';
            return;
        }
        
        const userData = userDoc.data();
        const overall = userData.overall || { totalPoints: 0, quizzesTaken: 0, totalTimeSpent: 0 };
        const subjects = userData.subjects || {};
        
        const avgAccuracy = overall.quizzesTaken > 0 
            ? Math.round((overall.totalPoints / (overall.quizzesTaken * 1000)) * 100) 
            : 0;
        
        let html = `
            <div class="progress-container">
                <div class="stats-card">
                    <div class="stats-header">📈 Overall Statistics</div>
                    <div class="stats-grid">
                        <div class="stat-item">
                            <div class="stat-value">${overall.totalPoints}</div>
                            <div class="stat-label">Total Points</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${overall.quizzesTaken}</div>
                            <div class="stat-label">Quizzes</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${avgAccuracy}%</div>
                            <div class="stat-label">Accuracy</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">${formatTime(overall.totalTimeSpent || 0)}</div>
                            <div class="stat-label">Total Time</div>
                        </div>
                    </div>
                </div>
                
                <div class="stats-card">
                    <div class="stats-header">📚 Subject Breakdown</div>
                    <div class="subject-list">
        `;
        
        const math = subjects.math || { totalPoints: 0, accuracy: 0 };
        const mathPercent = overall.totalPoints > 0 ? Math.round((math.totalPoints / overall.totalPoints) * 100) : 0;
        html += `
            <div class="subject-item">
                <div class="subject-header">
                    <span class="subject-name">📐 Math</span>
                    <span class="subject-stats">${math.totalPoints} pts • ${math.accuracy || 0}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${mathPercent}%"></div>
                </div>
            </div>
        `;
        
        const english = subjects.english || { totalPoints: 0, accuracy: 0 };
        const englishPercent = overall.totalPoints > 0 ? Math.round((english.totalPoints / overall.totalPoints) * 100) : 0;
        html += `
            <div class="subject-item">
                <div class="subject-header">
                    <span class="subject-name">📚 English</span>
                    <span class="subject-stats">${english.totalPoints} pts • ${english.accuracy || 0}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${englishPercent}%"></div>
                </div>
            </div>
        `;
        
        const science = subjects.science || { totalPoints: 0, accuracy: 0 };
        const sciencePercent = overall.totalPoints > 0 ? Math.round((science.totalPoints / overall.totalPoints) * 100) : 0;
        html += `
            <div class="subject-item">
                <div class="subject-header">
                    <span class="subject-name">🔬 Science</span>
                    <span class="subject-stats">${science.totalPoints} pts • ${science.accuracy || 0}%</span>
                </div>
                <div class="progress-bar-bg">
                    <div class="progress-bar-fill" style="width: ${sciencePercent}%"></div>
                </div>
            </div>
        `;
        
        html += `</div></div>`;
        
        html += `<div class="stats-card"><div class="stats-header">🕒 Recent Activity</div>`;
        
        if (attemptsSnapshot.empty) {
            html += '<div class="empty-state">No quizzes taken yet</div>';
        } else {
            html += `<div class="activity-list">`;
            attemptsSnapshot.forEach(doc => {
                const attempt = doc.data();
                const dateStr = formatDate(attempt.completedAt);
                const subjectIcon = attempt.subject === 'math' ? '📐' : attempt.subject === 'english' ? '📚' : '🔬';
                
                html += `
                    <div class="activity-item">
                        <div class="activity-main">
                            <span class="activity-title">${subjectIcon} ${attempt.chapter} ${attempt.level}</span>
                            <span class="activity-score">${attempt.score} pts</span>
                        </div>
                        <div class="activity-details">
                            <span>${attempt.questionsCorrect}/${attempt.totalQuestions} correct</span>
                            <span>•</span>
                            <span>${dateStr}</span>
                        </div>
                    </div>
                `;
            });
            html += `</div>`;
        }
        
        html += `
            <button class="view-all-btn" onclick="renderAllActivity()">📋 View All Activity</button>
        `;
        
        html += `</div></div>`;
        
        content.innerHTML = html;
        updateBottomNav('progress');
        
    }).catch(error => {
        console.error('Error loading progress:', error);
        content.innerHTML = '<div class="error-message">Failed to load progress</div>';
    });
}

// ===== ALL ACTIVITY PAGE =====
function renderAllActivity() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'flex';
    
    AppState.currentView = 'allActivity';
    const content = document.getElementById('main-content');
    
    const user = auth.currentUser;
    if (!user) {
        renderLogin();
        return;
    }
    
    content.innerHTML = `<div class="loading-spinner"></div>`;
    
    db.collection('attempts')
        .where('userId', '==', user.uid)
        .orderBy('completedAt', 'desc')
        .get()
        .then(snapshot => {
            if (snapshot.empty) {
                content.innerHTML = `
                    <div class="all-activity-container">
                        <div class="all-activity-header">
                            <button class="all-activity-back-btn" onclick="renderProgress()">‹</button>
                            <span class="all-activity-title">📋 All Activity</span>
                            <div class="all-activity-placeholder"></div>
                        </div>
                        <div class="empty-state">No activity yet</div>
                    </div>
                `;
                updateBottomNav('progress');
                return;
            }
            
            let html = `
                <div class="all-activity-container">
                    <div class="all-activity-header">
                        <button class="all-activity-back-btn" onclick="renderProgress()">‹</button>
                        <span class="all-activity-title">📋 All Activity</span>
                        <div class="all-activity-placeholder"></div>
                    </div>
                    <div class="all-activity-list">
            `;
            
            snapshot.forEach(doc => {
                const attempt = doc.data();
                const dateStr = formatDate(attempt.completedAt);
                const timeStr = attempt.timeSpent ? formatTime(attempt.timeSpent) : 'N/A';
                const subjectIcon = attempt.subject === 'math' ? '📐' : attempt.subject === 'english' ? '📚' : '🔬';
                
                const chapterName = attempt.chapter ? attempt.chapter.charAt(0).toUpperCase() + attempt.chapter.slice(1) : '';
                const subchapterName = attempt.subchapter ? attempt.subchapter.charAt(0).toUpperCase() + attempt.subchapter.slice(1) : '';
                
                html += `
                    <div class="all-activity-item">
                        <div class="all-activity-item-header">
                            <span class="all-activity-item-title">
                                ${subjectIcon} ${chapterName} · ${subchapterName} · Level ${attempt.level}
                            </span>
                            <span class="all-activity-item-score">${attempt.score} pts</span>
                        </div>
                        <div class="all-activity-item-details">
                            <span>${attempt.questionsCorrect}/${attempt.totalQuestions} correct</span>
                            <span class="dot">•</span>
                            <span>${dateStr}</span>
                            <span class="dot">•</span>
                            <span>⏱️ ${timeStr}</span>
                        </div>
                    </div>
                `;
            });
            
            html += `
                    </div>
                </div>
            `;
            
            content.innerHTML = html;
            updateBottomNav('progress');
            
        })
        .catch(error => {
            console.error('Error loading all activity:', error);
            content.innerHTML = `
                <div class="all-activity-container">
                    <div class="all-activity-header">
                        <button class="all-activity-back-btn" onclick="renderProgress()">‹</button>
                        <span class="all-activity-title">📋 All Activity</span>
                        <div class="all-activity-placeholder"></div>
                    </div>
                    <div class="error-message">Failed to load activity</div>
                </div>
            `;
        });
}

// ===== QUIZ FUNCTIONS =====
function renderQuiz(subjectId, chapterId, subchapterId, level) {
    AppState.currentView = 'quiz';
    AppState.currentSubject = subjectId;
    AppState.currentChapter = chapterId;
    AppState.currentSubchapter = subchapterId;
    AppState.currentLevel = level;
    
    const content = document.getElementById('main-content');
    content.innerHTML = `<div class="loading-spinner"></div>`;
    
    loadSubjectFormatter(subjectId).then(() => {
        loadQuizData(subjectId, chapterId, subchapterId, level)
            .then(quizData => renderGenericQuiz(quizData))
            .catch(error => {
                console.error('Failed to load quiz:', error);
                content.innerHTML = `
                    <div style="text-align: center; padding: 40px;">
                        <p style="color: #ef4444;">Failed to load quiz</p>
                        <button class="back-button" onclick="renderLevels('${subjectId}', '${chapterId}', '${subchapterId}')">← Go Back</button>
                    </div>
                `;
            });
    });
}

function renderGenericQuiz(quizData) {
    quizStartTime = Date.now();
    
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'none';
    
    currentQuizData = quizData;
    currentQuizData.currentQuestion = 0;
    currentQuizData.score = 0;
    
    const content = document.getElementById('main-content');
    
    const subject = AppState.config.subjects.find(s => s.id === AppState.currentSubject);
    const chapter = subject.chapters.find(c => c.id === AppState.currentChapter);
    const subchapter = chapter.subchapters.find(s => s.id === AppState.currentSubchapter);
    
    const formattedQuestion = currentFormatter?.formatQuestion 
        ? currentFormatter.formatQuestion(quizData.questions[0].question)
        : quizData.questions[0].question;
    
    const html = `
        <div class="quiz-header-blue">
            <div class="quiz-header-left">
                <button class="quiz-back-btn-white" onclick="if(questionTimer) clearInterval(questionTimer); renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">‹</button>
                <span class="quiz-subchapter-name">${subchapter.name}</span>
            </div>
            <div class="quiz-level-blue">Level ${AppState.currentLevel}</div>
        </div>

        <div class="quiz-header-white">
            <div class="quiz-progress-white">1/${quizData.questions.length}</div>
            <div class="quiz-score-header" id="quizScoreHeader">0</div>
            <div class="quiz-timer-row">
                <div class="circular-timer" id="circularTimer">
                    <svg width="36" height="36" viewBox="0 0 40 40">
                        <circle class="timer-circle-bg" cx="20" cy="20" r="16"></circle>
                        <circle class="timer-circle-progress" id="timerCircleProgress" cx="20" cy="20" r="16" stroke-dasharray="100.53" stroke-dashoffset="0"></circle>
                    </svg>
                    <div class="timer-circle-text" id="timerText">${currentQuizData.timePerQuestion}</div>
                </div>
            </div>
        </div>

        <div class="quiz-question" id="quizQuestion">${formattedQuestion}</div>

        <div class="quiz-options-large" id="quizOptions">
            ${renderLargeOptions(quizData.questions[0])}
        </div>
    `;
    
    content.innerHTML = html;
    startCircularTimer();
}

function renderLargeOptions(question) {
    const formattedOptions = currentFormatter?.formatOptions 
        ? currentFormatter.formatOptions(question.options)
        : question.options.map(opt => ({ display: opt, value: opt }));
    
    return shuffleArray(formattedOptions).map(opt => `
        <button class="quiz-option-large" onclick="checkAnswer('${opt.value.replace(/'/g, "\\'")}', this)">
            ${opt.display}
        </button>
    `).join('');
}

function checkAnswer(selectedOption, buttonElement) {
    if (!currentQuizData) return;
    
    if (questionTimer) clearInterval(questionTimer);
    
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    const question = currentQuizData.questions[currentQuizData.currentQuestion];
    const isCorrect = (selectedOption === question.correct);
    
    if (isCorrect) {
        const pointsEarned = calculatePoints(timeTaken);
        buttonElement.classList.add('correct');
        currentQuizData.score += pointsEarned;
    } else {
        buttonElement.classList.add('wrong');
        highlightCorrectAnswer(question.correct);
    }
    
    updateScoreDisplay();
    disableAllButtons();
    
    setTimeout(moveToNextQuestion, 500);
}

function renderCurrentQuestion() {
    if (!currentQuizData) return;
    
    const question = currentQuizData.questions[currentQuizData.currentQuestion];
    
    const questionEl = document.getElementById('quizQuestion');
    if (questionEl) {
        questionEl.innerHTML = currentFormatter?.formatQuestion 
            ? currentFormatter.formatQuestion(question.question)
            : question.question;
    }
    
    const optionsEl = document.getElementById('quizOptions');
    if (optionsEl) optionsEl.innerHTML = renderLargeOptions(question);
    
    const progressEl = document.querySelector('.quiz-progress-white');
    if (progressEl) {
        progressEl.textContent = `${currentQuizData.currentQuestion + 1}/${currentQuizData.questions.length}`;
    }
    
    updateScoreDisplay();
    startCircularTimer();
}

function updateScoreDisplay() {
    const scoreHeaderEl = document.getElementById('quizScoreHeader');
    if (scoreHeaderEl && currentQuizData) scoreHeaderEl.textContent = currentQuizData.score;
}

function disableAllButtons() {
    document.querySelectorAll('.quiz-option-large').forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'not-allowed';
    });
}

function enableAllButtons() {
    document.querySelectorAll('.quiz-option-large').forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.classList.remove('correct', 'wrong');
    });
}

function highlightCorrectAnswer(correctAnswer) {
    document.querySelectorAll('.quiz-option-large').forEach(btn => {
        if (btn.textContent.trim() === correctAnswer) {
            btn.classList.add('correct');
        }
    });
}

function calculatePoints(timeTaken) {
    const maxPoints = currentQuizData.maxPointsPerQuestion;
    const timeLimit = currentQuizData.timePerQuestion;
    
    let points = maxPoints * (1 - (timeTaken / timeLimit) * 0.5);
    points = Math.round(points);
    const minPoints = Math.round(maxPoints * 0.1);
    
    return Math.max(minPoints, points);
}

function moveToNextQuestion() {
    if (!currentQuizData) return;
    
    if (questionTimer) clearInterval(questionTimer);
    
    if (currentQuizData.currentQuestion + 1 < currentQuizData.questions.length) {
        currentQuizData.currentQuestion++;
        renderCurrentQuestion();
    } else {
        showQuizComplete();
    }
}

function showQuizComplete() {
    if (!currentQuizData) return;
    
    if (questionTimer) clearInterval(questionTimer);
    
    saveQuizProgress();
    
    const content = document.getElementById('main-content');
    content.innerHTML = `
        <div class="section-header">
            <button class="back-button" onclick="renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">← Back to levels</button>
        </div>
        <div class="quiz-complete">
            <div class="completion-icon">🏆</div>
            <div class="score-display">${currentQuizData.score}</div>
            <div class="questions-correct">${currentQuizData.currentQuestion + 1}/${currentQuizData.questions.length}</div>
            <div class="button-row">
                <button class="try-again-btn" onclick="restartQuiz()">Try Again</button>
                <button class="next-level-btn" onclick="goToNextLevel()">Next Level</button>
            </div>
        </div>
    `;
}

function restartQuiz() {
    quizStartTime = Date.now();
    
    if (!currentQuizData) return;
    
    currentQuizData.currentQuestion = 0;
    currentQuizData.score = 0;
    
    const content = document.getElementById('main-content');
    
    const subject = AppState.config.subjects.find(s => s.id === AppState.currentSubject);
    const chapter = subject.chapters.find(c => c.id === AppState.currentChapter);
    const subchapter = chapter.subchapters.find(s => s.id === AppState.currentSubchapter);
    
    const formattedQuestion = currentFormatter?.formatQuestion 
        ? currentFormatter.formatQuestion(currentQuizData.questions[0].question)
        : currentQuizData.questions[0].question;
    
    content.innerHTML = `
        <div class="quiz-header-blue">
            <div class="quiz-header-left">
                <button class="quiz-back-btn-white" onclick="if(questionTimer) clearInterval(questionTimer); renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">‹</button>
                <span class="quiz-subchapter-name">${subchapter.name}</span>
            </div>
            <div class="quiz-level-blue">Level ${AppState.currentLevel}</div>
        </div>

        <div class="quiz-header-white">
            <div class="quiz-progress-white">1/${currentQuizData.questions.length}</div>
            <div class="quiz-score-header" id="quizScoreHeader">0</div>
            <div class="quiz-timer-row">
                <div class="circular-timer" id="circularTimer">
                    <svg width="36" height="36" viewBox="0 0 40 40">
                        <circle class="timer-circle-bg" cx="20" cy="20" r="16"></circle>
                        <circle class="timer-circle-progress" id="timerCircleProgress" cx="20" cy="20" r="16" stroke-dasharray="100.53" stroke-dashoffset="0"></circle>
                    </svg>
                    <div class="timer-circle-text" id="timerText">${currentQuizData.timePerQuestion}</div>
                </div>
            </div>
        </div>

        <div class="quiz-question" id="quizQuestion">${formattedQuestion}</div>

        <div class="quiz-options-large" id="quizOptions">
            ${renderLargeOptions(currentQuizData.questions[0])}
        </div>
    `;
    
    startCircularTimer();
}

function goToNextLevel() {
    const nextLevel = AppState.currentLevel + 1;
    const subchapter = AppState.config.subjects
        .find(s => s.id === AppState.currentSubject)
        .chapters.find(c => c.id === AppState.currentChapter)
        .subchapters.find(s => s.id === AppState.currentSubchapter);
    
    if (nextLevel <= subchapter.levels) {
        renderQuiz(AppState.currentSubject, AppState.currentChapter, AppState.currentSubchapter, nextLevel);
    } else {
        renderLevels(AppState.currentSubject, AppState.currentChapter, AppState.currentSubchapter);
    }
}

// ===== CIRCULAR TIMER =====
function startCircularTimer() {
    if (!currentQuizData) return;
    
    if (questionTimer) clearInterval(questionTimer);
    
    timeRemaining = currentQuizData.timePerQuestion;
    questionStartTime = Date.now();
    
    const timerText = document.getElementById('timerText');
    const timerCircle = document.getElementById('timerCircleProgress');
    const totalTime = currentQuizData.timePerQuestion;
    
    if (!timerText || !timerCircle) return;
    
    const circumference = 2 * Math.PI * 16;
    timerCircle.style.strokeDasharray = circumference;
    timerCircle.style.strokeDashoffset = '0';
    
    questionTimer = setInterval(() => {
        if (!currentQuizData) {
            clearInterval(questionTimer);
            return;
        }
        
        timeRemaining -= 0.1;
        
        if (timeRemaining <= 0) {
            clearInterval(questionTimer);
            timerText.textContent = '0';
            timerCircle.style.stroke = '#ef4444';
            handleTimeOut();
            return;
        }
        
        timerText.textContent = Math.ceil(timeRemaining);
        
        const progress = timeRemaining / totalTime;
        const dashOffset = circumference * (1 - progress);
        timerCircle.style.strokeDashoffset = dashOffset;
        
        if (progress < 0.25) {
            timerCircle.style.stroke = '#ef4444';
        } else if (progress < 0.5) {
            timerCircle.style.stroke = '#f59e0b';
        } else {
            timerCircle.style.stroke = '#3b82f6';
        }
        
    }, 100);
}

function handleTimeOut() {
    disableAllButtons();
    setTimeout(moveToNextQuestion, 500);
}

// ===== LEVEL FUNCTIONS =====
async function getLevelProgress(subjectId, chapterId, subchapterId, level) {
    const user = auth.currentUser;
    if (!user) return { completed: false, started: false, score: 0 };
    
    try {
        const snapshot = await db.collection('attempts')
            .where('userId', '==', user.uid)
            .where('subject', '==', subjectId)
            .where('chapter', '==', chapterId)
            .where('subchapter', '==', subchapterId)
            .where('level', '==', level)
            .orderBy('score', 'desc')
            .limit(1)
            .get();
        
        if (snapshot.empty) return { completed: false, started: false, score: 0 };
        
        const attempt = snapshot.docs[0].data();
        return {
            completed: true,
            started: true,
            score: attempt.score,
            accuracy: attempt.accuracy,
            questionsCorrect: attempt.questionsCorrect,
            totalQuestions: attempt.totalQuestions,
            timeSpent: attempt.timeSpent,
            completedAt: attempt.completedAt
        };
        
    } catch (error) {
        console.error('Error getting level progress:', error);
        return { completed: false, started: false, score: 0 };
    }
}

async function isLevelUnlocked(subjectId, chapterId, subchapterId, level) {
    if (level === 1) return true;
    const prevLevelProgress = await getLevelProgress(subjectId, chapterId, subchapterId, level - 1);
    return prevLevelProgress.completed;
}

// ===== RENDER FUNCTIONS =====
function renderHome() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'flex';
    
    if (!AppState.config) return;
    
    AppState.currentView = 'home';
    const content = document.getElementById('main-content');
    
    updateHeader('Math Riyaz');
    
    let html = `<div class="subjects-grid">`;
    
    AppState.config.subjects.forEach(subject => {
        html += `
            <div class="subject-card ${subject.id}" onclick="navigateToSubject('${subject.id}')">
                <div class="subject-header">
                    <span class="subject-icon">${subject.icon}</span>
                    <span class="subject-title">${subject.name}</span>
                </div>
                <div class="subject-description">${subject.description}</div>
            </div>
        `;
    });
    
    html += `</div>`;
    content.innerHTML = html;
    updateBottomNav('home');
}

function renderChapters(subjectId) {
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'flex';
    
    if (!AppState.config) return;
    
    AppState.currentView = 'chapters';
    AppState.currentSubject = subjectId;
    
    const subject = AppState.config.subjects.find(s => s.id === subjectId);
    const content = document.getElementById('main-content');
    
    loadSubjectCSS(subjectId);
    updateHeader(subject.name, true, 'renderHome()');
    
    let html = `<div class="chapters-list">`;
    
    subject.chapters.forEach(chapter => {
        html += `
            <div class="chapter-card" onclick="navigateToChapter('${subjectId}', '${chapter.id}')">
                <span class="chapter-name">${chapter.name}</span>
                <span class="chapter-arrow">→</span>
            </div>
        `;
    });
    
    html += `</div>`;
    content.innerHTML = html;
    updateBottomNav('subjects');
}

function renderSubchapters(subjectId, chapterId) {
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'flex';
    
    if (!AppState.config) return;
    
    AppState.currentView = 'subchapters';
    AppState.currentSubject = subjectId;
    AppState.currentChapter = chapterId;
    
    const subject = AppState.config.subjects.find(s => s.id === subjectId);
    const chapter = subject.chapters.find(c => c.id === chapterId);
    const content = document.getElementById('main-content');
    
    updateHeader(chapter.name, true, `renderChapters('${subjectId}')`);
    
    let html = `<div class="subchapters-list">`;
    
    chapter.subchapters.forEach(subchapter => {
        html += `
            <div class="subchapter-card" onclick="navigateToSubchapter('${subjectId}', '${chapterId}', '${subchapter.id}')">
                <span class="subchapter-name">${subchapter.name}</span>
                <span class="subchapter-arrow">→</span>
            </div>
        `;
    });
    
    html += `</div>`;
    content.innerHTML = html;
    updateBottomNav('subjects');
}

async function renderLevels(subjectId, chapterId, subchapterId) {
    const appHeader = document.getElementById('app-header');
    if (appHeader) appHeader.style.display = 'flex';
    
    if (!AppState.config) return;
    
    AppState.currentView = 'levels';
    AppState.currentSubject = subjectId;
    AppState.currentChapter = chapterId;
    AppState.currentSubchapter = subchapterId;
    
    const subject = AppState.config.subjects.find(s => s.id === subjectId);
    const chapter = subject.chapters.find(c => c.id === chapterId);
    const subchapter = chapter.subchapters.find(s => s.id === subchapterId);
    
    updateHeader(subchapter.name, true, `renderSubchapters('${subjectId}', '${chapterId}')`);
    
    const content = document.getElementById('main-content');
    content.innerHTML = `<div class="loading-spinner"></div>`;
    
    const levelPromises = [];
    for (let level = 1; level <= subchapter.levels; level++) {
        levelPromises.push(isLevelUnlocked(subjectId, chapterId, subchapterId, level));
    }
    
    const unlockedStatus = await Promise.all(levelPromises);
    
    let levelsHtml = `<div class="levels-list">`;
    
    for (let level = 1; level <= subchapter.levels; level++) {
        const unlocked = unlockedStatus[level - 1];
        const lockIcon = unlocked ? '🔓' : '🔒';
        const buttonClass = unlocked ? 'level-button' : 'level-button locked';
        
        levelsHtml += `
            <button class="${buttonClass}" onclick="${unlocked ? `navigateToQuiz('${subjectId}', '${chapterId}', '${subchapterId}', ${level})` : ''}">
                <span>Level ${level}</span>
                <span>${lockIcon}</span>
            </button>
        `;
    }
    
    levelsHtml += `</div>`;
    content.innerHTML = levelsHtml;
    updateBottomNav('chapters');
}

// ===== DATA LOADING =====
async function loadQuizData(subjectId, chapterId, subchapterId, level) {
    try {
        const path = `data/${subjectId}/${chapterId}/${subchapterId}/level${level}.json`;
        console.log('Loading quiz from:', path);
        
        const response = await fetch(path);
        if (!response.ok) throw new Error(`Failed to load: ${response.status}`);
        
        const quizData = await response.json();
        
        const allQuestions = quizData.questions;
        const totalQuestions = allQuestions.length;
        const numToSelect = Math.min(10, totalQuestions);
        
        const selectedQuestions = [];
        const usedIndices = new Set();
        
        while (selectedQuestions.length < numToSelect) {
            const randomIndex = Math.floor(Math.random() * totalQuestions);
            if (!usedIndices.has(randomIndex)) {
                usedIndices.add(randomIndex);
                selectedQuestions.push(allQuestions[randomIndex]);
            }
        }
        
        return { ...quizData, questions: selectedQuestions, totalQuestions: numToSelect };
        
    } catch (error) {
        console.error('Error loading quiz data:', error);
        return {
            title: "Sample Quiz",
            level: level,
            maxPointsPerQuestion: 100,
            timePerQuestion: 30,
            questions: [
                { question: "1/4 + 2/4 = ?", options: ["3/4", "3/8", "1/2", "2/4"], correct: "3/4" },
                { question: "1/3 + 1/3 = ?", options: ["2/3", "1/6", "2/6", "3/3"], correct: "2/3" }
            ]
        };
    }
}

// ===== SAVE QUIZ PROGRESS =====
async function saveQuizProgress() {
    if (!currentQuizData || !auth.currentUser) return;
    
    const user = auth.currentUser;
    const subjectId = AppState.currentSubject;
    const chapterId = AppState.currentChapter;
    const subchapterId = AppState.currentSubchapter;
    const level = AppState.currentLevel;
    
    const totalQuestions = currentQuizData.questions.length;
    const maxPossible = totalQuestions * currentQuizData.maxPointsPerQuestion;
    const accuracy = Math.round((currentQuizData.score / maxPossible) * 100);
    const questionsCorrect = Math.round(currentQuizData.score / (maxPossible / totalQuestions));
    const totalTimeSpent = Math.round((Date.now() - quizStartTime) / 1000);
    
    try {
        const attemptData = {
            userId: user.uid,
            username: user.displayName || 'user',
            displayName: user.displayName || 'User',
            subject: subjectId,
            chapter: chapterId,
            subchapter: subchapterId,
            level: level,
            score: currentQuizData.score,
            maxPossible: maxPossible,
            accuracy: accuracy,
            questionsCorrect: questionsCorrect,
            totalQuestions: totalQuestions,
            timeSpent: totalTimeSpent,
            completedAt: firebase.firestore.FieldValue.serverTimestamp()
        };
        
        await db.collection('attempts').add(attemptData);
        
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const overall = userData.overall || { totalPoints: 0, quizzesTaken: 0, totalTimeSpent: 0 };
            
            overall.totalPoints = (overall.totalPoints || 0) + currentQuizData.score;
            overall.quizzesTaken = (overall.quizzesTaken || 0) + 1;
            overall.totalTimeSpent = (overall.totalTimeSpent || 0) + totalTimeSpent;
            overall.lastActive = firebase.firestore.FieldValue.serverTimestamp();
            
            await userRef.update({ overall });
            
            const subjectData = userData.subjects?.[subjectId] || { totalPoints: 0, quizzesTaken: 0, accuracy: 0 };
            
            subjectData.totalPoints = (subjectData.totalPoints || 0) + currentQuizData.score;
            subjectData.quizzesTaken = (subjectData.quizzesTaken || 0) + 1;
            
            const oldTotal = (subjectData.accuracy || 0) * (subjectData.quizzesTaken - 1);
            subjectData.accuracy = Math.round((oldTotal + accuracy) / subjectData.quizzesTaken);
            
            await userRef.update({ [`subjects.${subjectId}`]: subjectData });
        }
        
        console.log('✅ Progress saved');
        
    } catch (error) {
        console.error('Error saving progress:', error);
    }
}

// ===== NAVIGATION FUNCTIONS =====
window.navigateToSubject = function(subjectId) { renderChapters(subjectId); };
window.navigateToChapter = function(subjectId, chapterId) { renderSubchapters(subjectId, chapterId); };
window.navigateToSubchapter = function(subjectId, chapterId, subchapterId) { renderLevels(subjectId, chapterId, subchapterId); };
window.navigateToQuiz = async function(subjectId, chapterId, subchapterId, level) {
    const unlocked = await isLevelUnlocked(subjectId, chapterId, subchapterId, level);
    if (unlocked) {
        renderQuiz(subjectId, chapterId, subchapterId, level);
    } else {
        showToast('This level is locked. Complete previous levels first!', 'error');
    }
};

// ===== PLACEHOLDER FUNCTIONS =====
function showProgress() { showToast('Progress view coming soon!', 'info'); }
function showProfile() { showToast('Profile view coming soon!', 'info'); }
function showSettings() { showToast('Settings view coming soon!', 'info'); }

// Make functions globally available
window.renderHome = renderHome;
window.renderChapters = renderChapters;
window.renderLevels = renderLevels;
window.checkAnswer = checkAnswer;
window.handleLogout = handleLogout;
window.renderProgress = renderProgress;
window.renderProfile = renderProfile;
window.renderAllActivity = renderAllActivity;
