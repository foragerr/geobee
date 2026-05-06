// Geography Bee Trainer — test suite
// Run: node test.js

const fs = require('fs');

// Mock DOM
const store = {};
global.localStorage = {
  getItem: (k) => store[k] || null,
  setItem: (k, v) => { store[k] = v; },
  removeItem: (k) => { delete store[k]; },
  clear: () => { Object.keys(store).forEach(k => delete store[k]); }
};
global.document = {
  getElementById: () => ({ innerHTML: '', querySelector: () => null }),
  querySelector: () => ({ focus: () => {} }),
  querySelectorAll: () => [],
  addEventListener: () => {}
};
global.window = { scrollTo: () => {} };
global.fetch = (url) => {
  const data = JSON.parse(fs.readFileSync(url, 'utf8'));
  return Promise.resolve({ json: () => Promise.resolve(data) });
};
global.URL = { createObjectURL: () => '', revokeObjectURL: () => {} };
global.Blob = class {};

// Load app.js
const code = fs.readFileSync(__dirname + '/app.js', 'utf8');
const fn = new Function(code);
fn();

// Access globals defined by app.js
const g = (typeof globalThis !== 'undefined') ? globalThis : global;

// We need to eval in a way that exposes the functions — re-approach with vm
const vm = require('vm');
const context = vm.createContext({
  localStorage: global.localStorage,
  document: global.document,
  window: global.window,
  fetch: global.fetch,
  URL: global.URL,
  Blob: global.Blob,
  console,
  Date,
  Math,
  JSON,
  Promise,
  Set,
  Object,
  Array,
  String,
  Number,
  parseInt,
  parseFloat,
  confirm: () => true,
  alert: () => {},
  setTimeout,
  clearTimeout
});
vm.runInContext(code, context);

// --- Test harness ---
let passed = 0, failed = 0;
function assert(cond, msg) {
  if (cond) { passed++; }
  else { failed++; console.error(`  FAIL: ${msg}`); }
}
function test(name, fn) {
  localStorage.clear();
  console.log(`  ${name}`);
  fn();
}

// --- Tests ---

console.log('\nAdaptive Difficulty');

test('bumps difficulty after 3 consecutive correct', () => {
  vm.runInContext(`
    QUESTIONS = [{id:'q1',tags:['a'],difficulty:1,q:'Q1',choices:['a','b','c','d'],answer:0,explanation:''},
                 {id:'q2',tags:['a'],difficulty:1,q:'Q2',choices:['a','b','c','d'],answer:0,explanation:''},
                 {id:'q3',tags:['a'],difficulty:1,q:'Q3',choices:['a','b','c','d'],answer:0,explanation:''},
                 {id:'q4',tags:['a'],difficulty:2,q:'Q4',choices:['a','b','c','d'],answer:0,explanation:''}];
    state.currentUser = 'test';
    state.selectedTopics = [];
    state.questionCount = 4;
    state.difficultyPin = null;
    state.includeMastered = true;
  `, context);
  vm.runInContext(`createUser('test')`, context);
  vm.runInContext(`
    state.selectedTopics = [];
    state.questionCount = 4;
    state.difficultyPin = null;
    state.includeMastered = true;
    startQuiz();
  `, context);

  // Answer 3 correct
  vm.runInContext(`selectAnswer(state.quizQuestions[0].answer); submitAnswer()`, context);
  vm.runInContext(`nextQuestion()`, context);
  vm.runInContext(`selectAnswer(state.quizQuestions[1].answer); submitAnswer()`, context);
  vm.runInContext(`nextQuestion()`, context);
  vm.runInContext(`selectAnswer(state.quizQuestions[2].answer); submitAnswer()`, context);

  const diff = vm.runInContext(`state.currentDifficulty`, context);
  assert(diff === 2, `expected difficulty 2, got ${diff}`);
});

