# Geography Bee Prep App — Handoff Document

## What Was Built

A multi-user Geography Bee flashcard quiz app as a single-page HTML/JS application. No server, no build tools, all state in localStorage. Designed for 3rd graders preparing for the 2025-26 National Geography Bee.

### Files Created

```
app-bee/
├── index.html              (app shell + all CSS)
├── app.js                  (916 lines — state machine, rendering, algorithms)
├── questions.json          (296 questions, tagged and validated)
├── topics.json             (6 regions + 8 categories)
├── test.js                 (node test suite — 16 tests)
├── Makefile                (make test, make serve)
├── PLAN.md                 (implementation plan)
├── sources/
│   ├── red.txt             (reformatted from PDF)
│   ├── white.txt           (reformatted from PDF)
│   ├── gold.txt            (reformatted from PDF)
│   ├── blue.txt            (reformatted from PDF)
│   ├── capitals.txt        (reformatted — national capitals, levels 1-9)
│   ├── regionalcapital.txt (reformatted — US states, provinces, territories)
│   ├── Red.pdf             (original source)
│   ├── White.pdf           (original source)
│   ├── Gold.pdf            (original source)
│   └── Blue.pdf            (original source)
└── geography_bee_flashcard_quiz.html  (original prototype — kept for reference)
```

### What's Implemented (Phases 1-7)

- **Multi-user profiles** — create/switch/delete users, localStorage-backed
- **Topic selection** — multi-select tiles for regions and categories, proficiency color indicators, coverage % shown
- **Question count slider** — 10 to 100, default 30
- **Adaptive difficulty** — starts at level 1, bumps up after 3 consecutive correct, manual pin override
- **Difficulty badge on quiz screen** — shows question difficulty + current adaptive level
- **Mastery model** — 3 correct across 2+ sessions = mastered; mastered questions appear 5% of the time
- **Proficiency tracking** — rolling window of last 20 attempts per tag, minimum 3 samples before showing color judgment
- **Streak tracking** — consecutive practice days, longest streak
- **End-of-quiz review** — score, peak/comfortable difficulty, topic breakdown, All/Missed filter, full question list with explanations
- **Stats screen** — proficiency bars sorted weakest-first, mastery count, streak, session history
- **Keyboard shortcuts** — 1-4 to answer, Enter/Space to advance
- **296 question bank** — validated, all reachable via topic filters
- **Responsive design** — mobile touch targets, small-screen grid collapse, safe-area insets
- **Accessibility** — focus-visible outlines, aria-live region, aria-pressed/aria-label on tiles/choices, focus management on navigation
- **Delete/reset users** — delete profile from user select, reset stats from stats screen (with confirm)
- **Export/import data** — JSON backup download + file-picker restore on stats screen
- **Test suite** — `node test.js` / `make test` — 16 tests covering adaptive difficulty, mastery, proficiency, streaks, user management

### Question Bank Composition

| Source | Count | IDs |
|--------|-------|-----|
| Original study guide facts | 109 | `{set}-{region}-NNN` |
| National capitals (levels 1-5) | 62 | `cap-{region}-NNN` |
| US state capitals | 30 | `uscap-NNN` |
| "Terms for Further Study" (all 4 sets) | 95 | `terms-{set}-NNN` |

Difficulty distribution: L1=163, L2=122, L3=11

---

## Key Design Decisions

1. **No build tools** — vanilla HTML/JS/CSS, works with `file://` and simple HTTP server. Makes iOS packaging via Capacitor trivial.

2. **Dynamic question selection** — instead of pre-shuffling all questions, each next question is picked from the pool at the current adaptive difficulty. Allows difficulty to influence what's served in real time.

3. **Tags over hierarchy** — questions have flat tags rather than a tree structure. A question tagged `["africa", "rivers", "red-set"]` appears when user selects Africa OR Rivers. Simpler filtering logic, more flexible.

4. **Sets not exposed to user** — Red/White/Gold/Blue sets are internal tags only. Students don't need to know which tournament set a question came from.

5. **Minimum sample threshold** — proficiency requires 3+ attempts before showing color-coded judgment. Prevents misleading "0% in Islands" from a single wrong answer.

6. **Proficiency computed on-the-fly** — not stored separately. Avoids sync issues when questions are added/removed. Slight perf cost but negligible for localStorage reads of <1000 records.

7. **Stable question IDs** — IDs never get renumbered. Mastery/attempt records reference IDs, so renaming would orphan history.

8. **Tossup mode deferred** — decided to keep it as a future add-on. Main challenge is free-text answer evaluation without NLP. Planned approach: curated `acceptableAnswers` array + fuzzy matching + self-judge fallback for borderline cases.

---

## Known Issues / TODOs

### Phase 8 (iOS Packaging)
- iOS packaging via Capacitor

### Bugs / Enhancements Noted
- **Small sample misleading stats** — FIXED (minimum 3 samples). But the results page topic breakdown still shows 1/1 or 2/2 entries in grey. Could consider hiding them entirely.
- **Difficulty 3 very sparse** — only 11 questions at level 3. Adaptive engine falls back to level 2 quickly. Need more hard questions.
- **Gold set intended as harder** — per user, Gold should map to difficulty 2-3. Currently mixed. Could audit and bump some up.

### Future Features (discussed but not planned)
- **Tossup mode** — see PLAN.md "Future Add-on" section
- **Spaced repetition** — show weaker questions more frequently (beyond mastery filtering)
- **Starred/bookmarked questions** — manual review lists
- **Challenge mode** — head-to-head against another user on same device

---

## Technical Notes

### Running the App
```bash
cd /Users/rakesh.geddam/gitrepos/app-bee
python3 -m http.server 8080
# Open http://localhost:8080
```

### localStorage Key Pattern
All keys prefixed `geobee_`. Global user list at `geobee_users`. Per-user data at `geobee_{username}_{type}` where type is: profile, attempts, sessions, streak, settings.

### Adding New Questions
1. Add entries to `questions.json` with unique IDs (use the established prefix convention)
2. Ensure at least one tag matches a topic in `topics.json`
3. Set difficulty 1-3
4. Existing user proficiency/mastery unaffected — new questions start as unrated

### Question Validation
```bash
python3 -c "
import json
d = json.load(open('questions.json'))
ids = set()
for q in d['questions']:
    assert q['id'] not in ids, f'duplicate: {q[\"id\"]}'
    ids.add(q['id'])
    assert 0 <= q['answer'] < len(q['choices'])
    assert q['difficulty'] in [1,2,3]
    assert len(q['tags']) > 0
print(f'Valid: {len(ids)} questions')
"
```

### E2E Test (Node.js, no browser needed)
The smoke test from this session can be run to verify core logic (adaptive difficulty, mastery, streak). It mocks DOM/localStorage and exercises the state machine. Worth formalizing into `test.js`.

---

## Decisions for Future Sessions to Be Aware Of

- The `geography_bee_flashcard_quiz.html` file is the ORIGINAL prototype and should not be modified or deleted — it's reference material.
- PDFs are image-based and can't be text-extracted without `poppler`. The text versions in `sources/*.txt` are the authoritative extracted content.
- The user wants the app to eventually be sideloaded on iPhone. Capacitor or WKWebView wrapper is the planned approach. All current code is designed to work in that context (no server dependencies, `fetch` for local JSON files).
- The user prefers concise commits, logical groupings, compact messages, no annotations.
- The user's child is the intended end-user (3rd grader).
