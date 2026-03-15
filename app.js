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

// ===== FORMATTER =====
let currentFormatter = null;
// Store temporary verification state
let passwordResetVerified = false;
let passwordResetUsername = null;
let passwordResetEmail = null;
let passwordResetDay = null;
let passwordResetMonth = null;
let passwordResetYear = null;
let quizStartTime = 0;  // Add this with other let declarations

// ===== FIREBASE CONFIG =====
// Your Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyACO39eJRrdbgowWcqgdp0DFkDPUhbQQfQ",
  authDomain: "database-367af.firebaseapp.com",
  projectId: "database-367af",
  storageBucket: "database-367af.firebasestorage.app",
  messagingSenderId: "246204653332",
  appId: "1:246204653332:web:8daf25ea24112de940ec01"
};

// Initialize Firebase (if not already initialized)
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}

const auth = firebase.auth();
const db = firebase.firestore();

console.log('Firebase apps:', firebase.apps.length);
console.log('Auth exists:', !!auth);
console.log('Firestore exists:', !!db);

// Try to force Firestore initialization
try {
    const test = db.collection('test');
    console.log('Firestore test passed');
} catch (e) {
    console.error('Firestore test failed:', e);
}

// Set up auth state observer
auth.onAuthStateChanged(async (user) => {
    if (user) {
        // User is signed in
        console.log('User signed in:', user.email);
        AppState.currentUser = {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName
        };
        
        // Load user progress from Firestore
        await loadUserProgress(user.uid);
        
        // If current view is login/register, go to home
        if (['login', 'register', 'forgotUsername', 'forgotPassword', 'resetPassword'].includes(AppState.currentView)) {
            renderHome();
        }
    } else {
        // User is signed out
        console.log('User signed out');
        AppState.currentUser = null;
        
        // If not on auth page, go to login
        if (!['login', 'register', 'forgotUsername', 'forgotPassword', 'resetPassword'].includes(AppState.currentView)) {
            renderLogin();
        }
    }
});

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

// ===== FORMATTER LOADING =====
async function loadSubjectFormatter(subjectId) {
    try {
        // Dynamically import the formatter for this subject
        const formatterModule = await import(`./shared/formatters/${subjectId}-formatter.js`);
        
        // Store the formatter
        currentFormatter = formatterModule.default || formatterModule;
        
        console.log(`Loaded formatter for ${subjectId}`);
        return currentFormatter;
    } catch (error) {
        console.warn(`No specific formatter for ${subjectId}, using default`);
        // Use default formatter that just returns the text as-is
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

function renderLargeOptions(question) {
    // Use formatter to format options if available
    const formattedOptions = currentFormatter?.formatOptions 
        ? currentFormatter.formatOptions(question.options)
        : question.options.map(opt => ({ display: opt, value: opt }));
    
    return shuffleArray(formattedOptions).map(opt => `
        <button class="quiz-option-large" onclick="checkAnswer('${opt.value.replace(/'/g, "\\'")}', this)">
            ${opt.display}
        </button>
    `).join('');
}


// ===== PROFILE PAGE =====
function renderProfile() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.style.display = 'flex';
    }
    
    AppState.currentView = 'profile';
    const content = document.getElementById('main-content');
    
    // Update header
    updateHeader('Profile');
    
    // Get current user data
    const user = auth.currentUser;
    if (!user) {
        renderLogin();
        return;
    }
    
    // Fetch user details from Firestore
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
        
        // Format dates
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

// ===== LOGOUT FUNCTION =====
async function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        try {
            await auth.signOut();
            renderLogin();
        } catch (error) {
            console.error('Logout error:', error);
            alert('Failed to logout. Please try again.');
        }
    }
}


// ===== PROGRESS HELPER FUNCTIONS =====
function formatTime(seconds) {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    
    if (hours > 0) {
        return `${hours}.${Math.floor(minutes/6)} hrs`; // e.g., 12.5 hrs
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
    const diffMs = now - date;
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    
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

function showFeedback(message, type) {
    const existingFeedback = document.querySelector('.quiz-feedback');
    if (existingFeedback) existingFeedback.remove();
    
    const feedback = document.createElement('div');
    feedback.className = `quiz-feedback ${type}`;
    feedback.textContent = message;
    
    const questionContainer = document.querySelector('.quiz-question');
    if (questionContainer) {
        questionContainer.parentNode.insertBefore(feedback, questionContainer.nextSibling);
    }
    
    setTimeout(() => {
        feedback.remove();
    }, 2000);
}

function disableAllButtons() {
    const allButtons = document.querySelectorAll('.quiz-option-large');
    allButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'not-allowed';
    });
}

