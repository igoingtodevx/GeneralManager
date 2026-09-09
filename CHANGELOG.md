# CHANGELOG.md — GeneralManager

## Unreleased — Public local-first tool polish

### Changed

- App startup is now **local-first**. A new visitor enters a local workspace immediately; Firebase Authentication is optional and no longer gates the board.
- Board and archive persistence work in local mode through `gm_board` and `gm_archive` in browser `localStorage`.
- Added **Sign in to sync** as an explicit optional cloud path. Existing per-user Firestore documents remain unchanged.
- Added an explicit local/cloud workspace choice when both sides contain data. Importing into an existing cloud workspace requires confirmation; no automatic merge or destructive migration runs.
- Signing out returns to the local workspace on the device.
- Firebase initialization and cloud errors now fall back to local mode instead of preventing the app from opening.
- Added a small-screen experience explaining that the full board is designed for desktop workspaces.
- Added a short AI API-key notice. Provider, model, and API key remain device-local; API keys are not exported or written to Firestore.
- Added HTTP(S) endpoint validation for browser-side AI requests and safer rendering for imported card URLs.
- Added low-risk Vercel response headers: `X-Content-Type-Options`, `Referrer-Policy`, and `Permissions-Policy`.
- Reduced decorative glow/gradient treatment in favor of a calmer workspace hierarchy while preserving the existing board structure.

### Bug fixes

- The last board column can no longer be deleted. The context menu explains why, and the guard also protects direct calls.
- Quick Capture and archive restore ensure that a valid column exists before using a column fallback.
- JSON import rejects missing or empty column arrays and validates imported board structure before replacing or merging.
- Cloud/local board data is normalized so missing metadata and invalid references do not crash the renderer.

### Documentation corrections

- Removed the inaccurate `onSnapshot` real-time-sync claim. The current implementation performs a Firestore read on workspace load and debounced writes while editing.
- Corrected the debounce description from 300 ms to the actual 800 ms used by `db.js`.
- Corrected the Vercel security-header claim to match the headers now present in `vercel.json`.

## [2.0.0] — 2026-06-22 — Firebase Migration

- Added Firebase email/password Authentication and per-user Firestore persistence.
- Moved the original single-file app into `app.js`, with `auth.js`, `db.js`, and `firebase-config.js` adapters.
- Preserved browser-local AI settings and the original board/card/archive feature set.

## [1.x] — 2026-06-22 — Initial Release

- Single-file vanilla Kanban board.
- Browser-local persistence for board, archive, and AI settings.
- Firebase-free, static-file deployment model.
