let QUESTIONS = [];
let TOPICS = {};

const SCREENS = {
  USER_SELECT: 'userSelect',
  HOME: 'home',
  TOPIC_SELECT: 'topicSelect',
  QUIZ: 'quiz',
  RESULTS: 'results',
  STATS: 'stats'
};

const state = {
  screen: SCREENS.USER_SELECT,
  currentUser: null,
  // topic selection
  selectedTopics: [],
  questionCount: 30,
  difficultyPin: null,
  includeMastered: false,
  // quiz
  quizQuestions: [],
  quizIdx: 0,
  picked: null,
  revealed: false,
  score: 0,
  sessionId: null,
  currentDifficulty: 1,
  consecutiveCorrect: 0,
  peakDifficulty: 1,
  quizAttempts: [],
  reviewFilter: 'all',
};

// --- Storage helpers ---

function getUsers() {
  return JSON.parse(localStorage.getItem('geobee_users') || '[]');
}

function setUsers(users) {
  localStorage.setItem('geobee_users', JSON.stringify(users));
}

function getUserKey(user, type) {
  return `geobee_${user.toLowerCase().replace(/\s+/g, '_')}_${type}`;
}

function getProfile(user) {
  return JSON.parse(localStorage.getItem(getUserKey(user, 'profile')) || 'null');
}

function saveProfile(user, profile) {
  localStorage.setItem(getUserKey(user, 'profile'), JSON.stringify(profile));
}

function getAttempts(user) {
  return JSON.parse(localStorage.getItem(getUserKey(user, 'attempts')) || '[]');
}

function saveAttempts(user, attempts) {
  localStorage.setItem(getUserKey(user, 'attempts'), JSON.stringify(attempts));
}

function getSessions(user) {
  return JSON.parse(localStorage.getItem(getUserKey(user, 'sessions')) || '[]');
}

function saveSessions(user, sessions) {
  localStorage.setItem(getUserKey(user, 'sessions'), JSON.stringify(sessions));
}

function getStreak(user) {
  return JSON.parse(localStorage.getItem(getUserKey(user, 'streak')) || '{"lastDate":null,"current":0,"longest":0}');
}

function saveStreak(user, streak) {
  localStorage.setItem(getUserKey(user, 'streak'), JSON.stringify(streak));
}

function getSettings(user) {
  return JSON.parse(localStorage.getItem(getUserKey(user, 'settings')) || '{"includeMastered":false,"difficultyPin":null}');
}

function saveSettings(user, settings) {
  localStorage.setItem(getUserKey(user, 'settings'), JSON.stringify(settings));
}

// --- Algorithms ---

function isMastered(qid, user) {
  const attempts = getAttempts(user);
  const qAttempts = attempts.filter(a => a.qid === qid && a.correct);
  if (qAttempts.length < 3) return false;
  const sessions = new Set(qAttempts.map(a => a.sessionId));
  return sessions.size >= 2;
}

function computeProficiency(user, tag) {
  const attempts = getAttempts(user);
  const relevant = attempts.filter(a => {
    const q = QUESTIONS.find(q => q.id === a.qid);
    return q && q.tags.includes(tag);
  });
  const last20 = relevant.slice(-20);
  if (last20.length < 3) return null;
  return last20.filter(a => a.correct).length / last20.length;
}

function updateStreak(user) {
  const streak = getStreak(user);
  const today = new Date().toISOString().slice(0, 10);
  if (streak.lastDate === today) return;

  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  if (streak.lastDate === yesterday) {
    streak.current++;
  } else {
    streak.current = 1;
  }
  streak.lastDate = today;
  if (streak.current > streak.longest) streak.longest = streak.current;
  saveStreak(user, streak);
}

function buildQuizPool() {
  let pool = QUESTIONS;

  if (state.selectedTopics.length > 0) {
    pool = pool.filter(q => q.tags.some(t => state.selectedTopics.includes(t)));
  }

  if (!state.includeMastered) {
    pool = pool.filter(q => {
      if (isMastered(q.id, state.currentUser)) {
        return Math.random() < 0.05;
      }
      return true;
    });
  }

  return shuffle(pool).slice(0, state.questionCount);
}

function getQuestionsAtDifficulty(questions, difficulty) {
  const atLevel = questions.filter(q => q.difficulty === difficulty);
  if (atLevel.length > 0) return atLevel;
  if (difficulty > 1) return getQuestionsAtDifficulty(questions, difficulty - 1);
  return questions;
}

