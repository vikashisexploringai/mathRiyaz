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

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', async () => {
    await loadConfig();
    renderHome();
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

// ===== HELPER FUNCTIONS (DEFINED FIRST) =====
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

function renderQuestion(question) {
    return `
        <div class="question-text">${question.question}</div>
        <div class="options-grid-2col">
            ${shuffleArray(question.options).map(opt => `
                <button class="option-btn" onclick="checkAnswer('${opt.replace(/'/g, "\\'")}', this)">
                    ${opt}
                </button>
            `).join('')}
        </div>
    `;
}

function showFeedback(message, type) {
    const existingFeedback = document.querySelector('.quiz-feedback');
    if (existingFeedback) existingFeedback.remove();
    
    const feedback = document.createElement('div');
    feedback.className = `quiz-feedback ${type}`;
    feedback.textContent = message;
    
    const questionContainer = document.querySelector('.question-container');
    if (questionContainer) {
        questionContainer.parentNode.insertBefore(feedback, questionContainer.nextSibling);
    }
    
    setTimeout(() => {
        feedback.remove();
    }, 2000);
}

function disableAllButtons() {
    const allButtons = document.querySelectorAll('.option-btn');
    allButtons.forEach(btn => {
        btn.disabled = true;
        btn.style.opacity = '0.7';
        btn.style.cursor = 'not-allowed';
    });
}

function enableAllButtons() {
    const allButtons = document.querySelectorAll('.option-btn');
    allButtons.forEach(btn => {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.classList.remove('correct', 'wrong');
    });
}

function highlightCorrectAnswer(correctAnswer) {
    const allButtons = document.querySelectorAll('.option-btn');
    allButtons.forEach(btn => {
        if (btn.textContent.trim() === correctAnswer) {
            btn.classList.add('correct');
        }
    });
}

