# CHANGELOG.md — GeneralManager

## Unreleased — General Manager vNext

### Product model
- Reframed GeneralManager from a Kanban board with an AI sidebar into a personal operating surface for capture, resume, and steering.
- Added a reduced Focus view centered on NOW / NEXT / WAITING.
- Fresh workspaces use INBOX / NOW / NEXT / WAITING / LATER / DONE.
- Existing custom boards stay intact; the exact old default board gets an explicit upgrade action instead of a silent migration.

### Capture and resume
- Quick Capture now has an explicit destination and remembers the last destination.
- Added first-class `Next action` and blocker/waiting context.
- Replaced the card save modal with an autosaving side inspector.
- Added per-column inline capture.
- Added stale-work cues based on last update.
- Added deterministic local card handoffs that require no model or API key.
- Added a command palette and keyboard-first navigation.

### Optional AI
- Replaced board-chat-first AI with explicit card-level actions: Refine, Resume brief, Route, and AI handoff.
- Card AI actions send only the active card context.
- Refine and Route are previews until the user explicitly applies/moves.
- Manual capture, organization, search, movement, handoff, archive, and backup remain fully usable without AI.

### Reliability and structure
- Split pure board/card behavior into `core.js`.
- Added Node-native domain tests with no runtime dependencies.
- Added syntax checks and a real headless-Chrome runtime smoke test in GitHub Actions.
- Added an explicit persistence compatibility boundary between classic Firebase scripts and the ES-module controller.
- Moved the vNext interface into `styles.css` and removed the old desktop-only 1024px minimum-width shell.

### Data / security
- JSON export continues to omit the API key.
- Provider credentials remain browser-local for now; a future desktop build should use OS-backed secret storage.

---

## [2.0.0] — 2026-06-22 — Firebase Migration

### Added
- **Firebase Authentication** — email/password sign-up and login
  - Premium dark auth modal with login/signup tab switcher
  - Persistent auth state (user stays signed in across page reloads)
  - User email display + Sign Out button in top bar
  - Friendly error messages for all common auth failures
- **Cloud Firestore persistence** — board data syncs across all devices
  - Per-user data isolation (`users/{uid}/data/board` + `users/{uid}/data/archive`)
  - Optimistic writes (UI updates instantly; Firestore save is async + debounced 300ms)
  - Real-time multi-tab/device sync via `onSnapshot` listener
  - Visual save indicator in top bar (⟳ Saving… → ✓ Saved)
- **One-time localStorage → Firestore import**
  - Auto-detected on first sign-in if `gm_board` exists in localStorage
  - Non-destructive banner UI (Import / Skip)
  - Clears `gm_board` and `gm_archive` from localStorage after successful import
  - `gm_settings` (AI API config) remains device-local by design
- **New files**:
  - `firebase-config.js` — Firebase app initialization
  - `auth.js` — Auth modal + state listener
  - `db.js` — Firestore read/write wrappers with debouncing + save indicator
  - `app.js` — Application logic (extracted from `index.html`)
  - `vercel.json` — Vercel SPA rewrite + security headers
  - `.env.example` — Environment variable template
  - `FIREBASE_SETUP.md` — Full setup guide with security rules + Vercel steps
  - `MIGRATION_PLAN.md` — Architecture migration documentation
  - `CHANGELOG.md` — This file

### Changed
- `index.html` — `<script>` block replaced with Firebase CDN + 4 module `<script>` tags
  - All HTML, CSS, and UI structure is **unchanged**
  - Application initialisation is now async (waits for Firebase auth before loading data)
- `saveBoard()` and `saveArchive()` now write to Firestore instead of localStorage
- `loadBoard()` and `loadArchive()` now read from Firestore instead of localStorage
- App startup blocks on auth state — unauthenticated users see the auth modal, not the board

### Unchanged
- All board, card, column, and archive UX is identical to v1.x
- Drag-and-drop, context menus, modals, filters, search — all unchanged
- AI panel (API key, model, prompts, streaming) — unchanged; API config stays in localStorage
- Import/Export JSON (backup and restore) — unchanged
- Keyboard shortcuts (`/`, `A`, `Escape`) — unchanged
- CSS and visual design — unchanged

### Security
- Firestore Security Rules ensure each user can only read/write their own data
- Firebase client config (apiKey, projectId, etc.) is a public identifier — not a secret
- AI API key stays in `localStorage` (never sent to Firestore)

---

## [1.x] — 2026-06-22 — Initial Release

- Single-file (`index.html`) vanilla Kanban board
- localStorage persistence for board, archive, AI settings
- Firebase-free, works offline, deployable as a static file