function enableAllButtons() {
    const allButtons = document.querySelectorAll('.quiz-option-large');
    allButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.classList.remove('correct', 'wrong');
    });
}

function highlightCorrectAnswer(correctAnswer) {
    const allButtons = document.querySelectorAll('.quiz-option-large');
    allButtons.forEach(btn => {
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

function getFeedbackMessage(percentage) {
    if (percentage >= 90) return "Excellent! You've mastered this level! 🎉";
    if (percentage >= 70) return "Good job! You're doing great! 👍";
    if (percentage >= 50) return "Keep practicing! You'll get better! 💪";
    return "Don't give up! Try again to improve! 🌱";
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
    
    if (activeView === 'login' || activeView === 'register' || 
        activeView === 'forgotUsername' || activeView === 'forgotPassword') {
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

function goToNextLevel() {
    const nextLevel = AppState.currentLevel + 1;
    const subchapter = AppState.config.subjects
        .find(s => s.id === AppState.currentSubject)
        .chapters.find(c => c.id === AppState.currentChapter)
        .subchapters.find(s => s.id === AppState.currentSubchapter);
    
    if (nextLevel <= subchapter.levels) {
        // Next level exists
        renderQuiz(AppState.currentSubject, AppState.currentChapter, AppState.currentSubchapter, nextLevel);
    } else {
        // No next level, go back to levels
        renderLevels(AppState.currentSubject, AppState.currentChapter, AppState.currentSubchapter);
    }
}

// ===== AUTH VIEWS =====

function renderLogin() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.style.display = 'flex';
    }
    
    AppState.currentView = 'login';
    const content = document.getElementById('main-content');
    
    // Update header
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
    
    // Hide bottom nav on auth pages
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }
}

async function handleLogin() {
    const username = document.getElementById('username')?.value;
    const password = document.getElementById('password')?.value;
    const rememberMe = document.getElementById('rememberMe')?.checked;
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    
    try {
        // Show loading state
        const loginBtn = document.querySelector('.auth-btn');
        loginBtn.textContent = 'Logging in...';
        loginBtn.disabled = true;
        
        // Create email from username
        const email = `${username}@mathriyaz.local`;
        
        // Set persistence based on Remember Me
        if (rememberMe) {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } else {
            await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        }
        
        // Sign in
        await auth.signInWithEmailAndPassword(email, password);
        
        // Auth observer will handle navigation
        
    } catch (error) {
        console.error('Login error:', error);
        
        let errorMessage = 'Login failed. ';
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage += 'Username not found.';
                break;
            case 'auth/wrong-password':
                errorMessage += 'Incorrect password.';
                break;
            case 'auth/invalid-email':
                errorMessage += 'Invalid username format.';
                break;
            default:
                errorMessage += error.message;
        }
        
        alert(errorMessage);
        
        // Reset button
        const loginBtn = document.querySelector('.auth-btn');
        loginBtn.textContent = 'Login';
        loginBtn.disabled = false;
    }
}

function renderRegister() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.style.display = 'flex';
    }
    
    AppState.currentView = 'register';
    const content = document.getElementById('main-content');
    
    // Update header
    updateHeader('Create Account');
    
    // Get today's date for max DOB (18 years ago, adjust as needed)
    const today = new Date();
    const maxYear = today.getFullYear() - 2; // Minimum 2 years old
    const minYear = today.getFullYear() - 100; // Maximum 100 years old
    
    // Generate year options
    let yearOptions = '';
    for (let year = maxYear; year >= minYear; year--) {
        yearOptions += `<option value="${year}">${year}</option>`;
    }
    
    // Generate month options
    let monthOptions = '';
    for (let month = 1; month <= 12; month++) {
        monthOptions += `<option value="${month}">${month}</option>`;
    }
    
    // Generate day options
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
                    <small style="color: #64748b; font-size: 12px; margin-top: 4px; display: block;">This will be used for login</small>
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
    
    // Hide bottom nav
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }
}

