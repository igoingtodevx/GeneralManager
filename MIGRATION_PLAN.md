> **Historical development document.** The current product contract is `LIFE_HARNESS.md`; this file is retained for context and must not be treated as current product truth.

# MIGRATION_PLAN.md — GeneralManager localStorage → Firebase

## Old localStorage Behavior

| Key | Content | Written by |
|---|---|---|
| `gm_board` | Full board state: `{ columns[], cards[], meta }` | `saveBoard()` — called from 12+ places (add/edit/delete card, drag-drop, column operations, board title) |
| `gm_settings` | AI API config: `{ baseUrl, apiKey, model }` | `saveSettings()` — AI panel inputs |
| `gm_archive` | Archived cards: `Card[]` | `saveArchive()` — archive/restore/clear operations |

### What each write looked like
```js
// Before
function saveBoard() {
  localStorage.setItem('gm_board', JSON.stringify(board));
}
```

All persistence was synchronous, instant, device-local. No user identity.

---

## New Firebase Architecture

### Authentication
- **Firebase Auth** — email/password
- Auth state persisted in browser via `browserLocalPersistence` (user stays logged in across reloads)
- `onAuthStateChanged` drives the entire app startup: auth modal shown until sign-in succeeds

### Firestore Data Model
```
users/{uid}/data/board   → { columns[], cards[], meta{} }
users/{uid}/data/archive → { cards[] }
```

### Why two flat documents (not subcollections)?
The app holds all board state in a single in-memory JS object. Using two Firestore documents mirrors this structure exactly — zero changes to the render or mutation logic. The practical board size (~200 cards × 500 bytes ≈ 100 KB) is well within Firestore's 1 MB document limit.

### What stays in localStorage
- `gm_settings` — AI API key, model, base URL. These are personal device credentials, not multi-device data. Storing them in Firestore would expose API keys in the database. They remain device-local in `localStorage`.

### Write pattern
```js
// After — Firestore write (debounced 300ms)
function saveBoard() {
  window.GM_DB_SAVE_BOARD(currentUserId, board);
}
```

All writes are **optimistic** (JS state updates first, Firestore saves async). This matches the original pattern and ensures no lag in the UI.

---

## Import Flow (localStorage → Firestore)

### When does the import banner appear?
- After a successful sign-in
- When `localStorage.gm_board` exists AND the `gm_imported_to_firebase` flag is NOT set

### Banner behaviour
1. Banner appears at bottom of screen: "You have N cards saved locally. Import them?"
2. **[Import]**: writes `gm_board` + `gm_archive` to Firestore, removes both localStorage keys, sets `gm_imported_to_firebase = 1`
3. **[Skip]**: sets `gm_imported_to_firebase = 1` and dismisses (never shows again)

### Import logic
- The existing Firestore board (if any) is NOT overwritten — the import only runs when explicitly clicked
- If the user has both Firestore data and localStorage data, the banner is still shown so they can decide

### After import
- `gm_board` and `gm_archive` are removed from localStorage
- `gm_settings` is left untouched (still in localStorage by design)
- `gm_imported_to_firebase` is set in localStorage as a permanent skip flag

---

## Risks & Caveats

| Risk | Mitigation |
|---|---|
| Firestore write lag during rapid drag-and-drop | 300ms debounce — only the final position is saved |
| Board size approaching 1 MB (large archive) | Unlikely in normal use; Export → JSON backup available; can migrate to subcollections later |
| User loses data by clicking Skip on import | Banner shown once; localStorage data still exists until they clear it manually |
| onSnapshot triggering re-render mid-edit | Real-time listener only applies remote changes when `hasPendingWrites === false` AND no modal is open |
| Firebase Auth domain not configured on Vercel | Documented in FIREBASE_SETUP.md — the single most common deployment gotcha |
| API key in firebase-config.js | Firebase client config is a public identifier, not a secret. Firestore Security Rules enforce access control. |
| Existing localStorage users who never sign in | The old localStorage data remains untouched. The app shows the auth modal. They sign up once, import, done. |

---

## Rollback Plan

If anything goes wrong, the original `index.html` is in git history. The new architecture is additive:
- `firebase-config.js`, `auth.js`, `db.js`, `app.js` are new files
- `index.html` only had its `<script>` block replaced — no structural HTML changes
- `gm_settings` in localStorage is unaffected

To roll back: `git checkout index.html` and delete the 4 new JS files.