function selectNextQuestion() {
  const remaining = state.quizQuestions.filter((_, i) => i >= state.quizIdx);
  if (state.difficultyPin) {
    return remaining.find(q => q.difficulty === state.difficultyPin) || remaining[0];
  }
  return remaining.find(q => q.difficulty === state.currentDifficulty) ||
    remaining.find(q => q.difficulty <= state.currentDifficulty) ||
    remaining[0];
}

// --- Utilities ---

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function escHtml(s) {
  return String(s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function generateId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

// --- Navigation ---

function navigate(screen) {
  state.screen = screen;
  render();
  window.scrollTo(0, 0);
  const root = document.getElementById('app');
  const focus = root.querySelector('h1, h2, [autofocus]');
  if (focus) focus.focus?.();
}

// --- Actions ---

function createUser(name) {
  const users = getUsers();
  if (!users.includes(name)) {
    users.push(name);
    setUsers(users);
  }
  saveProfile(name, { name, created: new Date().toISOString(), lastActive: new Date().toISOString() });
  state.currentUser = name;
  navigate(SCREENS.HOME);
}

function selectUser(name) {
  state.currentUser = name;
  const profile = getProfile(name);
  if (profile) {
    profile.lastActive = new Date().toISOString();
    saveProfile(name, profile);
  }
  navigate(SCREENS.HOME);
}

function deleteUser(name) {
  const users = getUsers().filter(u => u !== name);
  setUsers(users);
  ['profile', 'attempts', 'sessions', 'streak', 'settings'].forEach(type => {
    localStorage.removeItem(getUserKey(name, type));
  });
  if (state.currentUser === name) state.currentUser = null;
  navigate(SCREENS.USER_SELECT);
}

function resetUserStats(name) {
  ['attempts', 'sessions', 'streak'].forEach(type => {
    localStorage.removeItem(getUserKey(name, type));
  });
  navigate(SCREENS.STATS);
}

function exportUserData(name) {
  const data = {
    exportVersion: 1,
    exportDate: new Date().toISOString(),
    user: name,
    profile: getProfile(name),
    attempts: getAttempts(name),
    sessions: getSessions(name),
    streak: getStreak(name),
    settings: getSettings(name)
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `geobee_${name.toLowerCase().replace(/\s+/g, '_')}_backup.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importUserData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.user || !data.profile) {
        alert('Invalid backup file.');
        return;
      }
      const name = data.user;
      const users = getUsers();
      if (!users.includes(name)) {
        users.push(name);
        setUsers(users);
      }
      saveProfile(name, data.profile);
      if (data.attempts) saveAttempts(name, data.attempts);
      if (data.sessions) saveSessions(name, data.sessions);
      if (data.streak) saveStreak(name, data.streak);
      if (data.settings) saveSettings(name, data.settings);
      state.currentUser = name;
      alert(`Imported data for ${name}.`);
      navigate(SCREENS.STATS);
    } catch {
      alert('Failed to read backup file.');
    }
  };
  reader.readAsText(file);
}

function startQuiz() {
  const pool = buildQuizPool();
  if (pool.length === 0) return;

  state.quizPool = pool;
  state.quizQuestions = [];
  state.quizIdx = 0;
  state.picked = null;
  state.revealed = false;
  state.score = 0;
  state.sessionId = generateId();
  state.currentDifficulty = state.difficultyPin || 1;
  state.consecutiveCorrect = 0;
  state.peakDifficulty = state.currentDifficulty;
  state.quizAttempts = [];
  state.browsing = false;
  state.usedIds = new Set();
  pickNextFromPool();
  navigate(SCREENS.QUIZ);
}

function pickNextFromPool() {
  const available = state.quizPool.filter(q => !state.usedIds.has(q.id));
  if (available.length === 0) return;

  const targetDiff = state.difficultyPin || state.currentDifficulty;
  let candidates = available.filter(q => q.difficulty === targetDiff);
  if (candidates.length === 0) candidates = available.filter(q => q.difficulty <= targetDiff);
  if (candidates.length === 0) candidates = available;

  const orig = candidates[Math.floor(Math.random() * candidates.length)];
  const indices = orig.choices.map((_, i) => i);
  const shuffled = shuffle(indices);
  const pick = {
    ...orig,
    choices: shuffled.map(i => orig.choices[i]),
    answer: shuffled.indexOf(orig.answer)
  };
  state.quizQuestions.push(pick);
  state.usedIds.add(pick.id);
}

function selectAnswer(i) {
  if (state.revealed) return;
  state.picked = i;
  render();
  const submitBtn = document.querySelector('[data-action="submit-answer"]');
  if (submitBtn) submitBtn.focus();
}

function submitAnswer() {
  if (state.revealed || state.picked === null) return;
  state.revealed = true;
  state.browsing = false;

  const q = state.quizQuestions[state.quizIdx];
  const correct = state.picked === q.answer;
  if (correct) {
    state.score++;
    state.consecutiveCorrect++;
    if (!state.difficultyPin && state.consecutiveCorrect >= 3 && state.currentDifficulty < 3) {
      state.currentDifficulty++;
      state.consecutiveCorrect = 0;
      if (state.currentDifficulty > state.peakDifficulty) {
        state.peakDifficulty = state.currentDifficulty;
      }
    }
  } else {
    state.consecutiveCorrect = 0;
  }

  const attempt = {
    qid: q.id,
    ts: Date.now(),
    correct,
    picked: state.picked,
    difficulty: q.difficulty,
    sessionId: state.sessionId
  };
  state.quizAttempts.push(attempt);

  const attempts = getAttempts(state.currentUser);
  attempts.push(attempt);
  saveAttempts(state.currentUser, attempts);

  render();
  const nextBtn = document.querySelector('[data-action="next-question"]');
  if (nextBtn) nextBtn.focus();
}

function nextQuestion() {
  const targetCount = Math.min(state.questionCount, state.quizPool.length);
  const isFrontier = state.quizIdx === state.quizAttempts.length - 1;
  if (isFrontier && state.quizIdx + 1 >= targetCount) {
    finishQuiz();
    return;
  }
  state.quizIdx++;
  if (state.quizIdx < state.quizAttempts.length) {
    restoreQuestionState();
  } else {
    state.browsing = false;
    state.picked = null;
    state.revealed = false;
    if (state.quizIdx >= state.quizQuestions.length) {
      pickNextFromPool();
    }
  }
  render();
}

function prevQuestion() {
  if (state.quizIdx <= 0) return;
  state.browsing = true;
  state.quizIdx--;
  restoreQuestionState();
  render();
}

function restoreQuestionState() {
  const attempt = state.quizAttempts[state.quizIdx];
  state.picked = attempt.picked;
  state.revealed = true;
}

function finishQuiz() {
  updateStreak(state.currentUser);

  const diffAttempts = [1, 2, 3].map(d => {
    const atLevel = state.quizAttempts.filter(a => a.difficulty === d);
    if (atLevel.length === 0) return null;
    return { d, acc: atLevel.filter(a => a.correct).length / atLevel.length };
  }).filter(Boolean);

  const comfortLevel = diffAttempts.filter(x => x.acc >= 0.7).reduce((max, x) => Math.max(max, x.d), 0);

  const session = {
    id: state.sessionId,
    date: new Date().toISOString(),
    topics: state.selectedTopics,
    count: state.quizAttempts.length,
    score: state.score,
    peakDiff: state.peakDifficulty,
    comfortLevel
  };

  const sessions = getSessions(state.currentUser);
  sessions.push(session);
  saveSessions(state.currentUser, sessions);

  navigate(SCREENS.RESULTS);
}

// --- Renderers ---

function renderUserSelect() {
  const users = getUsers();
  const userList = users.map(u =>
    `<div style="display:flex;gap:8px;margin-bottom:8px;align-items:stretch;">
      <button class="user-btn" style="margin-bottom:0;flex:1;" data-action="select-user" data-user="${escHtml(u)}">${escHtml(u)}</button>
      <button data-action="delete-user" data-user="${escHtml(u)}" aria-label="Delete ${escHtml(u)}" style="padding:0 12px;border:1px solid var(--border);border-radius:var(--radius);color:var(--text-tertiary);background:var(--bg);font-size:16px;">&times;</button>
    </div>`
  ).join('');

  return `
    <div class="text-center mb-3">
      <h1 tabindex="-1">Geography Bee Trainer</h1>
      <p class="text-sm text-secondary">Choose your profile to get started</p>
    </div>
    ${userList ? `<div class="mb-3">${userList}</div>` : '<p class="text-sm text-secondary text-center mb-3">No profiles yet. Create one below.</p>'}
    <div class="card">
      <p class="section-label">New profile</p>
      <div style="display:flex;gap:8px;">
        <input id="new-user-input" type="text" placeholder="Your name" style="flex:1;padding:12px;border:1px solid var(--border);border-radius:var(--radius);font-size:15px;outline:none;">
        <button class="btn-primary" style="width:auto;padding:12px 20px;" data-action="create-user">Go</button>
      </div>
    </div>
  `;
}

function renderHome() {
  const streak = getStreak(state.currentUser);
  const streakHtml = streak.current > 0
    ? `<span class="streak-badge">${streak.current} day${streak.current > 1 ? 's' : ''} streak</span>`
    : '';

  const attempts = getAttempts(state.currentUser);
  const totalPracticed = attempts.length;

  return `
    <div class="header-row">
      <button class="header-link" data-action="switch-user">&larr; Switch user</button>
      ${streakHtml}
    </div>
    <div class="mb-3">
      <h1 tabindex="-1">Hi, ${escHtml(state.currentUser)}!</h1>
      <p class="text-sm text-secondary">${totalPracticed} questions practiced total</p>
    </div>
    <div class="flex-gap">
      <button class="btn-primary" data-action="go-topics">Start Practice</button>
      <button class="btn-secondary" data-action="go-stats">My Stats</button>
    </div>
  `;
}

function renderTopicSelect() {
  const allTopics = [...TOPICS.regions, ...TOPICS.categories];
  const userAttempts = getAttempts(state.currentUser);
  const attemptedQids = new Set(userAttempts.map(a => a.qid));
  const tiles = allTopics.map(t => {
    const selected = state.selectedTopics.includes(t.id);
    const prof = computeProficiency(state.currentUser, t.id);
    let profIndicator = '';
    if (prof !== null) {
      const pct = Math.round(prof * 100);
      let color = 'var(--success)';
      if (pct < 50) color = 'var(--danger)';
      else if (pct < 70) color = 'var(--warning)';
      profIndicator = `<span class="text-xs" style="color:${color}">${pct}%</span>`;
    }
    const tagQuestions = QUESTIONS.filter(q => q.tags.includes(t.id));
    const count = tagQuestions.length;
    const covered = tagQuestions.filter(q => attemptedQids.has(q.id)).length;
    const coveragePct = count > 0 ? Math.round(covered / count * 100) : 0;
    return `<button class="topic-tile ${selected ? 'selected' : ''}" data-action="toggle-topic" data-topic="${t.id}" aria-pressed="${selected}" aria-label="${escHtml(t.label)}, ${count} questions, ${coveragePct}% covered${prof !== null ? ', ' + Math.round(prof * 100) + '% proficiency' : ''}">
      <span style="display:flex;justify-content:space-between;align-items:center;">
        <span class="font-medium text-sm">${escHtml(t.label)}</span>
        ${profIndicator}
      </span>
      <span class="text-xs text-tertiary">${count} Qs &middot; ${coveragePct}% seen</span>
    </button>`;
  }).join('');

  const diffOptions = [null, 1, 2, 3].map(d => {
    const label = d === null ? 'Adaptive' : `Level ${d}`;
    const sel = state.difficultyPin === d ? 'selected' : '';
    return `<option value="${d === null ? '' : d}" ${sel}>${label}</option>`;
  }).join('');

  return `
    <div class="header-row">
      <button class="header-link" data-action="go-home">&larr; Back</button>
      <span class="text-sm text-secondary">${QUESTIONS.length} questions in bank</span>
    </div>
    <h1 class="mb-2" tabindex="-1">Choose Topics</h1>
    <p class="text-xs text-tertiary mb-2">Select one or more topics, or leave blank for all.</p>
    <div class="grid-2 mb-3">${tiles}</div>

    <div class="card mb-2">
      <div style="display:flex;justify-content:space-between;align-items:center;" class="mb-1">
        <span class="text-sm font-medium">Questions</span>
        <span class="text-sm font-medium" id="count-display">${state.questionCount}</span>
      </div>
      <div class="slider-container">
        <input type="range" min="10" max="100" step="5" value="${state.questionCount}" data-action="set-count">
      </div>
    </div>

    <div class="card mb-2">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <span class="text-sm font-medium">Difficulty</span>
        <select data-action="set-difficulty" style="padding:6px 10px;border:1px solid var(--border);border-radius:8px;font-size:13px;">
          ${diffOptions}
        </select>
      </div>
    </div>

    <div class="card mb-3">
      <label style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;">
        <span class="text-sm font-medium">Include mastered questions</span>
        <input type="checkbox" ${state.includeMastered ? 'checked' : ''} data-action="toggle-mastered" style="width:18px;height:18px;">
      </label>
    </div>

    <button class="btn-primary" data-action="start-quiz">Start Quiz</button>
  `;
}

function renderQuiz() {
  const q = state.quizQuestions[state.quizIdx];
  const targetCount = Math.min(state.questionCount, state.quizPool.length);
  const pct = Math.round((state.quizIdx / targetCount) * 100);
  const adaptiveLabel = ['', 'Easy', 'Medium', 'Hard'][state.currentDifficulty] || '';
  const qDiffLabel = ['', 'Easy', 'Medium', 'Hard'][q.difficulty] || '';
  const isReview = state.quizIdx < state.quizAttempts.length - 1 || (state.quizIdx < state.quizAttempts.length && state.browsing);
  const isFrontier = !isReview;

  const choices = q.choices.map((c, i) => {
    let cls = 'choice-btn';
    let mark = '';
    if (state.revealed) {
      cls += ' revealed';
      if (i === q.answer) {
        cls += ' correct';
        mark = ' &#10003;';
      } else if (i === state.picked) {
        cls += ' wrong';
        mark = ' &#10007;';
      } else {
        cls += ' dimmed';
      }
    } else if (i === state.picked) {
      cls += ' selected';
    }
    return `<button class="${cls}" ${isReview ? 'disabled' : ''} data-action="pick" data-idx="${i}" aria-label="Choice ${i + 1}: ${escHtml(c)}${state.revealed && i === q.answer ? ', correct answer' : ''}">
      <span class="text-xs text-tertiary" style="margin-right:6px;">${i + 1}.</span>${escHtml(c)}${mark}
    </button>`;
  }).join('');

  let explanation = '';
  if (state.revealed) {
    const isCorrect = state.picked === q.answer;
    explanation = `
      <div class="explanation-box">
        <p class="text-sm font-medium ${isCorrect ? 'text-success' : 'text-danger'} mb-1">
          ${isCorrect ? 'Correct!' : `Not quite — the answer is ${escHtml(q.choices[q.answer])}.`}
        </p>
        <p class="text-sm text-secondary mb-2">${escHtml(q.explanation)}</p>
      </div>
    `;
  }

  let actionBtn = '';
  if (isReview) {
    // Viewing a past question — no submit, just nav
  } else if (!state.revealed) {
    actionBtn = `<button class="btn-primary mt-2" data-action="submit-answer" ${state.picked === null ? 'disabled style="opacity:0.4;cursor:default;"' : ''}>Submit Answer</button>`;
  } else {
    actionBtn = `<button class="btn-primary mt-2" data-action="next-question">${state.quizIdx + 1 >= targetCount ? 'See Results' : 'Continue'}</button>`;
  }

  const canGoBack = state.quizIdx > 0;
  const canGoForward = isReview;
  const navRow = `<div style="display:flex;justify-content:space-between;align-items:center;" class="mt-2">
    <button class="header-link" data-action="prev-question" ${canGoBack ? '' : 'disabled style="opacity:0.3;cursor:default;"'}>&larr; Prev</button>
    <span class="text-xs text-tertiary">${state.quizIdx + 1} / ${targetCount}</span>
    <button class="header-link" data-action="forward-question" ${canGoForward ? '' : 'disabled style="opacity:0.3;cursor:default;"'}>Next &rarr;</button>
  </div>`;

  return `
    <div class="header-row">
      <button class="header-link" data-action="exit-quiz">&larr; Exit</button>
      <span class="text-sm text-secondary">
        <span class="font-medium">${state.quizIdx + 1}</span> / ${targetCount}
      </span>
      <span class="text-sm">
        Score: <span class="font-medium text-success">${state.score}</span>
      </span>
    </div>
    <div class="progress-bar"><div class="progress-fill" style="width:${pct}%"></div></div>
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <span class="difficulty-badge">${qDiffLabel}</span>
        ${!state.difficultyPin ? `<span class="text-xs text-tertiary">Adaptive level: ${adaptiveLabel}</span>` : ''}
      </div>
      <h2 class="mb-2" tabindex="-1">${escHtml(q.q)}</h2>
      <div style="display:flex;flex-direction:column;gap:8px;">
        ${choices}
      </div>
      ${explanation}
      ${actionBtn}
    </div>
    ${navRow}
    <p class="text-xs text-tertiary text-center mt-2">Keys: 1–4 to select, Enter to submit/continue, &larr;/&rarr; to navigate</p>
  `;
}

function renderResults() {
  const total = state.quizAttempts.length;
  const missed = state.quizAttempts.filter(a => !a.correct).length;
  const pct = Math.round((state.score / Math.max(total, 1)) * 100);

  const diffAttempts = [1, 2, 3].map(d => {
    const atLevel = state.quizAttempts.filter(a => a.difficulty === d);
    if (atLevel.length === 0) return null;
    return { d, acc: Math.round(atLevel.filter(a => a.correct).length / atLevel.length * 100) };
  }).filter(Boolean);

  const comfortLevel = diffAttempts.filter(x => x.acc >= 70).reduce((max, x) => Math.max(max, x.d), 0);
  const comfortLabel = ['None', 'Easy', 'Medium', 'Hard'][comfortLevel] || 'None';

  const tagBreakdown = {};
  state.quizAttempts.forEach((a, i) => {
    const q = state.quizQuestions[i];
    q.tags.forEach(tag => {
      if (!tagBreakdown[tag]) tagBreakdown[tag] = { correct: 0, total: 0 };
      tagBreakdown[tag].total++;
      if (a.correct) tagBreakdown[tag].correct++;
    });
  });

  const allTopics = [...TOPICS.regions, ...TOPICS.categories];
  const MIN_SAMPLE = 3;
  const breakdownHtml = Object.entries(tagBreakdown)
    .filter(([tag]) => allTopics.some(t => t.id === tag))
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
    .map(([tag, data]) => {
      const topic = allTopics.find(t => t.id === tag);
      const tagPct = Math.round(data.correct / data.total * 100);
      let color = 'var(--text-tertiary)';
      if (data.total >= MIN_SAMPLE) {
        color = 'var(--success)';
        if (tagPct < 50) color = 'var(--danger)';
        else if (tagPct < 70) color = 'var(--warning)';
      }
      return `<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 0;">
        <span class="text-sm">${escHtml(topic ? topic.label : tag)}</span>
        <span class="text-sm font-medium" style="color:${color}">${tagPct}% (${data.correct}/${data.total})</span>
      </div>`;
    }).join('');

  const reviewFilter = state.reviewFilter || 'all';
  const reviewItems = state.quizQuestions
    .map((q, i) => ({ q, a: state.quizAttempts[i] }))
    .filter(({ a }) => a && (reviewFilter === 'all' || !a.correct));

  const reviewHtml = reviewItems.map(({ q, a }) => {
    const icon = a.correct ? '<span class="text-success">&#10003;</span>' : '<span class="text-danger">&#10007;</span>';
    return `<div class="review-item">
      <div style="display:flex;gap:8px;align-items:start;">
        <span style="margin-top:2px;">${icon}</span>
        <div style="flex:1;">
          <p class="text-sm font-medium">${escHtml(q.q)}</p>
          ${!a.correct ? `<p class="text-xs text-danger">Your answer: ${escHtml(q.choices[a.picked])}</p>` : ''}
          <p class="text-xs text-success">Answer: ${escHtml(q.choices[q.answer])}</p>
          <p class="text-xs text-secondary" style="margin-top:4px;">${escHtml(q.explanation)}</p>
        </div>
      </div>
    </div>`;
  }).join('');

  return `
    <h1 class="mb-1" tabindex="-1">Quiz Complete!</h1>
    <p class="text-sm text-secondary mb-3">${pct >= 90 ? 'Amazing work!' : pct >= 75 ? 'Strong work!' : pct >= 50 ? 'Solid effort!' : 'Keep practicing!'}</p>

    <div class="grid-3 mb-3">
      <div class="stat-card"><div class="value text-success">${state.score}</div><div class="label">Correct</div></div>
      <div class="stat-card"><div class="value text-danger">${missed}</div><div class="label">Missed</div></div>
      <div class="stat-card"><div class="value">${pct}%</div><div class="label">Score</div></div>
    </div>

    <div class="card mb-2">
      <div style="display:flex;justify-content:space-between;" class="mb-1">
        <span class="text-sm">Peak Difficulty</span>
        <span class="text-sm font-medium">${['', 'Easy', 'Medium', 'Hard'][state.peakDifficulty]}</span>
      </div>
      <div style="display:flex;justify-content:space-between;">
        <span class="text-sm">Comfortable Level</span>
        <span class="text-sm font-medium">${comfortLabel}</span>
      </div>
    </div>

    ${breakdownHtml ? `<div class="card mb-2"><p class="section-label">Topic Breakdown</p>${breakdownHtml}</div>` : ''}

    <div class="card mb-3">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
        <p class="section-label" style="margin:0;">Questions</p>
        <div style="display:flex;gap:4px;">
          <button data-action="review-filter" data-filter="all" class="tag" style="cursor:pointer;background:${reviewFilter === 'all' ? 'var(--text)' : 'var(--bg-secondary)'};color:${reviewFilter === 'all' ? 'var(--bg)' : 'var(--text-secondary)'};">All</button>
          <button data-action="review-filter" data-filter="missed" class="tag" style="cursor:pointer;background:${reviewFilter === 'missed' ? 'var(--danger)' : 'var(--bg-secondary)'};color:${reviewFilter === 'missed' ? '#fff' : 'var(--text-secondary)'};">Missed</button>
        </div>
      </div>
      ${reviewHtml}
    </div>

    <div class="flex-gap">
      <button class="btn-primary" data-action="play-again">Play Again</button>
      <button class="btn-secondary" data-action="go-home">Home</button>
    </div>
  `;
}

function renderStats() {
  const attempts = getAttempts(state.currentUser);
  const sessions = getSessions(state.currentUser);
  const streak = getStreak(state.currentUser);

  const allTopics = [...TOPICS.regions, ...TOPICS.categories];
  const profBars = allTopics.map(t => {
    const prof = computeProficiency(state.currentUser, t.id);
    if (prof === null) return null;
    return { label: t.label, prof };
  }).filter(Boolean)
    .sort((a, b) => a.prof - b.prof)
    .map(({ label, prof }) => {
      const pct = Math.round(prof * 100);
      let color = 'var(--success)';
      if (pct < 50) color = 'var(--danger)';
      else if (pct < 70) color = 'var(--warning)';
      return `<div class="mb-1">
        <div style="display:flex;justify-content:space-between;" class="text-xs mb-1">
          <span>${escHtml(label)}</span>
          <span style="color:${color}">${pct}%</span>
        </div>
        <div class="stats-bar"><div class="stats-fill" style="width:${pct}%;background:${color}"></div></div>
      </div>`;
    }).join('');

  const masteredCount = QUESTIONS.filter(q => isMastered(q.id, state.currentUser)).length;

  const recentSessions = sessions.slice(-10).reverse().map(s => {
    const date = new Date(s.date).toLocaleDateString();
    const pct = Math.round(s.score / s.count * 100);
    return `<div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light);">
      <span class="text-xs text-secondary">${date}</span>
      <span class="text-xs">${s.score}/${s.count} (${pct}%)</span>
    </div>`;
  }).join('');

  return `
    <div class="header-row">
      <button class="header-link" data-action="go-home">&larr; Back</button>
      <span class="text-sm font-medium">${escHtml(state.currentUser)}'s Stats</span>
    </div>

    <div class="grid-3 mb-3">
      <div class="stat-card"><div class="value">${attempts.length}</div><div class="label">Practiced</div></div>
      <div class="stat-card"><div class="value">${masteredCount}</div><div class="label">Mastered</div></div>
      <div class="stat-card"><div class="value">${streak.current}</div><div class="label">Streak</div></div>
    </div>

    ${streak.longest > 0 ? `<p class="text-xs text-secondary mb-2">Longest streak: ${streak.longest} day${streak.longest > 1 ? 's' : ''}</p>` : ''}

    ${profBars ? `<div class="card mb-2"><p class="section-label">Proficiency by Topic</p>${profBars}</div>` : ''}

    ${recentSessions ? `<div class="card mb-3"><p class="section-label">Recent Sessions</p>${recentSessions}</div>` : ''}

    <div class="flex-gap mb-2">
      <button class="btn-secondary" data-action="export-data">Export Data</button>
      <button class="btn-secondary" data-action="import-data">Import Data</button>
    </div>
    <input type="file" id="import-file" accept=".json" style="display:none;">
    <button class="btn-secondary" style="color:var(--danger);border-color:var(--danger);" data-action="reset-stats">Reset All Stats</button>
  `;
}

// --- Main render ---

function render() {
  const root = document.getElementById('app');
  switch (state.screen) {
    case SCREENS.USER_SELECT: root.innerHTML = renderUserSelect(); break;
    case SCREENS.HOME: root.innerHTML = renderHome(); break;
    case SCREENS.TOPIC_SELECT: root.innerHTML = renderTopicSelect(); break;
    case SCREENS.QUIZ: root.innerHTML = renderQuiz(); break;
    case SCREENS.RESULTS: root.innerHTML = renderResults(); break;
    case SCREENS.STATS: root.innerHTML = renderStats(); break;
  }
  bindEvents();
}

// --- Event binding ---

function bindEvents() {
  document.querySelectorAll('[data-action]').forEach(el => {
    const action = el.dataset.action;

    if (action === 'create-user') {
      el.onclick = () => {
        const input = document.getElementById('new-user-input');
        const name = input.value.trim();
        if (name) createUser(name);
      };
    } else if (action === 'select-user') {
      el.onclick = () => selectUser(el.dataset.user);
    } else if (action === 'switch-user') {
      el.onclick = () => navigate(SCREENS.USER_SELECT);
    } else if (action === 'go-home') {
      el.onclick = () => navigate(SCREENS.HOME);
    } else if (action === 'go-topics') {
      el.onclick = () => {
        const settings = getSettings(state.currentUser);
        state.includeMastered = settings.includeMastered;
        state.difficultyPin = settings.difficultyPin;
        state.selectedTopics = [];
        navigate(SCREENS.TOPIC_SELECT);
      };
    } else if (action === 'go-stats') {
      el.onclick = () => navigate(SCREENS.STATS);
    } else if (action === 'toggle-topic') {
      el.onclick = () => {
        const topic = el.dataset.topic;
        const idx = state.selectedTopics.indexOf(topic);
        if (idx >= 0) state.selectedTopics.splice(idx, 1);
        else state.selectedTopics.push(topic);
        render();
      };
    } else if (action === 'set-count') {
      el.oninput = () => {
        state.questionCount = parseInt(el.value);
        const display = document.getElementById('count-display');
        if (display) display.textContent = el.value;
      };
    } else if (action === 'set-difficulty') {
      el.onchange = () => {
        state.difficultyPin = el.value ? parseInt(el.value) : null;
      };
    } else if (action === 'toggle-mastered') {
      el.onchange = () => {
        state.includeMastered = el.checked;
      };
    } else if (action === 'start-quiz') {
      el.onclick = () => {
        saveSettings(state.currentUser, {
          includeMastered: state.includeMastered,
          difficultyPin: state.difficultyPin
        });
        startQuiz();
      };
    } else if (action === 'pick') {
      el.onclick = () => selectAnswer(parseInt(el.dataset.idx));
    } else if (action === 'submit-answer') {
      el.onclick = () => submitAnswer();
    } else if (action === 'next-question') {
      el.onclick = () => nextQuestion();
    } else if (action === 'prev-question') {
      el.onclick = () => prevQuestion();
    } else if (action === 'forward-question') {
      el.onclick = () => nextQuestion();
    } else if (action === 'exit-quiz') {
      el.onclick = () => {
        if (state.quizAttempts.length > 0) finishQuiz();
        else navigate(SCREENS.HOME);
      };
    } else if (action === 'play-again') {
      el.onclick = () => startQuiz();
    } else if (action === 'review-filter') {
      el.onclick = () => {
        state.reviewFilter = el.dataset.filter;
        render();
      };
    } else if (action === 'delete-user') {
      el.onclick = () => {
        if (confirm(`Delete profile "${el.dataset.user}" and all their data?`)) {
          deleteUser(el.dataset.user);
        }
      };
    } else if (action === 'reset-stats') {
      el.onclick = () => {
        if (confirm('Reset all stats? This clears attempts, sessions, and streaks.')) {
          resetUserStats(state.currentUser);
        }
      };
    } else if (action === 'export-data') {
      el.onclick = () => exportUserData(state.currentUser);
    } else if (action === 'import-data') {
      el.onclick = () => document.getElementById('import-file').click();
    }
  });

  const input = document.getElementById('new-user-input');
  if (input) {
    input.onkeydown = (e) => {
      if (e.key === 'Enter') {
        const name = input.value.trim();
        if (name) createUser(name);
      }
    };
  }

  const importFile = document.getElementById('import-file');
  if (importFile) {
    importFile.onchange = (e) => {
      if (e.target.files[0]) importUserData(e.target.files[0]);
    };
  }
}

// --- Keyboard shortcuts ---

document.addEventListener('keydown', (e) => {
  if (state.screen !== SCREENS.QUIZ) return;
  const isReview = state.browsing;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    prevQuestion();
  } else if (e.key === 'ArrowRight' && isReview) {
    e.preventDefault();
    nextQuestion();
  } else if (!isReview && !state.revealed && ['1', '2', '3', '4'].includes(e.key)) {
    selectAnswer(parseInt(e.key) - 1);
  } else if (!isReview && !state.revealed && (e.key === 'Enter' || e.key === ' ') && state.picked !== null) {
    e.preventDefault();
    submitAnswer();
  } else if (!isReview && state.revealed && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    nextQuestion();
  }
});

// --- Init ---

async function init() {
  try {
    const [questionsRes, topicsRes] = await Promise.all([
      fetch('questions.json'),
      fetch('topics.json')
    ]);
    const questionsData = await questionsRes.json();
    QUESTIONS = questionsData.questions;
    TOPICS = await topicsRes.json();
  } catch (e) {
    document.getElementById('app').innerHTML = '<p style="color:var(--danger);padding:2rem;">Failed to load data. Make sure questions.json and topics.json are in the same folder as index.html.</p>';
    return;
  }
  render();
}

init();
