# CHANGELOG.md — GeneralManager

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
