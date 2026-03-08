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

// ===== GENERIC QUIZ RENDERER - WORKS FOR ALL SUBJECTS =====
function renderGenericQuiz(quizData) {
    const content = document.getElementById('main-content');
    const subjectId = AppState.currentSubject;
    
    // Add subject-specific class to question container for CSS styling
    const subjectClass = `${subjectId}-quiz`;
    
    let html = `
        <div class="section-header">
            <button class="back-button" onclick="renderLevels('${AppState.currentSubject}', '${AppState.currentChapter}', '${AppState.currentSubchapter}')">← Back to levels</button>
        </div>
        <div class="quiz-header">
            <div class="subchapter-title">Quiz - Level ${AppState.currentLevel}</div>
            <div class="quiz-meta">
                <span>Question ${quizData.currentQuestion + 1}/${quizData.questions.length}</span>
                <span>⭐ Score: ${quizData.score || 0}/${quizData.questions.length}</span>
            </div>
        </div>
        <div class="question-container ${subjectClass}">
            <div class="question-text">${quizData.questions[quizData.currentQuestion].question}</div>
            <div class="options-grid-2col">
                ${quizData.questions[quizData.currentQuestion].options.map(opt => `
                    <button class="option-btn" onclick="checkAnswer('${opt}')">
                        ${opt}
                    </button>
                `).join('')}
            </div>
        </div>
    `;
    
    content.innerHTML = html;
    updateHeader(`Level ${AppState.currentLevel}`);
}

// ===== ANSWER CHECKING =====
function checkAnswer(selectedOption) {
    // This will be implemented with actual answer checking
    alert(`Selected: ${selectedOption}`);
}

// ===== HELPER FUNCTIONS =====
function loadQuizData(subjectId, chapterId, subchapterId, level) {
    // This would fetch from JSON file
    // For now, return mock data
    return new Promise(resolve => {
        setTimeout(() => {
            resolve({
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
            });
        }, 500);
    });
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

// Make functions globally available
window.renderHome = renderHome;
window.renderChapters = renderChapters;
window.renderLevels = renderLevels;
window.checkAnswer = checkAnswer;