async function handleRegister() {
    // Get form values
    const fullName = document.getElementById('fullName')?.value;
    const username = document.getElementById('username')?.value;
    const day = document.getElementById('dobDay')?.value;
    const month = document.getElementById('dobMonth')?.value;
    const year = document.getElementById('dobYear')?.value;
    const password = document.getElementById('password')?.value;
    const confirmPassword = document.getElementById('confirmPassword')?.value;
    const rememberMe = document.getElementById('rememberMe')?.checked;
    
    // Validation
    if (!fullName || !username || !day || !month || !year || !password || !confirmPassword) {
        alert('Please fill in all fields');
        return;
    }
    
    if (password.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    if (password !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    // Check username format
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username)) {
        alert('Username can only contain letters, numbers, and underscores');
        return;
    }
    
    try {
        // Show loading state
        const registerBtn = document.querySelector('.auth-btn');
        registerBtn.textContent = 'Creating Account...';
        registerBtn.disabled = true;
        
        // Create email from username
        const email = `${username}@mathriyaz.local`;
        
        // Create user in Firebase Auth
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update profile with display name
        await user.updateProfile({
            displayName: fullName
        });
        
        // Set persistence based on Remember Me
        if (rememberMe) {
            await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL);
        } else {
            await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
        }
        
        // Save additional user data to Firestore
        await db.collection('users').doc(user.uid).set({
            uid: user.uid,
            username: username,
            displayName: fullName,
            email: email,
            dateOfBirth: {
                day: parseInt(day),
                month: parseInt(month),
                year: parseInt(year)
            },
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            overall: {
                totalPoints: 0,
                quizzesTaken: 0,
                totalTimeSpent: 0
            }
        });
        
        console.log('Account created successfully!');
        
        // Show bottom nav
        const bottomNav = document.getElementById('bottom-nav');
        if (bottomNav) {
            bottomNav.style.display = 'flex';
        }
        
        // Go to home (auth observer will handle)
        
    } catch (error) {
        console.error('Registration error:', error);
        
        let errorMessage = 'Registration failed. ';
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage += 'Username already taken. Please choose another.';
                break;
            case 'auth/weak-password':
                errorMessage += 'Password is too weak.';
                break;
            default:
                errorMessage += error.message;
        }
        
        alert(errorMessage);
        
        // Reset button
        const registerBtn = document.querySelector('.auth-btn');
        registerBtn.textContent = 'Create Account';
        registerBtn.disabled = false;
    }
}

function renderForgotUsername() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.style.display = 'flex';
    }
    
    AppState.currentView = 'forgotUsername';
    const content = document.getElementById('main-content');
    
    // Update header
    updateHeader('Find Username');
    
    // Generate date options (same as register)
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
    
    // Hide bottom nav
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }
}

async function handleFindUsername() {
    const fullName = document.getElementById('fullName')?.value;
    const day = document.getElementById('dobDay')?.value;
    const month = document.getElementById('dobMonth')?.value;
    const year = document.getElementById('dobYear')?.value;
    
    // Validation
    if (!fullName || !day || !month || !year) {
        alert('Please enter full name and date of birth');
        return;
    }
    
    try {
        // Show loading state
        const findBtn = document.querySelector('.auth-btn');
        findBtn.textContent = 'Searching...';
        findBtn.disabled = true;
        
        // Query Firestore for users with matching name and DOB
        const usersRef = db.collection('users');
        const snapshot = await usersRef
            .where('displayName', '==', fullName)
            .where('dateOfBirth.day', '==', parseInt(day))
            .where('dateOfBirth.month', '==', parseInt(month))
            .where('dateOfBirth.year', '==', parseInt(year))
            .get();
        
        // Reset button
        findBtn.textContent = 'Find Username';
        findBtn.disabled = false;
        
        if (snapshot.empty) {
            // No matching user found
            alert('No account found with these details. Please check and try again.');
            return;
        }
        
        // Get the first matching user (should be unique)
        const userData = snapshot.docs[0].data();
        const username = userData.username;
        
        // Show the result
        const resultDiv = document.getElementById('usernameResult');
        const foundUsername = document.getElementById('foundUsername');
        
        foundUsername.textContent = username;
        resultDiv.style.display = 'block';
        
    } catch (error) {
        console.error('Error finding username:', error);
        alert('An error occurred. Please try again.');
        
        // Reset button
        const findBtn = document.querySelector('.auth-btn');
        findBtn.textContent = 'Find Username';
        findBtn.disabled = false;
    }
}

function renderForgotPassword() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.style.display = 'flex';
    }
    
    AppState.currentView = 'forgotPassword';
    const content = document.getElementById('main-content');
    
    // Reset verification state
    passwordResetVerified = false;
    passwordResetUsername = null;
    
    // Update header
    updateHeader('Reset Password');
    
    // Generate date options
    const today = new Date();
    const maxYear = today.getFullYear() - 4;
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
    
    // Hide bottom nav
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }
}