test('wrong answer resets consecutive counter but not difficulty', () => {
  localStorage.clear();
  vm.runInContext(`
    QUESTIONS = [{id:'q1',tags:['a'],difficulty:1,q:'Q1',choices:['a','b','c','d'],answer:0,explanation:''},
                 {id:'q2',tags:['a'],difficulty:1,q:'Q2',choices:['a','b','c','d'],answer:0,explanation:''},
                 {id:'q3',tags:['a'],difficulty:1,q:'Q3',choices:['a','b','c','d'],answer:0,explanation:''},
                 {id:'q4',tags:['a'],difficulty:1,q:'Q4',choices:['a','b','c','d'],answer:0,explanation:''}];
    state.currentUser = 'test2';
  `, context);
  vm.runInContext(`createUser('test2')`, context);
  vm.runInContext(`
    state.selectedTopics = [];
    state.questionCount = 4;
    state.difficultyPin = null;
    state.includeMastered = true;
    state.currentDifficulty = 2;
    state.consecutiveCorrect = 2;
    startQuiz();
    state.currentDifficulty = 2;
    state.consecutiveCorrect = 2;
  `, context);
  vm.runInContext(`selectAnswer(1); submitAnswer()`, context); // wrong (answer is 0)
  const diff = vm.runInContext(`state.currentDifficulty`, context);
  const consec = vm.runInContext(`state.consecutiveCorrect`, context);
  assert(diff === 2, `difficulty should stay at 2, got ${diff}`);
  assert(consec === 0, `consecutive should reset to 0, got ${consec}`);
});

console.log('\nMastery');

test('mastered after 3 correct across 2 sessions', () => {
  localStorage.clear();
  vm.runInContext(`
    QUESTIONS = [{id:'mq1',tags:['a'],difficulty:1,q:'Q',choices:['a','b','c','d'],answer:0,explanation:''}];
    state.currentUser = 'muser';
  `, context);
  vm.runInContext(`createUser('muser')`, context);

  // 2 correct in session 1
  vm.runInContext(`
    var attempts = getAttempts('muser');
    attempts.push({qid:'mq1',ts:1,correct:true,difficulty:1,sessionId:'s1'});
    attempts.push({qid:'mq1',ts:2,correct:true,difficulty:1,sessionId:'s1'});
    saveAttempts('muser', attempts);
  `, context);
  let mastered = vm.runInContext(`isMastered('mq1','muser')`, context);
  assert(!mastered, 'should not be mastered with only 1 session');

  // 1 correct in session 2
  vm.runInContext(`
    var attempts = getAttempts('muser');
    attempts.push({qid:'mq1',ts:3,correct:true,difficulty:1,sessionId:'s2'});
    saveAttempts('muser', attempts);
  `, context);
  mastered = vm.runInContext(`isMastered('mq1','muser')`, context);
  assert(mastered, 'should be mastered: 3 correct across 2 sessions');
});

console.log('\nProficiency');

test('returns null with fewer than 3 samples', () => {
  localStorage.clear();
  vm.runInContext(`
    QUESTIONS = [{id:'p1',tags:['rivers'],difficulty:1,q:'Q',choices:['a','b','c','d'],answer:0,explanation:''}];
    state.currentUser = 'puser';
  `, context);
  vm.runInContext(`createUser('puser')`, context);
  vm.runInContext(`
    var attempts = [{qid:'p1',ts:1,correct:true,difficulty:1,sessionId:'s1'},
                    {qid:'p1',ts:2,correct:false,difficulty:1,sessionId:'s1'}];
    saveAttempts('puser', attempts);
  `, context);
  const prof = vm.runInContext(`computeProficiency('puser','rivers')`, context);
  assert(prof === null, `expected null, got ${prof}`);
});

