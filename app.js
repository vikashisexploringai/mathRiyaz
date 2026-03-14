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
        <button class="nav-item ${activeView === 'progress' ? 'active' : ''}" onclick="showProgress()">
            <span class="nav-icon">📊</span>
            <span>Progress</span>
        </button>
        <button class="nav-item ${activeView === 'profile' ? 'active' : ''}" onclick="showProfile()">
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

function handleLogin() {
    const username = document.getElementById('username')?.value;
    const password = document.getElementById('password')?.value;
    const rememberMe = document.getElementById('rememberMe')?.checked;
    
    if (!username || !password) {
        alert('Please enter both username and password');
        return;
    }
    
    console.log('Login attempt:', { username, rememberMe });
    
    // For now, simulate successful login
    // Later: Connect to Firebase
    
    // Show bottom nav again
    const bottomNav = document.getElementById('bottom-nav');
    if (bottomNav) {
        bottomNav.style.display = 'flex';
    }
    
    // Go to home
    renderHome();
}

// Placeholder functions - we'll implement these next
function renderRegister() {
    alert('Register view coming soon!');
}

function renderForgotUsername() {
    alert('Forgot Username view coming soon!');
}

function renderForgotPassword() {
    alert('Forgot Password view coming soon!');
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
function renderLevels(subjectId, chapterId, subchapterId) {
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
    
    // Update header with centered subchapter name and back button to chapters
    updateHeader(subchapter.name, true, `renderSubchapters('${subjectId}', '${chapterId}')`);
    
    const content = document.getElementById('main-content');
    
    let levelsHtml = `<div class="levels-list">`;
    
    for (let level = 1; level <= subchapter.levels; level++) {
        const progress = getLevelProgress(subjectId, chapterId, subchapterId, level);
        const locked = level > 1 && !isLevelUnlocked(subjectId, chapterId, subchapterId, level);
        
        let lockIcon = locked ? '🔒' : '🔓';
        let buttonClass = locked ? 'level-button locked' : 'level-button';
        
        levelsHtml += `
            <button class="${buttonClass}" onclick="${!locked ? `navigateToQuiz('${subjectId}', '${chapterId}', '${subchapterId}', ${level})` : ''}">
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

// ===== PROGRESS FUNCTIONS (PLACEHOLDERS) =====
function calculateSubjectProgress(subjectId) {
    return { completed: 3, total: 8, percentage: 37.5 };
}

function calculateChapterProgress(subjectId, chapterId) {
    return { completed: 2, total: 4, percentage: 50 };
}

function getLevelProgress(subjectId, chapterId, subchapterId, level) {
    return {
        completed: level === 1,
        started: level === 2,
        score: level === 1 ? 80 : 0
    };
}

function isLevelUnlocked(subjectId, chapterId, subchapterId, level) {
    if (level === 1) return true;
    const prevLevel = getLevelProgress(subjectId, chapterId, subchapterId, level - 1);
    return prevLevel.completed;
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

window.navigateToQuiz = function(subjectId, chapterId, subchapterId, level) {
    renderQuiz(subjectId, chapterId, subchapterId, level);
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