async function handleVerifyIdentity() {
    const username = document.getElementById('resetUsername')?.value;
    const day = document.getElementById('resetDobDay')?.value;
    const month = document.getElementById('resetDobMonth')?.value;
    const year = document.getElementById('resetDobYear')?.value;
    
    if (!username || !day || !month || !year) {
        alert('Please enter username and date of birth');
        return;
    }
    
    try {
        const verifyBtn = document.querySelector('.auth-btn');
        verifyBtn.textContent = 'Verifying...';
        verifyBtn.disabled = true;
        
        const usersRef = db.collection('users');
        const snapshot = await usersRef
            .where('username', '==', username)
            .get();
        
        if (snapshot.empty) {
            throw new Error('User not found');
        }
        
        const userData = snapshot.docs[0].data();
        
        // Verify DOB
        if (userData.dateOfBirth.day !== parseInt(day) ||
            userData.dateOfBirth.month !== parseInt(month) ||
            userData.dateOfBirth.year !== parseInt(year)) {
            throw new Error('Date of birth does not match');
        }
        
        // Store verification data
        passwordResetVerified = true;
        passwordResetUsername = username;
        passwordResetDay = day;
        passwordResetMonth = month;
        passwordResetYear = year;
        
        // Move to password reset step
        renderResetPassword();
        
    } catch (error) {
        console.error('Verification error:', error);
        alert('Verification failed. Please check your details and try again.');
        
        const verifyBtn = document.querySelector('.auth-btn');
        verifyBtn.textContent = 'Verify Identity';
        verifyBtn.disabled = false;
    }
}

function renderResetPassword() {

     console.log('🎯 renderResetPassword CALLED!');
    console.log('passwordResetVerified:', passwordResetVerified);
    console.log('passwordResetUsername:', passwordResetUsername);
    
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.style.display = 'flex';
    }
    
    // Check if verified
    if (!passwordResetVerified) {
         console.log('❌ Not verified, returning to forgot password');
        renderForgotPassword();
        return;
    }
    
    AppState.currentView = 'resetPassword';
    const content = document.getElementById('main-content');
    
    // Update header
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
    
    // Hide bottom nav
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'none';
    }
}