function updateScoreDisplay() {
    const quizMeta = document.querySelector('.quiz-meta');
    if (quizMeta && currentQuizData) {
        const totalPossible = currentQuizData.questions.length * currentQuizData.maxPointsPerQuestion;
        quizMeta.innerHTML = `
            <span>Question ${currentQuizData.currentQuestion + 1}/${currentQuizData.questions.length}</span>
            <span>⭐ ${currentQuizData.score}/${totalPossible}</span>
        `;
    }
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

function updateHeader(title) {
    const header = document.getElementById('app-header');
    if (header) {
        header.innerHTML = `
            <h1>${title}</h1>
            <div class="streak-badge">🔥 0 day streak</div>
        `;
    }
}

function updateBottomNav(activeView) {
    const nav = document.getElementById('bottom-nav');
    if (nav) {
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

// ===== TIMER FUNCTIONS =====
function startTimerForQuestion() {
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    if (!currentQuizData) return;
    
    timeRemaining = currentQuizData.timePerQuestion;
    questionStartTime = Date.now();
    
    const timerBar = document.getElementById('timerBar');
    const timerText = document.getElementById('timerText');
    
    if (!timerBar || !timerText) return;
    
    timerBar.style.width = '100%';
    timerBar.style.backgroundColor = '#3b82f6';
    
    questionTimer = setInterval(() => {
        if (!currentQuizData) {
            clearInterval(questionTimer);
            return;
        }
        
        timeRemaining -= 0.1;
        
        if (timeRemaining <= 0) {
            clearInterval(questionTimer);
            timerBar.style.width = '0%';
            timerText.textContent = '0s';
            handleTimeOut();
            return;
        }
        
        const percentage = (timeRemaining / currentQuizData.timePerQuestion) * 100;
        timerBar.style.width = `${percentage}%`;
        
        if (percentage < 25) {
            timerBar.style.backgroundColor = '#ef4444';
        } else if (percentage < 50) {
            timerBar.style.backgroundColor = '#f59e0b';
        }
        
        timerText.textContent = `${Math.ceil(timeRemaining)}s`;
    }, 100);
}

function handleTimeOut() {
    disableAllButtons();
    showFeedback('⏰ Time\'s up! Moving to next question...', 'error');
    
    setTimeout(() => {
        moveToNextQuestion();
    }, 1500);
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
        showFeedback(`✅ Correct! +${pointsEarned} points`, 'success');
    } else {
        buttonElement.classList.add('wrong');
        showFeedback(`❌ Wrong. Correct: ${question.correct}`, 'error');
        highlightCorrectAnswer(question.correct);
    }
    
    currentQuizData.score += pointsEarned;
    updateScoreDisplay();
    disableAllButtons();
    
    setTimeout(() => {
        moveToNextQuestion();
    }, 1500);
}

function renderCurrentQuestion() {
    if (!currentQuizData) return;
    
    const question = currentQuizData.questions[currentQuizData.currentQuestion];
    const subjectClass = `${AppState.currentSubject}-quiz`;
    
    const quizContainer = document.getElementById('questionContainer');
    if (quizContainer) {
        quizContainer.innerHTML = renderQuestion(question);
    }
    
    updateScoreDisplay();
    enableAllButtons();
    startTimerForQuestion();
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

// ===== VIEW RENDERING =====
function renderHome() {
    if (!AppState.config) return;
    
    AppState.currentView = 'home';
    const content = document.getElementById('main-content');
    
    let html = `<div class="subjects-grid">`;
    
    AppState.config.subjects.forEach(subject => {
        const progress = calculateSubjectProgress(subject.id);
        
        html += `
            <div class="subject-card ${subject.id}" onclick="navigateToSubject('${subject.id}')">
                <div class="subject-header">
                    <span class="subject-icon">${subject.icon}</span>
                    <span class="subject-title">${subject.name}</span>
                </div>
                <div class="subject-description">${subject.description}</div>
                <div class="subject-stats">
                    <span class="progress-badge">${progress.completed}/${progress.total} levels</span>
                    <div class="progress-bar-container">
                        <div class="progress-bar" style="width: ${progress.percentage}%"></div>
                    </div>
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    html += `
        <h3 style="margin: 30px 0 15px; color: #64748b;">RECENT ACTIVITY</h3>
        <div style="background: #f8fafc; border-radius: 12px; padding: 16px;">
            <p style="color: #475569;">▶️ No recent activity</p>
        </div>
    `;
    
    content.innerHTML = html;
    updateHeader('mathRiyaz');
    updateBottomNav('home');
}

function renderChapters(subjectId) {
    if (!AppState.config) return;
    
    AppState.currentView = 'chapters';
    AppState.currentSubject = subjectId;
    
    const subject = AppState.config.subjects.find(s => s.id === subjectId);
    const content = document.getElementById('main-content');
    
    loadSubjectCSS(subjectId);
    
    let html = `
        <div class="section-header">
            <button class="back-button" onclick="renderHome()">← Back to subjects</button>
            <span style="color: #2563eb; font-weight: 500;">${subject.name}</span>
        </div>
        <div class="chapters-list">
    `;
    
    subject.chapters.forEach(chapter => {
        const progress = calculateChapterProgress(subjectId, chapter.id);
        
        html += `
            <div class="chapter-card" onclick="navigateToChapter('${subjectId}', '${chapter.id}')">
                <div class="chapter-header">
                    <span class="chapter-name">${chapter.name}</span>
                    <span class="chapter-icon">→</span>
                </div>
                <div class="progress-bar-container" style="margin-bottom: 12px;">
                    <div class="progress-bar" style="width: ${progress.percentage}%"></div>
                </div>
                <div class="subchapters-preview">
        `;
        
        chapter.subchapters.forEach(subchapter => {
            html += `<span class="subchapter-tag">${subchapter.name}</span>`;
        });
        
        html += `</div></div>`;
    });
    
    html += `</div>`;
    content.innerHTML = html;
    updateHeader(subject.name);
    updateBottomNav('subjects');
}

function renderLevels(subjectId, chapterId, subchapterId) {
    if (!AppState.config) return;
    
    AppState.currentView = 'levels';
    AppState.currentSubject = subjectId;
    AppState.currentChapter = chapterId;
    AppState.currentSubchapter = subchapterId;
    
    const subject = AppState.config.subjects.find(s => s.id === subjectId);
    const chapter = subject.chapters.find(c => c.id === chapterId);
    const subchapter = chapter.subchapters.find(s => s.id === subchapterId);
    
    const content = document.getElementById('main-content');
    
    let html = `
        <div class="section-header">
            <button class="back-button" onclick="renderChapters('${subjectId}')">← Back to chapters</button>
        </div>
        <div class="subchapter-header">
            <div class="subchapter-title">${chapter.name} → ${subchapter.name}</div>
            <div class="subchapter-path">${subject.name} / ${chapter.name} / ${subchapter.name}</div>
        </div>
        <div class="levels-grid">
    `;
    
    for (let level = 1; level <= subchapter.levels; level++) {
        const levelName = subchapter.levelNames?.[level] || `Level ${level}`;
        const progress = getLevelProgress(subjectId, chapterId, subchapterId, level);
        const locked = level > 1 && !isLevelUnlocked(subjectId, chapterId, subchapterId, level);
        
        let statusClass = '';
        let statusIcon = '';
        let progressText = '';
        
        if (locked) {
            statusClass = 'locked';
            statusIcon = '🔒';
            progressText = 'Locked';
        } else if (progress.completed) {
            statusIcon = '✅';
            progressText = `Score: ${progress.score}%`;
        } else if (progress.started) {
            statusIcon = '⏳';
            progressText = 'In progress';
        } else {
            statusIcon = '🔓';
            progressText = 'Not started';
        }
        
        html += `
            <div class="level-card ${statusClass}" onclick="navigateToQuiz('${subjectId}', '${chapterId}', '${subchapterId}', ${level})">
                <div class="level-number">${level}</div>
                <div class="level-name">${levelName}</div>
                <div class="level-progress">${statusIcon} ${progressText}</div>
            </div>
        `;
    }
    
    html += `</div>`;
    content.innerHTML = html;
    updateHeader(`${chapter.name} - ${subchapter.name}`);
    updateBottomNav('chapters');
}

function renderQuiz(subjectId, chapterId, subchapterId, level) {
    AppState.currentView = 'quiz';
    AppState.currentSubject = subjectId;
    AppState.currentChapter = chapterId;
    AppState.currentSubchapter = subchapterId;
    AppState.currentLevel = level;
    
    const content = document.getElementById('main-content');
    content.innerHTML = `<div class="loading-spinner"></div>`;
    
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
}

function renderGenericQuiz(quizData) {
    currentQuizData = quizData;
    currentQuizData.currentQuestion = 0;
    currentQuizData.score = 0;
    
    const content = document.getElementById('main-content');
    const subjectId = AppState.currentSubject;
    const subjectClass = `${subjectId}-quiz`;
    
    const subject = AppState.config.subjects.find(s => s.id === AppState.currentSubject);
    const chapter = subject.chapters.find(c => c.id === AppState.currentChapter);
    const subchapter = chapter.subchapters.find(s => s.id === AppState.currentSubchapter);
    const levelName = subchapter.levelNames?.[AppState.currentLevel] || `Level ${AppState.currentLevel}`;
    
    let html = `
        <div class="section-header">
            <button class="back-button" onclick="if(questionTimer) clearInterval(questionTimer); renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">← Back</button>
            <span class="quiz-level-badge">${levelName}</span>
        </div>
        <div class="quiz-header">
            <div class="timer-container">
                <div class="timer-bar" id="timerBar"></div>
                <div class="timer-text" id="timerText">${currentQuizData.timePerQuestion}s</div>
            </div>
            <div class="quiz-meta">
                <span>Question 1/${currentQuizData.questions.length}</span>
                <span>⭐ 0/${currentQuizData.questions.length * currentQuizData.maxPointsPerQuestion}</span>
            </div>
        </div>
        <div class="question-container ${subjectClass}" id="questionContainer">
            ${renderQuestion(currentQuizData.questions[0])}
        </div>
    `;
    
    content.innerHTML = html;
    updateHeader(`Level ${AppState.currentLevel}`);
    startTimerForQuestion();
}

function showQuizComplete() {
    if (!currentQuizData) return;
    
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    const totalPossible = currentQuizData.questions.length * currentQuizData.maxPointsPerQuestion;
    const percentage = Math.round((currentQuizData.score / totalPossible) * 100);
    
    const content = document.getElementById('main-content');
    content.innerHTML = `
        <div class="section-header">
            <button class="back-button" onclick="renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">← Back to levels</button>
        </div>
        <div class="quiz-complete">
            <div class="completion-icon">🏆</div>
            <h2>Quiz Complete!</h2>
            <div class="score-display">
                <span class="score">${currentQuizData.score}</span>
                <span class="percentage">${percentage}%</span>
            </div>
            <div class="feedback-message">
                ${getFeedbackMessage(percentage)}
            </div>
            <button class="restart-btn" onclick="restartQuiz()">Try Again</button>
            <button class="continue-btn" onclick="renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">Choose Another Level</button>
        </div>
    `;
    
    saveProgressToFirebase();
}

function restartQuiz() {
    if (!currentQuizData) return;
    
    currentQuizData.currentQuestion = 0;
    currentQuizData.score = 0;
    
    const subjectClass = `${AppState.currentSubject}-quiz`;
    const content = document.getElementById('main-content');
    
    const subject = AppState.config.subjects.find(s => s.id === AppState.currentSubject);
    const chapter = subject.chapters.find(c => c.id === AppState.currentChapter);
    const subchapter = chapter.subchapters.find(s => s.id === AppState.currentSubchapter);
    const levelName = subchapter.levelNames?.[AppState.currentLevel] || `Level ${AppState.currentLevel}`;
    
    content.innerHTML = `
        <div class="section-header">
            <button class="back-button" onclick="renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">← Back</button>
            <span class="quiz-level-badge">${levelName}</span>
        </div>
        <div class="quiz-header">
            <div class="timer-container">
                <div class="timer-bar" id="timerBar"></div>
                <div class="timer-text" id="timerText">${currentQuizData.timePerQuestion}s</div>
            </div>
            <div class="quiz-meta">
                <span>Question 1/${currentQuizData.questions.length}</span>
                <span>⭐ 0/${currentQuizData.questions.length * currentQuizData.maxPointsPerQuestion}</span>
            </div>
        </div>
        <div class="question-container ${subjectClass}" id="questionContainer">
            ${renderQuestion(currentQuizData.questions[0])}
        </div>
    `;
    
    startTimerForQuestion();
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
        return quizData;
        
    } catch (error) {
        console.error('Error loading quiz data:', error);
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
    const subject = AppState.config.subjects.find(s => s.id === subjectId);
    const chapter = subject.chapters.find(c => c.id === chapterId);
    if (chapter.subchapters.length > 0) {
        renderLevels(subjectId, chapterId, chapter.subchapters[0].id);
    }
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
