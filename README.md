# GeneralManager

GeneralManager is a personal operating surface for **capturing, resuming, and steering unfinished work** across AI agents, repositories, research, URLs, notes, and ideas.

It is intentionally not an AI-first task manager. The core workflow works without a model or API key; AI is an optional accelerator for specific card-level actions.

## Product model

The default workflow is:

`INBOX → NOW → NEXT → WAITING → LATER → DONE`

The important unit is not the Kanban card itself. It is the **resume point**: enough state, context, links, and one concrete next action to make returning to work cheap.

GeneralManager therefore has two complementary surfaces:

- **Focus** — a reduced NOW / NEXT / WAITING view for daily work.
- **Board** — the full configurable workflow with drag-and-drop and inline capture.

Existing custom boards are preserved. A board that still matches the old default `BACKLOG / ACTIVE / PARKED / DONE` shape receives an explicit upgrade action rather than being silently migrated.

## Current capabilities

- Universal quick capture with explicit, remembered destination.
- Focus and full-board views.
- Draggable cards and editable/reorderable columns.
- First-class `Next action`, blocker/waiting state, working context, primary link, model/tool tag, priority, type, and checklist.
- Search across title, next action, notes, URLs, model/tool, and blockers.
- Stale-work indicators based on last update.
- Side inspector with autosave instead of a mandatory save modal.
- Local deterministic handoff copied from a card without using AI.
- Command palette (`Ctrl/Cmd + K`) for navigation and common actions.
- Archive/restore, JSON export, and replace-or-merge import.
- Firebase email/password authentication and per-user Firestore sync.
- One-time import path for the older browser-local GeneralManager format.

## Optional AI actions

AI is invoked only by explicit user actions. Card-level actions send the active card context rather than the whole board.

- **Refine** — propose a cleaner title, next action, compact notes, blocker, type, and destination. Changes stay in preview until accepted.
- **Resume brief** — produce a compact `WHERE IT STANDS / NEXT MOVE / WATCH OUT` brief.
- **Route** — suggest a workflow state and reason; moving remains explicit.
- **AI handoff** — prepare context for another capable agent.

The browser can call an OpenAI-compatible endpoint configured in Settings. Provider credentials remain in browser `localStorage`; this is convenient for a private personal tool but is **not a secure secret store**.

## Keyboard workflow

- `/` — focus quick capture.
- `Ctrl/Cmd + K` — command palette.
- `F` — Focus view.
- `B` — Board view.
- `Esc` — close the current overlay/inspector/menu.
- `Enter` in quick capture — capture immediately.

## Architecture

The app deliberately stays small:

- `index.html` — static application shell.
- `styles.css` — vNext interface and responsive layout.
- `core.js` — pure board/card domain logic and migrations.
- `app.js` — browser controller and interaction layer.
- `auth.js` — Firebase Authentication UI and lifecycle.
- `db.js` — Firestore persistence, debounced sync, and old LocalStorage import.
- `firebase-config.js` / `firestore.rules` — Firebase client project and user-isolation rules.

There is no framework, bundler, application backend, or server-side AI proxy.

## Run locally

Serve the repository over HTTP:

```bash
python3 -m http.server 8080
```

Then open `http://localhost:8080`.

To use a different Firebase project, follow [`FIREBASE_SETUP.md`](FIREBASE_SETUP.md) and deploy equivalent [`firestore.rules`](firestore.rules).

## Tests

The repository has no runtime dependencies. Node 22 is used for the test suite.

```bash
npm test
```

CI also runs syntax checks and a real headless-Chrome smoke test. The browser test boots the classic auth/persistence scripts, the ES-module controller, and exercises the `Ctrl/Cmd + K` command-palette path through the Chrome DevTools Protocol.

## Data and security boundaries

- Board and archive data are stored under the authenticated Firebase user and depend on correctly deployed Firestore rules for isolation.
- AI requests are made directly by the browser to the configured provider; there is no GeneralManager AI proxy.
- API keys stored in `localStorage` should be treated as personal-device credentials, not enterprise secret storage.
- JSON export intentionally omits the API key.
- AI is optional: capture, search, movement, organization, archive, export/import, and local handoff work without a model.
- A future desktop build should move sensitive provider credentials into an OS-backed secret store rather than copying the browser approach unchanged.

## Product contract

The design rationale and vNext guardrails live in [`GENERAL_MANAGER_VNEXT.md`](GENERAL_MANAGER_VNEXT.md). The main constraint is simple: **reduce reconstruction cost before adding automation**.
