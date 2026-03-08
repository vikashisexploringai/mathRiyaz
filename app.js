// app.js - Main application controller (SIMPLIFIED VERSION)

// ===== APP STATE =====
const AppState = {
    currentUser: null,
    currentView: 'home', // home, chapters, levels, quiz
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
    // Load configuration
    await loadConfig();
    
    // Check authentication (will implement later)
    // checkAuth();
    
    // For now, just render home
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

// ===== VIEW RENDERING =====
function renderHome() {
    AppState.currentView = 'home';
    const content = document.getElementById('main-content');
    
    let html = `
        <div class="subjects-grid">
    `;
    
    AppState.config.subjects.forEach(subject => {
        // Calculate progress (placeholder for now)
        const progress = calculateSubjectProgress(subject.id);
        
        html += `
            <div class="subject-card ${subject.id}" onclick="navigateToSubject('${subject.id}')">
                <div class="subject-header">
                    <span class="subject-icon">${subject.icon}</span>
                    <span class="subject-title">${subject.name}</span>
                </div>
                <div class="subject-description">
                    ${subject.description}
                </div>
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
    
    // Add recent activity section
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
    AppState.currentView = 'chapters';
    AppState.currentSubject = subjectId;
    
    const subject = AppState.config.subjects.find(s => s.id === subjectId);
    const content = document.getElementById('main-content');
    
    // Load subject-specific CSS
    loadSubjectCSS(subjectId);
    
    let html = `
        <div class="section-header">
            <button class="back-button" onclick="renderHome()">← Back to subjects</button>
            <span style="color: #2563eb; font-weight: 500;">${subject.name}</span>
        </div>
        <div class="chapters-list">
    `;
    
    subject.chapters.forEach(chapter => {
        // Calculate chapter progress
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
        
        html += `
                </div>
            </div>
        `;
    });
    
    html += `</div>`;
    content.innerHTML = html;
    updateHeader(subject.name);
    updateBottomNav('subjects');
}

function renderLevels(subjectId, chapterId, subchapterId) {
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
    
    // Generate level cards (1 to subchapter.levels)
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

// ===== SIMPLIFIED QUIZ RENDERER - ONE FOR ALL SUBJECTS =====
function renderQuiz(subjectId, chapterId, subchapterId, level) {
    AppState.currentView = 'quiz';
    AppState.currentSubject = subjectId;
    AppState.currentChapter = chapterId;
    AppState.currentSubchapter = subchapterId;
    AppState.currentLevel = level;
    
    const content = document.getElementById('main-content');
    
    // Show loading
    content.innerHTML = `<div class="loading-spinner"></div>`;
    
    // Load quiz data
    loadQuizData(subjectId, chapterId, subchapterId, level)
        .then(quizData => {
            // ONE RENDERER FOR EVERYTHING
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

// ===== GENERIC QUIZ RENDERER =====
function renderGenericQuiz(quizData) {
    // Store quiz data globally
    currentQuizData = quizData;
    currentQuizData.currentQuestion = 0;
    currentQuizData.score = 0;
    
    const content = document.getElementById('main-content');
    const subjectId = AppState.currentSubject;
    const subjectClass = `${subjectId}-quiz`;
    
    // Get level name from config
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
    
    // Start timer for first question
    startTimerForQuestion();
}
// ===== ANSWER CHECKING WITH VISUAL FEEDBACK =====
let currentQuizData = null;

function checkAnswer(selectedOption, buttonElement) {
    // Get current question
    const question = currentQuizData.questions[currentQuizData.currentQuestion];
    
    // Check if answer is correct
    const isCorrect = (selectedOption === question.correct);
    
    // Visual feedback on the clicked button
    if (isCorrect) {
        buttonElement.classList.add('correct');
        
        // Update score
        currentQuizData.score++;
        
        // Show success message (non-intrusive)
        showFeedback('✅ Correct!', 'success');
    } else {
        buttonElement.classList.add('wrong');
        
        // Show correct answer
        showFeedback(`❌ Wrong. Correct answer: ${question.correct}`, 'error');
        
        // Highlight the correct answer (optional)
        highlightCorrectAnswer(question.correct);
    }
    
    // Disable all buttons to prevent multiple answers
    disableAllButtons();
    
    // Move to next question after delay
    setTimeout(() => {
        moveToNextQuestion();
    }, 1500);
}

function showFeedback(message, type) {
    // Remove any existing feedback
    const existingFeedback = document.querySelector('.quiz-feedback');
    if (existingFeedback) existingFeedback.remove();
    
    // Create feedback element
    const feedback = document.createElement('div');
    feedback.className = `quiz-feedback ${type}`;
    feedback.textContent = message;
    
    // Insert after question container
    const questionContainer = document.querySelector('.question-container');
    questionContainer.parentNode.insertBefore(feedback, questionContainer.nextSibling);
    
    // Auto remove after 2 seconds
    setTimeout(() => {
        feedback.remove();
    }, 2000);
}

function highlightCorrectAnswer(correctAnswer) {
    // Find and highlight the correct answer button
    const allButtons = document.querySelectorAll('.option-btn');
    allButtons.forEach(btn => {
        if (btn.textContent.trim() === correctAnswer) {
            btn.classList.add('correct');
        }
    });
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

function moveToNextQuestion() {
    // Check if there are more questions
    if (currentQuizData.currentQuestion + 1 < currentQuizData.questions.length) {
        // Move to next question
        currentQuizData.currentQuestion++;
        
        // Re-render the quiz with next question
        renderCurrentQuestion();
    } else {
        // Quiz completed
        showQuizComplete();
    }
}

function renderCurrentQuestion() {
    const question = currentQuizData.questions[currentQuizData.currentQuestion];
    const subjectClass = `${AppState.currentSubject}-quiz`;
    
    const quizContainer = document.querySelector('.question-container');
    
    quizContainer.innerHTML = `
        <div class="question-text">${question.question}</div>
        <div class="options-grid-2col">
            ${question.options.map(opt => `
                <button class="option-btn" onclick="checkAnswer('${opt}', this)">
                    ${opt}
                </button>
            `).join('')}
        </div>
    `;
    
    // Update question counter only (simplified)
    const quizMeta = document.querySelector('.quiz-meta');
    if (quizMeta) {
        quizMeta.innerHTML = `
            <span>Question ${currentQuizData.currentQuestion + 1}/${currentQuizData.questions.length}</span>
            <span>⭐ ${currentQuizData.score}/${currentQuizData.questions.length}</span>
        `;
    }
    
    // Re-enable buttons for new question
    enableAllButtons();
}

function renderCurrentQuestion() {
    const question = currentQuizData.questions[currentQuizData.currentQuestion];
    const subjectClass = `${AppState.currentSubject}-quiz`;
    
    const quizContainer = document.querySelector('.question-container');
    
    quizContainer.innerHTML = `
        <div class="question-text">${question.question}</div>
        <div class="options-grid-2col">
            ${question.options.map(opt => `
                <button class="option-btn" onclick="checkAnswer('${opt}', this)">
                    ${opt}
                </button>
            `).join('')}
        </div>
    `;
    
    // Update question counter
    const quizMeta = document.querySelector('.quiz-meta');
    if (quizMeta) {
        quizMeta.innerHTML = `
            <span>Question ${currentQuizData.currentQuestion + 1}/${currentQuizData.questions.length}</span>
            <span>⭐ Score: ${currentQuizData.score}/${currentQuizData.questions.length}</span>
        `;
    }
    
    // Re-enable buttons for new question
    enableAllButtons();
}

function showQuizComplete() {
    const percentage = Math.round((currentQuizData.score / currentQuizData.questions.length) * 100);
    
    const content = document.getElementById('main-content');
    content.innerHTML = `
        <div class="section-header">
            <button class="back-button" onclick="renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">← Back to levels</button>
        </div>
        <div class="quiz-complete">
            <div class="completion-icon">🏆</div>
            <h2>Quiz Complete!</h2>
            <div class="score-display">
                <span class="score">${currentQuizData.score}/${currentQuizData.questions.length}</span>
                <span class="percentage">${percentage}%</span>
            </div>
            <div class="feedback-message">
                ${getFeedbackMessage(percentage)}
            </div>
            <button class="restart-btn" onclick="restartQuiz()">Try Again</button>
            <button class="continue-btn" onclick="renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">Choose Another Level</button>
        </div>
    `;
    
    // Save progress to Firebase (will implement later)
    saveProgressToFirebase();
}

function getFeedbackMessage(percentage) {
    if (percentage >= 90) return "Excellent! You've mastered this level! 🎉";
    if (percentage >= 70) return "Good job! You're doing great! 👍";
    if (percentage >= 50) return "Keep practicing! You'll get better! 💪";
    return "Don't give up! Try again to improve! 🌱";
}

function restartQuiz() {
    // Reset to first question
    currentQuizData.currentQuestion = 0;
    currentQuizData.score = 0;
    
    // Re-render the quiz
    const subjectClass = `${AppState.currentSubject}-quiz`;
    const content = document.getElementById('main-content');
    
    content.innerHTML = `
        <div class="section-header">
            <button class="back-button" onclick="renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">← Back to levels</button>
        </div>
        <div class="quiz-header">
            <div class="subchapter-title">Quiz - Level ${AppState.currentLevel}</div>
            <div class="quiz-meta">
                <span>Question 1/${currentQuizData.questions.length}</span>
                <span>⭐ Score: 0/${currentQuizData.questions.length}</span>
            </div>
        </div>
        <div class="question-container ${subjectClass}"></div>
    `;
    
    renderCurrentQuestion();
}

function saveProgressToFirebase() {
    // Placeholder - will implement with Firebase later
    console.log('Progress saved for level', AppState.currentLevel, 'Score:', currentQuizData.score);
}

// ===== LOAD QUIZ DATA FROM JSON FILES =====
async function loadQuizData(subjectId, chapterId, subchapterId, level) {
    try {
        // Construct the path to the JSON file
        // Example: data/math/fractions/addition/level1.json
        const path = `data/${subjectId}/${chapterId}/${subchapterId}/level${level}.json`;
        
        console.log('Loading quiz from:', path);
        
        const response = await fetch(path);
        
        if (!response.ok) {
            throw new Error(`Failed to load: ${response.status}`);
        }
        
        const quizData = await response.json();
        
        // Add current question index and score if not present
        quizData.currentQuestion = 0;
        quizData.score = 0;
        
        return quizData;
        
    } catch (error) {
        console.error('Error loading quiz data:', error);
        
        // Return fallback data for testing
        return {
            title: "Sample Quiz",
            level: level,
            totalQuestions: 2,
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
            ],
            currentQuestion: 0,
            score: 0
        };
    }
}

function calculateSubjectProgress(subjectId) {
    // Placeholder - will be replaced with actual progress from Firebase
    return {
        completed: 3,
        total: 8,
        percentage: 37.5
    };
}

function calculateChapterProgress(subjectId, chapterId) {
    return {
        completed: 2,
        total: 4,
        percentage: 50
    };
}

function getLevelProgress(subjectId, chapterId, subchapterId, level) {
    // Placeholder - will check Firebase
    return {
        completed: level === 1,
        started: level === 2,
        score: level === 1 ? 80 : 0
    };
}

function isLevelUnlocked(subjectId, chapterId, subchapterId, level) {
    // Level 1 always unlocked, others depend on previous level completion
    if (level === 1) return true;
    const prevLevel = getLevelProgress(subjectId, chapterId, subchapterId, level - 1);
    return prevLevel.completed;
}

function loadSubjectCSS(subjectId) {
    // Remove any previously loaded subject CSS
    const existing = document.getElementById('subject-css');
    if (existing) existing.remove();
    
    // Load new subject CSS
    const link = document.createElement('link');
    link.id = 'subject-css';
    link.rel = 'stylesheet';
    link.href = `${subjectId}.css`;
    document.head.appendChild(link);
}

function updateHeader(title) {
    const header = document.getElementById('app-header');
    header.innerHTML = `
        <h1>${title}</h1>
        <div class="streak-badge">🔥 0 day streak</div>
    `;
}

function updateBottomNav(activeView) {
    const nav = document.getElementById('bottom-nav');
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
    content.innerHTML = `
        <div style="text-align: center; padding: 40px; color: #ef4444;">
            <p>${message}</p>
            <button onclick="location.reload()" style="margin-top: 20px; padding: 10px 20px;">Retry</button>
        </div>
    `;
}

// ===== NAVIGATION FUNCTIONS =====
window.navigateToSubject = function(subjectId) {
    renderChapters(subjectId);
};

window.navigateToChapter = function(subjectId, chapterId) {
    // For now, just show first subchapter
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

// ===== RENDER SINGLE QUESTION =====
function renderQuestion(question) {
    return `
        <div class="question-text">${question.question}</div>
        <div class="options-grid-2col">
            ${shuffleArray(question.options).map(opt => `
                <button class="option-btn" onclick="checkAnswer('${opt}', this)">
                    ${opt}
                </button>
            `).join('')}
        </div>
    `;
}

// ===== SHUFFLE ARRAY (for randomizing options) =====
function shuffleArray(array) {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
}

// ===== START TIMER FOR CURRENT QUESTION =====
function startTimerForQuestion() {
    // Clear any existing timer
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    // Set initial time
    timeRemaining = currentQuizData.timePerQuestion;
    questionStartTime = Date.now();
    
    const timerBar = document.getElementById('timerBar');
    const timerText = document.getElementById('timerText');
    
    if (!timerBar || !timerText) return;
    
    // Reset timer bar
    timerBar.style.width = '100%';
    timerBar.style.backgroundColor = '#3b82f6';
    
    // Update every 100ms for smooth animation
    questionTimer = setInterval(() => {
        timeRemaining -= 0.1;
        
        if (timeRemaining <= 0) {
            // Time's up!
            clearInterval(questionTimer);
            timerBar.style.width = '0%';
            timerText.textContent = '0s';
            
            // Auto-move to next question with 0 points
            handleTimeOut();
            return;
        }
        
        // Update timer bar width
        const percentage = (timeRemaining / currentQuizData.timePerQuestion) * 100;
        timerBar.style.width = `${percentage}%`;
        
        // Change color as time runs out
        if (percentage < 25) {
            timerBar.style.backgroundColor = '#ef4444'; // Red
        } else if (percentage < 50) {
            timerBar.style.backgroundColor = '#f59e0b'; // Orange
        }
        
        // Update timer text
        timerText.textContent = `${Math.ceil(timeRemaining)}s`;
        
    }, 100);
}

// ===== HANDLE TIME OUT =====
function handleTimeOut() {
    // Disable all buttons
    disableAllButtons();
    
    // Show timeout message
    showFeedback('⏰ Time\'s up! Moving to next question...', 'error');
    
    // Add 0 points for this question
    // (no points added to score)
    
    // Move to next question after delay
    setTimeout(() => {
        moveToNextQuestion();
    }, 1500);
}

// ===== CALCULATE POINTS FOR ANSWER =====
function calculatePoints(timeTaken) {
    const maxPoints = currentQuizData.maxPointsPerQuestion;
    const timeLimit = currentQuizData.timePerQuestion;
    
    // Formula: points = maxPoints * (1 - (timeTaken / timeLimit) * 0.5)
    // This gives:
    // - Instant answer: full points
    // - At time limit: half points
    // - Very slow: minimum 10 points
    
    let points = maxPoints * (1 - (timeTaken / timeLimit) * 0.5);
    
    // Round to nearest integer
    points = Math.round(points);
    
    // Ensure minimum points (10% of max)
    const minPoints = Math.round(maxPoints * 0.1);
    
    return Math.max(minPoints, points);
}

// ===== UPDATED ANSWER CHECKING =====
function checkAnswer(selectedOption, buttonElement) {
    // Stop the timer
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    // Calculate time taken
    const timeTaken = (Date.now() - questionStartTime) / 1000; // in seconds
    
    // Get current question
    const question = currentQuizData.questions[currentQuizData.currentQuestion];
    
    // Check if answer is correct
    const isCorrect = (selectedOption === question.correct);
    
    // Calculate points earned
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
    
    // Update score
    currentQuizData.score += pointsEarned;
    
    // Update score display
    updateScoreDisplay();
    
    // Disable all buttons
    disableAllButtons();
    
    // Move to next question after delay
    setTimeout(() => {
        moveToNextQuestion();
    }, 1500);
}

// ===== UPDATE SCORE DISPLAY =====
function updateScoreDisplay() {
    const quizMeta = document.querySelector('.quiz-meta');
    if (quizMeta) {
        const totalPossible = currentQuizData.questions.length * currentQuizData.maxPointsPerQuestion;
        quizMeta.innerHTML = `
            <span>Question ${currentQuizData.currentQuestion + 1}/${currentQuizData.questions.length}</span>
            <span>⭐ ${currentQuizData.score}/${totalPossible}</span>
        `;
    }
}

// ===== MOVE TO NEXT QUESTION =====
function moveToNextQuestion() {
    // Clear any existing timer
    if (questionTimer) {
        clearInterval(questionTimer);
    }
    
    // Check if there are more questions
    if (currentQuizData.currentQuestion + 1 < currentQuizData.questions.length) {
        // Move to next question
        currentQuizData.currentQuestion++;
        
        // Get next question (randomize from remaining pool if needed)
        const nextQuestion = currentQuizData.questions[currentQuizData.currentQuestion];
        
        // Update question container
        const questionContainer = document.getElementById('questionContainer');
        if (questionContainer) {
            questionContainer.innerHTML = renderQuestion(nextQuestion);
        }
        
        // Update question counter
        updateScoreDisplay();
        
        // Re-enable buttons
        enableAllButtons();
        
        // Start timer for new question
        startTimerForQuestion();
        
    } else {
        // Quiz completed
        showQuizComplete();
    }
}

// ===== SHOW QUIZ COMPLETE =====
function showQuizComplete() {
    // Clear any timer
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
    
    // Save progress to Firebase (will implement later)
    saveProgressToFirebase();
}

// ===== RESTART QUIZ =====
function restartQuiz() {
    // Reset to first question
    currentQuizData.currentQuestion = 0;
    currentQuizData.score = 0;
    
    // Re-render the quiz
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
    
    // Start timer for first question
    startTimerForQuestion();
}

// Make functions globally available
window.renderHome = renderHome;
window.renderChapters = renderChapters;
window.renderLevels = renderLevels;
window.checkAnswer = checkAnswer;