async function handleCloudPasswordReset() {
    const newPassword = document.getElementById('newPassword')?.value;
    const confirmPassword = document.getElementById('confirmNewPassword')?.value;
    
    // Use stored values from verification
    const username = passwordResetUsername;
    const day = passwordResetDay;
    const month = passwordResetMonth;
    const year = passwordResetYear;
    
    if (!username || !newPassword || !confirmPassword) {
        alert('Please fill in all fields');
        return;
    }
    
    if (newPassword !== confirmPassword) {
        alert('Passwords do not match');
        return;
    }
    
    if (newPassword.length < 6) {
        alert('Password must be at least 6 characters');
        return;
    }
    
    try {
        const resetBtn = document.querySelector('.auth-btn');
        resetBtn.textContent = 'Updating...';
        resetBtn.disabled = true;
        
        const functionUrl = 'https://us-central1-database-367af.cloudfunctions.net/resetPassword';
        
        const response = await fetch(functionUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                username,
                day: parseInt(day),
                month: parseInt(month),
                year: parseInt(year),
                newPassword
            })
        });
        
        const result = await response.json();
        
        if (response.ok) {
            alert('Password updated successfully! Please login with your new password.');
            
            // Reset state
            passwordResetVerified = false;
            passwordResetUsername = null;
            passwordResetDay = null;
            passwordResetMonth = null;
            passwordResetYear = null;
            
            renderLogin();
        } else {
            throw new Error(result.error || 'Failed to reset password');
        }
        
    } catch (error) {
        console.error('Password reset error:', error);
        alert(error.message || 'Failed to reset password. Please try again.');
        
        const resetBtn = document.querySelector('.auth-btn');
        resetBtn.textContent = 'Update Password';
        resetBtn.disabled = false;
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

async function handleLogout() {
    try {
        await auth.signOut();
        renderLogin();
    } catch (error) {
        console.error('Logout error:', error);
        alert('Failed to logout. Please try again.');
    }
}

// ===== SAVE QUIZ PROGRESS =====
async function saveQuizProgress() {

    console.log('📝 saveQuizProgress STARTED');
    console.log('currentQuizData exists:', !!currentQuizData);
    console.log('auth.currentUser exists:', !!auth.currentUser);
    
    if (!currentQuizData || !auth.currentUser) {
        console.log('No quiz data or user not logged in');
        return;
    }
    
    const user = auth.currentUser;
    const subjectId = AppState.currentSubject;
    const chapterId = AppState.currentChapter;
    const subchapterId = AppState.currentSubchapter;
    const level = AppState.currentLevel;
    
    // Calculate accuracy
    const totalQuestions = currentQuizData.questions.length;
    const maxPossible = totalQuestions * currentQuizData.maxPointsPerQuestion;
    const accuracy = Math.round((currentQuizData.score / maxPossible) * 100);
    const questionsCorrect = Math.round(currentQuizData.score / (maxPossible / totalQuestions));
    const totalTimeSpent = Math.round((Date.now() - quizStartTime) / 1000);

    
    // Get current attempt count for this level
    try {
        // 1. Save the attempt to 'attempts' collection
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
        console.log('✅ Attempt saved to attempts collection');
        
        // 2. Update user's overall stats
        const userRef = db.collection('users').doc(user.uid);
        const userDoc = await userRef.get();
        
        if (userDoc.exists) {
            const userData = userDoc.data();
            const overall = userData.overall || {
                totalPoints: 0,
                quizzesTaken: 0,
                totalTimeSpent: 0,
                lastActive: null
            };
            
            // Update overall stats
            overall.totalPoints = (overall.totalPoints || 0) + currentQuizData.score;
            overall.quizzesTaken = (overall.quizzesTaken || 0) + 1;
            overall.totalTimeSpent = (overall.totalTimeSpent || 0) + attemptData.timeSpent;
            overall.lastActive = firebase.firestore.FieldValue.serverTimestamp();
            
            await userRef.update({ overall });
        }
        
        // 3. Update subject-specific stats
        const subjectPath = `subjects.${subjectId}`;
        const subjectRef = userRef;
        
        // Get current subject stats or initialize
        const subjectData = userDoc.data()?.subjects?.[subjectId] || {
            totalPoints: 0,
            quizzesTaken: 0,
            accuracy: 0
        };
        
        // Update subject totals
        subjectData.totalPoints = (subjectData.totalPoints || 0) + currentQuizData.score;
        subjectData.quizzesTaken = (subjectData.quizzesTaken || 0) + 1;
        
        // Recalculate average accuracy
        const oldTotal = (subjectData.accuracy || 0) * (subjectData.quizzesTaken - 1);
        subjectData.accuracy = Math.round((oldTotal + accuracy) / subjectData.quizzesTaken);
        
        // Save back to Firestore
        await userRef.update({
            [`subjects.${subjectId}`]: subjectData
        });
        
        console.log('✅ User stats updated');
        
    } catch (error) {
        console.error('Error saving progress:', error);
    }
}

// ===== PROGRESS PAGE =====
function renderProgress() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.style.display = 'flex';
    }
    
    AppState.currentView = 'progress';
    const content = document.getElementById('main-content');
    
    // Update header
    updateHeader('📊 Progress');
    
    // Check if user is logged in
    const user = auth.currentUser;
    if (!user) {
        renderLogin();
        return;
    }
    
    // Show loading
    content.innerHTML = `<div class="loading-spinner"></div>`;
    
    // Fetch user data and attempts
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
        
        // Calculate average accuracy
        const avgAccuracy = overall.quizzesTaken > 0 
            ? Math.round((overall.totalPoints / (overall.quizzesTaken * 1000)) * 100) 
            : 0;
        
        // Build HTML
        let html = `
            <div class="progress-container">
                <!-- Overall Statistics -->
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
                
                <!-- Subject Breakdown -->
                <div class="stats-card">
                    <div class="stats-header">📚 Subject Breakdown</div>
                    <div class="subject-list">
        `;
        
        // Math subject
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
        
        // English subject
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
        
        // Science subject
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
        
        // Recent Activity
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
        
        // View All button
        html += `
            <button class="view-all-btn" onclick="renderAllActivity()">
                📋 View All Activity
            </button>
        `;
        
        html += `</div></div>`; // Close stats-card and progress-container
        
        content.innerHTML = html;
        updateBottomNav('progress');
        
    }).catch(error => {
        console.error('Error loading progress:', error);
        content.innerHTML = '<div class="error-message">Failed to load progress</div>';
    });
}

// ===== CIRCULAR TIMER =====
function startCircularTimer() {
    if (!currentQuizData) return;
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
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
    
    setTimeout(() => {
        moveToNextQuestion();
    }, 500);
}

// ===== QUIZ FUNCTIONS =====
function checkAnswer(selectedOption, buttonElement) {
    if (!currentQuizData) return;
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    const timeTaken = (Date.now() - questionStartTime) / 1000;
    const question = currentQuizData.questions[currentQuizData.currentQuestion];
    const isCorrect = (selectedOption === question.correct);
    
    let pointsEarned = 0;
    
    if (isCorrect) {
        pointsEarned = calculatePoints(timeTaken);
        buttonElement.classList.add('correct');
    } else {
        buttonElement.classList.add('wrong');
        highlightCorrectAnswer(question.correct);
    }
    
    currentQuizData.score += pointsEarned;
    updateScoreDisplay();
    disableAllButtons();
    
    setTimeout(() => {
        moveToNextQuestion();
    }, 500);
}