test('computes correct proficiency from last 20', () => {
  localStorage.clear();
  vm.runInContext(`
    QUESTIONS = [{id:'p1',tags:['rivers'],difficulty:1,q:'Q',choices:['a','b','c','d'],answer:0,explanation:''}];
    state.currentUser = 'puser2';
  `, context);
  vm.runInContext(`createUser('puser2')`, context);
  // 7 correct, 3 wrong = 70%
  vm.runInContext(`
    var attempts = [];
    for (var i = 0; i < 7; i++) attempts.push({qid:'p1',ts:i,correct:true,difficulty:1,sessionId:'s1'});
    for (var i = 0; i < 3; i++) attempts.push({qid:'p1',ts:10+i,correct:false,difficulty:1,sessionId:'s1'});
    saveAttempts('puser2', attempts);
  `, context);
  const prof = vm.runInContext(`computeProficiency('puser2','rivers')`, context);
  assert(prof === 0.7, `expected 0.7, got ${prof}`);
});

console.log('\nStreak');

test('increments streak on consecutive days', () => {
  localStorage.clear();
  vm.runInContext(`createUser('suser')`, context);
  vm.runInContext(`state.currentUser = 'suser'`, context);

  // Simulate yesterday
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  vm.runInContext(`saveStreak('suser', {lastDate:'${yesterday}',current:1,longest:1})`, context);
  vm.runInContext(`updateStreak('suser')`, context);
  const streak = vm.runInContext(`getStreak('suser')`, context);
  assert(streak.current === 2, `expected streak 2, got ${streak.current}`);
  assert(streak.longest === 2, `expected longest 2, got ${streak.longest}`);
});

test('resets streak after gap', () => {
  localStorage.clear();
  vm.runInContext(`createUser('suser2')`, context);
  vm.runInContext(`state.currentUser = 'suser2'`, context);
  vm.runInContext(`saveStreak('suser2', {lastDate:'2020-01-01',current:5,longest:5})`, context);
  vm.runInContext(`updateStreak('suser2')`, context);
  const streak = vm.runInContext(`getStreak('suser2')`, context);
  assert(streak.current === 1, `expected streak reset to 1, got ${streak.current}`);
  assert(streak.longest === 5, `longest should stay 5, got ${streak.longest}`);
});

// Set TOPICS for screens that need rendering
vm.runInContext(`TOPICS = {regions:[],categories:[]}`, context);

console.log('\nUser Management');

test('deleteUser removes all data', () => {
  localStorage.clear();
  vm.runInContext(`createUser('delme')`, context);
  vm.runInContext(`
    saveAttempts('delme', [{qid:'q1',ts:1,correct:true,difficulty:1,sessionId:'s1'}]);
    saveSessions('delme', [{id:'s1',date:'2024-01-01',topics:[],count:1,score:1,peakDiff:1,comfortLevel:1}]);
  `, context);
  vm.runInContext(`deleteUser('delme')`, context);
  const users = vm.runInContext(`getUsers()`, context);
  assert(!users.includes('delme'), 'user should be removed from list');
  const profile = vm.runInContext(`getProfile('delme')`, context);
  assert(profile === null, 'profile should be null');
});

test('resetUserStats clears attempts/sessions/streak but keeps profile', () => {
  localStorage.clear();
  vm.runInContext(`createUser('resetme')`, context);
  vm.runInContext(`state.currentUser = 'resetme'`, context);
  vm.runInContext(`
    saveAttempts('resetme', [{qid:'q1',ts:1,correct:true,difficulty:1,sessionId:'s1'}]);
    saveStreak('resetme', {lastDate:'2024-01-01',current:3,longest:5});
  `, context);
  vm.runInContext(`resetUserStats('resetme')`, context);
  const attempts = vm.runInContext(`getAttempts('resetme')`, context);
  const streak = vm.runInContext(`getStreak('resetme')`, context);
  const profile = vm.runInContext(`getProfile('resetme')`, context);
  assert(attempts.length === 0, 'attempts should be empty');
  assert(streak.current === 0, 'streak should be reset');
  assert(profile !== null, 'profile should still exist');
});

// --- Summary ---
console.log(`\n${passed + failed} tests: ${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
