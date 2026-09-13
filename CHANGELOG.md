# Changelog

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
- Added stale-work cues based on last meaningful update.
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

## 2026-09 — Firebase account sync

- Added Firebase Authentication with email/password sign-up, sign-in, persistence, and sign-out.
- Added per-user Cloud Firestore persistence for board and archive data.
- Added debounced cloud saves and a small save-state indicator.
- Added one-time import support for older `localStorage` board/archive data.
- Added Firebase setup documentation and Firestore rules.

## Earlier

- Added editable Kanban columns and card drag/reorder.
- Added card types, priorities, notes, URLs, search, filtering, archive/restore, and JSON import/export.
- Added optional browser-side OpenAI-compatible AI actions.
- Added checklist support, column accents, and UI polish.