function renderCurrentQuestion() {
    if (!currentQuizData) return;
    
    const question = currentQuizData.questions[currentQuizData.currentQuestion];
    
    const questionEl = document.getElementById('quizQuestion');
    if (questionEl) {
        // Use formatter to format the question text
        questionEl.innerHTML = currentFormatter?.formatQuestion 
            ? currentFormatter.formatQuestion(question.question)
            : question.question;
    }
    
    const optionsEl = document.getElementById('quizOptions');
    if (optionsEl) {
        optionsEl.innerHTML = renderLargeOptions(question);
    }
    
    const progressEl = document.querySelector('.quiz-progress-white');
    if (progressEl) {
        progressEl.textContent = `${currentQuizData.currentQuestion + 1}/${currentQuizData.questions.length}`;
    }
    
    updateScoreDisplay();
    startCircularTimer();
}

function updateScoreDisplay() {
    const scoreHeaderEl = document.getElementById('quizScoreHeader');
    if (scoreHeaderEl && currentQuizData) {
        scoreHeaderEl.textContent = currentQuizData.score;
    }
    
    const scoreEl = document.getElementById('quizScore');
    if (scoreEl && currentQuizData) {
        scoreEl.textContent = currentQuizData.score;
    }
}

function moveToNextQuestion() {
    if (!currentQuizData) return;
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    if (currentQuizData.currentQuestion + 1 < currentQuizData.questions.length) {
        currentQuizData.currentQuestion++;
        renderCurrentQuestion();
    } else {
        showQuizComplete();
    }
}

// ===== RENDER SUBCHAPTERS - CLEAN DESIGN =====
function renderSubchapters(subjectId, chapterId) {
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.style.display = 'flex';
    }
    
    if (!AppState.config) return;
    
    AppState.currentView = 'subchapters';
    AppState.currentSubject = subjectId;
    AppState.currentChapter = chapterId;
    
    const subject = AppState.config.subjects.find(s => s.id === subjectId);
    const chapter = subject.chapters.find(c => c.id === chapterId);
    const content = document.getElementById('main-content');
    
    // Update header with centered chapter name and back button to subject
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

// ===== RENDER CHAPTERS - CLEAN DESIGN =====
function renderChapters(subjectId) {
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.style.display = 'flex';
    }
    
    if (!AppState.config) return;
    
    AppState.currentView = 'chapters';
    AppState.currentSubject = subjectId;
    
    const subject = AppState.config.subjects.find(s => s.id === subjectId);
    const content = document.getElementById('main-content');
    
    loadSubjectCSS(subjectId);
    
    // Update header with centered subject name and back button to home
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

// ===== RENDER LEVELS - CLEAN DESIGN =====
async function renderLevels(subjectId, chapterId, subchapterId) {
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.style.display = 'flex';
    }
    
    if (!AppState.config) return;
    
    AppState.currentView = 'levels';
    AppState.currentSubject = subjectId;
    AppState.currentChapter = chapterId;
    AppState.currentSubchapter = subchapterId;
    
    const subject = AppState.config.subjects.find(s => s.id === subjectId);
    const chapter = subject.chapters.find(c => c.id === chapterId);
    const subchapter = chapter.subchapters.find(s => s.id === subchapterId);
    
    // Update header with centered subchapter name
    updateHeader(subchapter.name, true, `renderSubchapters('${subjectId}', '${chapterId}')`);
    
    const content = document.getElementById('main-content');
    content.innerHTML = `<div class="loading-spinner"></div>`;
    
    // Check unlock status for all levels
    const levelPromises = [];
    for (let level = 1; level <= subchapter.levels; level++) {
        levelPromises.push(isLevelUnlocked(subjectId, chapterId, subchapterId, level));
    }
    
    const unlockedStatus = await Promise.all(levelPromises);
    
    let levelsHtml = `<div class="levels-list">`;
    
    for (let level = 1; level <= subchapter.levels; level++) {
        const progress = await getLevelProgress(subjectId, chapterId, subchapterId, level);
        const unlocked = unlockedStatus[level - 1];
        
        let lockIcon = unlocked ? '🔓' : '🔒';
        let buttonClass = unlocked ? 'level-button' : 'level-button locked';
        let scoreDisplay = progress.completed ? `${progress.score} pts` : '';
        
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

// ===== HELPER FUNCTION FOR SUBCHAPTER PROGRESS =====
function calculateSubchapterProgress(subjectId, chapterId, subchapterId) {
    const subject = AppState.config.subjects.find(s => s.id === subjectId);
    const chapter = subject.chapters.find(c => c.id === chapterId);
    const subchapter = chapter.subchapters.find(s => s.id === subchapterId);
    
    const completed = 0;
    const total = subchapter.levels;
    const percentage = total > 0 ? (completed / total) * 100 : 0;
    
    return { completed, total, percentage };
}

// ===== VIEW RENDERING =====
function renderHome() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.style.display = 'flex';
    }
    
    if (!AppState.config) return;
    
    AppState.currentView = 'home';
    const content = document.getElementById('main-content');
    
    // Update header with app name (no back button)
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

