# Geography Bee Prep App — Implementation Plan

## Context

Building a multi-user Geography Bee flashcard quiz app for 3rd graders. Source material is 4 study guides (Red, White, Gold, Blue sets), national/regional capitals guides, and an existing 115-question HTML quiz. Start as a single HTML page, later package for iOS via Capacitor/WKWebView. All data local (localStorage), no server. Flashcard (multiple-choice) mode only for initial implementation.

---

## File Structure

```
app-bee/
├── index.html          (app shell: HTML + CSS + script tag loading app.js)
├── app.js              (all logic: state, rendering, algorithms)
├── questions.json      (question bank, tagged)
├── topics.json         (topic taxonomy)
└── sources/            (reference material, not loaded at runtime)
```

---

## Data Schemas

### questions.json

```json
{
  "version": 1,
  "questions": [
    {
      "id": "red-africa-001",
      "tags": ["africa", "rivers", "red-set", "egypt"],
      "difficulty": 1,
      "q": "Cairo and Alexandria both sit on what river?",
      "choices": ["Congo", "Nile", "Niger", "Zambezi"],
      "answer": 1,
      "explanation": "The Nile flows about 4,130 miles from East Africa to the Mediterranean. Cairo is near the Nile Delta where the river fans out before reaching the sea."
    }
  ]
}
```

- `id`: stable across updates (never renumber)
- `tags`: multi-dimensional (region + category + source-set)
- `difficulty`: 1 (recall), 2 (connect two facts), 3 (inference/uncommon)
- `explanation`: always educational — shown after both correct and wrong answers

### topics.json

```json
{
  "regions": [
    { "id": "africa", "label": "Africa" },
    { "id": "asia", "label": "Asia" },
    { "id": "oceania", "label": "Australia & Oceania" },
    { "id": "europe", "label": "Europe" },
    { "id": "us-canada", "label": "US & Canada" },
    { "id": "latin-america", "label": "Latin America" }
  ],
  "categories": [
    { "id": "rivers", "label": "Rivers & Lakes" },
    { "id": "mountains", "label": "Mountains & Deserts" },
    { "id": "capitals", "label": "Capitals" },
    { "id": "cities", "label": "Cities & Landmarks" },
    { "id": "countries", "label": "Countries & Borders" },
    { "id": "physical", "label": "Physical Geography" },
    { "id": "islands", "label": "Islands" },
    { "id": "culture", "label": "People & Culture" }
  ]
}
```

Sets (Red/White/Gold/Blue) are kept as tags on questions for internal tracking/filtering but not exposed as user-facing topics.

### localStorage (per user)

```
geobee_users                 → ["alice", "bob"]
geobee_alice_profile         → { name, created, lastActive }
geobee_alice_attempts        → [{ qid, ts, correct, difficulty, sessionId }...]
geobee_alice_sessions        → [{ id, date, topics, mode, count, score, peakDiff, comfortLevel }...]
geobee_alice_streak          → { lastDate, current, longest }
geobee_alice_settings        → { includeMastered: false, difficultyPin: null }
```

Proficiency computed on-the-fly from attempts (not stored separately).
Write to localStorage after every answer (survives mid-quiz tab close).

---

## Algorithms

### Adaptive Difficulty

- Start at difficulty 1
- After 3 consecutive correct: bump up (max 3)
- Wrong answer resets consecutive counter (does NOT decrease level)
- Manual pin overrides adaptive behavior
- If pool is empty at current level, fall back to level below

### Mastery

- Mastered = 3+ correct across 2+ different sessions
- Mastered questions: 5% random inclusion (unless "include mastered" toggled on)
- New questions added later start unrated — no impact on existing proficiency

### Proficiency

- Per tag: rolling window of last 20 attempts on questions with that tag
- Per difficulty: same window scoped to that level
- Weak topic: < 60% accuracy (highlighted on selection screen)
- Display as color-coded bar (red < 50%, yellow 50-70%, green > 70%)

---

## UI Screens