function renderQuiz(subjectId, chapterId, subchapterId, level) {
    AppState.currentView = 'quiz';
    AppState.currentSubject = subjectId;
    AppState.currentChapter = chapterId;
    AppState.currentSubchapter = subchapterId;
    AppState.currentLevel = level;
    
    const content = document.getElementById('main-content');
    content.innerHTML = `<div class="loading-spinner"></div>`;
    
    // Load the subject formatter first
    loadSubjectFormatter(subjectId).then(() => {
        loadQuizData(subjectId, chapterId, subchapterId, level)
            .then(quizData => {
                renderGenericQuiz(quizData);
            })
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
    if (appHeader) {
        appHeader.style.display = 'none';
    }
    
    currentQuizData = quizData;
    currentQuizData.currentQuestion = 0;
    currentQuizData.score = 0;
    
    const content = document.getElementById('main-content');
    const subjectId = AppState.currentSubject;
    
    const subject = AppState.config.subjects.find(s => s.id === AppState.currentSubject);
    const chapter = subject.chapters.find(c => c.id === AppState.currentChapter);
    const subchapter = chapter.subchapters.find(s => s.id === AppState.currentSubchapter);
    
    // Format the first question using the formatter
    const formattedQuestion = currentFormatter?.formatQuestion 
        ? currentFormatter.formatQuestion(quizData.questions[0].question)
        : quizData.questions[0].question;
    
let html = `
    <!-- First Row - Blue with back, subchapter, and level -->
    <div class="quiz-header-blue">
        <div class="quiz-header-left">
            <button class="quiz-back-btn-white" onclick="if(questionTimer) clearInterval(questionTimer); renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">‹</button>
            <span class="quiz-subchapter-name">${subchapter.name}</span>
        </div>
        <div class="quiz-level-blue">Level ${AppState.currentLevel}</div>
    </div>

    <!-- Second Row - White with progress, score, timer -->
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

    <div class="quiz-question" id="quizQuestion">
        ${formattedQuestion}
    </div>

    <div class="quiz-options-large" id="quizOptions">
        ${renderLargeOptions(quizData.questions[0])}
    </div>
`;
    
    content.innerHTML = html;
    startCircularTimer();
}

function showQuizComplete() {
    if (!currentQuizData) return;
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }

     saveQuizProgress();
    
    const totalPossible = currentQuizData.questions.length * currentQuizData.maxPointsPerQuestion;
    
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
    
    saveProgressToFirebase();
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
    
    // Format the first question using the formatter
    const formattedQuestion = currentFormatter?.formatQuestion 
        ? currentFormatter.formatQuestion(currentQuizData.questions[0].question)
        : currentQuizData.questions[0].question;
    
    content.innerHTML = `
    <!-- First Row - Blue with back, subchapter, and level -->
    <div class="quiz-header-blue">
        <div class="quiz-header-left">
            <button class="quiz-back-btn-white" onclick="if(questionTimer) clearInterval(questionTimer); renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">‹</button>
            <span class="quiz-subchapter-name">${subchapter.name}</span>
        </div>
        <div class="quiz-level-blue">Level ${AppState.currentLevel}</div>
    </div>

    <!-- Second Row - White with progress, score, timer -->
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

    <div class="quiz-question" id="quizQuestion">
        ${formattedQuestion}
    </div>

    <div class="quiz-options-large" id="quizOptions">
        ${renderLargeOptions(currentQuizData.questions[0])}
    </div>
`;
    
    startCircularTimer();
}

// ===== DATA LOADING =====
async function loadQuizData(subjectId, chapterId, subchapterId, level) {
    try {
        const path = `data/${subjectId}/${chapterId}/${subchapterId}/level${level}.json`;
        console.log('Loading quiz from:', path);
        
        const response = await fetch(path);
        
        if (!response.ok) {
            throw new Error(`Failed to load: ${response.status}`);
        }
        
        const quizData = await response.json();
        
        // Select 10 random questions from the pool
        const allQuestions = quizData.questions;
        const totalQuestions = allQuestions.length;
        const numToSelect = Math.min(10, totalQuestions);
        
        // Randomly select questions without repetition
        const selectedQuestions = [];
        const usedIndices = new Set();
        
        while (selectedQuestions.length < numToSelect) {
            const randomIndex = Math.floor(Math.random() * totalQuestions);
            if (!usedIndices.has(randomIndex)) {
                usedIndices.add(randomIndex);
                selectedQuestions.push(allQuestions[randomIndex]);
            }
        }
        
        // Return new quiz object with selected questions
        return {
            ...quizData,
            questions: selectedQuestions,
            totalQuestions: numToSelect
        };
        
    } catch (error) {
        console.error('Error loading quiz data:', error);
        // Return fallback data with 2 questions
        return {
            title: "Sample Quiz",
            level: level,
            maxPointsPerQuestion: 100,
            timePerQuestion: 30,
            questions: [
                {
                    question: "1/4 + 2/4 = ?",
                    options: ["3/4", "3/8", "1/2", "2/4"],
                    correct: "3/4"
                },
                {
                    question: "1/3 + 1/3 = ?",
                    options: ["2/3", "1/6", "2/6", "3/3"],
                    correct: "2/3"
                }
            ]
        };
    }
}

// ===== ALL ACTIVITY PAGE =====
function renderAllActivity() {
    const appHeader = document.getElementById('app-header');
    if (appHeader) {
        appHeader.style.display = 'flex';
    }
    
    AppState.currentView = 'allActivity';
    const content = document.getElementById('main-content');
    
    // Check if user is logged in
    const user = auth.currentUser;
    if (!user) {
        renderLogin();
        return;
    }
    
    // Show loading
    content.innerHTML = `<div class="loading-spinner"></div>`;
    
    // Fetch all attempts for this user
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
                const date = attempt.completedAt ? attempt.completedAt.toDate() : new Date();
                const dateStr = formatDate(attempt.completedAt);
                const timeStr = attempt.timeSpent ? formatTime(attempt.timeSpent) : 'N/A';
                const subjectIcon = attempt.subject === 'math' ? '📐' : attempt.subject === 'english' ? '📚' : '🔬';
                
                // Format chapter and subchapter nicely
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

// ===== PROGRESS FUNCTIONS (PLACEHOLDERS) =====
function calculateSubjectProgress(subjectId) {
    return { completed: 3, total: 8, percentage: 37.5 };
}

function calculateChapterProgress(subjectId, chapterId) {
    return { completed: 2, total: 4, percentage: 50 };
}

// ===== LEVEL PROGRESS FUNCTIONS =====
async function getLevelProgress(subjectId, chapterId, subchapterId, level) {
    const user = auth.currentUser;
    if (!user) {
        return { completed: false, started: false, score: 0 };
    }
    
    try {
        // Query attempts for this specific level
        const snapshot = await db.collection('attempts')
            .where('userId', '==', user.uid)
            .where('subject', '==', subjectId)
            .where('chapter', '==', chapterId)
            .where('subchapter', '==', subchapterId)
            .where('level', '==', level)
            .orderBy('score', 'desc')
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return { completed: false, started: false, score: 0 };
        }
        
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
    // Level 1 always unlocked
    if (level === 1) return true;
    
    // Check if previous level is completed
    const prevLevelProgress = await getLevelProgress(subjectId, chapterId, subchapterId, level - 1);
    return prevLevelProgress.completed;
}

function saveProgressToFirebase() {
    console.log('Progress saved for level', AppState.currentLevel, 'Score:', currentQuizData?.score);
}

// ===== NAVIGATION FUNCTIONS =====
window.navigateToSubject = function(subjectId) {
    renderChapters(subjectId);
};

window.navigateToChapter = function(subjectId, chapterId) {
    renderSubchapters(subjectId, chapterId);
};

window.navigateToSubchapter = function(subjectId, chapterId, subchapterId) {
    renderLevels(subjectId, chapterId, subchapterId);
};

window.navigateToQuiz = async function(subjectId, chapterId, subchapterId, level) {
    // Check if level is unlocked before proceeding
    const unlocked = await isLevelUnlocked(subjectId, chapterId, subchapterId, level);
    
    if (unlocked) {
        renderQuiz(subjectId, chapterId, subchapterId, level);
    } else {
        alert('This level is locked. Complete previous levels first!');
    }
};

// ===== PLACEHOLDER FUNCTIONS =====
function showProgress() {
    alert('Progress view coming soon!');
}

function showProfile() {
    alert('Profile view coming soon!');
}

function showSettings() {
    alert('Settings view coming soon!');
}

// Make functions globally available
window.renderHome = renderHome;
window.renderChapters = renderChapters;
window.renderLevels = renderLevels;
window.checkAnswer = checkAnswer;