1. **User Select** — pick user or create new
2. **Home** — welcome, streak display, "Start Practice" / "My Stats"
3. **Topic Select** — multi-select topics (with proficiency indicators), question count slider (10-100, default 30), difficulty pin (optional), include-mastered toggle, weak topics highlighted
4. **Quiz** — progress bar, question, 4 choices, explanation after answer, difficulty badge, keyboard shortcuts (1-4, Enter)
5. **Results** — score, peak difficulty, comfortable level, per-topic breakdown, full question review (all questions, grouped correct/wrong, sortable), explanations
6. **Stats** — proficiency bars per topic, per difficulty accuracy, mastery count, streak, session history

---

## Build Sequence

### Phase 1: Core Quiz (implement first)
- `index.html` app shell with embedded CSS
- `app.js` with screen state machine + rendering
- `topics.json`
- `questions.json` — migrate existing 115 questions (add id, tags, difficulty)
- User select/create (localStorage)
- Flashcard quiz flow (question → answer → explanation → next)
- End-of-quiz score display
- Keyboard shortcuts (1-4, Enter)

### Phase 2: Topic Selection & Filtering
- Topic selection screen (multi-select tiles)
- Tag-based question filtering
- Question count slider
- "Random" option

### Phase 3: Difficulty & Mastery
- Adaptive difficulty engine
- Difficulty badge in quiz UI
- Manual difficulty pin on selection screen
- Attempt recording (qid, timestamp, correct, difficulty, sessionId)
- Mastery calculation + filtering

### Phase 4: Review & Proficiency
- End-of-quiz full review (all questions with explanations)
- Peak difficulty / comfortable level reporting
- Per-topic breakdown
- Proficiency calculation from attempts
- Weak topic highlighting on selection screen

### Phase 5: Stats & Streaks
- Stats screen (proficiency bars, mastery count, session history)
- Streak tracking + display on home screen

### Phase 6: Expand Question Bank
- Generate capitals questions from `sources/capitals.txt` (levels 1-5 as flashcards)
- Generate regional capitals questions from `sources/regionalcapital.txt` (US states, provinces)
- Generate questions from "Terms for Further Study" lists in `sources/red.txt`, `sources/white.txt`, `sources/gold.txt`, `sources/blue.txt` (research Wikipedia for each term)
- Tag everything appropriately

### Phase 7: Polish
- Responsive design (mobile-first)
- Accessibility (focus management, aria labels)
- Reset/delete user options
- Export/import user data (JSON backup/restore)
- Persist test suite (node test.js — covers adaptive difficulty, mastery, streak, proficiency threshold)
- Stats view: sort topic proficiency panel by proficiency (weakest first)
- Topic selection screen: show coverage % alongside proficiency %. Formula: `count(distinct qid in user attempts where question has tag) / count(questions with tag)`

### Phase 8: iOS Packaging
- iOS packaging prep (Capacitor)

---

## Verification

- Open `index.html` in browser, complete full flow: create user → select topic → take quiz → review results → check stats
- Test mastery: answer same question correctly 3x across browser refreshes
- Test adaptive: get 3 in a row right, confirm difficulty badge changes
- Test streak: complete quiz, change system date, complete another, verify streak increments
- Test "include mastered" toggle
- Test with topic that has < 10 questions (confirm graceful handling)
- Test on mobile viewport (375px width)

---

## Future Add-on: Tossup Mode (out of scope for now)

Tossup simulates the live competition format: progressive clues revealed one-by-one, student buzzes when confident, answers via free-text input.

Design notes for when we add this:
- Questions get a `clues` array (ordered vague→specific) and `acceptableAnswers` array
- Fuzzy matching: normalize input, check exact/substring/Levenshtein ≤ 2 against acceptable answers
- Self-judge fallback for borderline matches: "You typed X, answer is Y — did you get it right?"
- Scoring: points decrease the later you buzz (N-C+1)*10 for correct, -5 for wrong buzz
- Will need its own question bank (~30+ native tossup questions)
- Mode toggle on topic selection screen
