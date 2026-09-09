# GeneralManager — Local-first context & task manager

GeneralManager is a browser-based personal workspace for organizing tasks, research, repositories, URLs, notes, and ideas.

**Current status:** static vanilla HTML/CSS/JavaScript app. No framework, bundler, package manager, or server-side application is required.

## Product behavior

- **Local-first:** the app opens directly into a workspace without an account, registration, email, or login.
- Board and archive data persist in this browser through `localStorage` (`gm_board` and `gm_archive`).
- Cards support drag-and-drop, columns, priorities, URLs, notes, checklists, search, filters, archive/restore, and JSON export/import.
- The desktop board is intentionally horizontal. Small screens show a deliberate message asking users to open the workspace on a larger screen; the board is not compressed into a broken mobile Kanban layout.
- Existing local data is not deleted automatically.

## Optional Firebase sync

Firebase Authentication and Cloud Firestore remain available as an optional sync mode.

- Click **Sign in to sync** when cross-device storage is wanted.
- Authenticated data uses the existing per-user paths:
  - `users/{uid}/data/board`
  - `users/{uid}/data/archive`
- Firestore rules restrict reads and writes to the authenticated user's own documents. See [`firestore.rules`](firestore.rules).
- The signed-in browser loads the cloud workspace once and saves changes with an 800 ms debounce. This repository does **not** implement an `onSnapshot` real-time listener.
- If local data and cloud data both exist, GeneralManager shows an explicit choice. **Import local workspace** requires an additional confirmation when it would replace an existing cloud workspace. **Use synced workspace** leaves the local workspace untouched. There is no automatic merge or destructive migration.
- Signing out returns to the device's local workspace.
- If Firebase is unavailable or not configured for the host, the local workspace remains usable and sync is reported as unavailable.

Firebase setup instructions are in [`FIREBASE_SETUP.md`](FIREBASE_SETUP.md). The Firebase web configuration identifies a client project; it is not a secret. Firestore Rules and Firebase Authentication remain the access-control boundary.

## Optional BYOK AI

The AI assistant is optional and browser-side only.

- Supported request shape: OpenAI-compatible `/chat/completions` endpoints, including the presets shown in the panel and a custom `http(s)` base URL.
- No server-side AI proxy is present.
- The user supplies and pays for any provider/API usage. This repository does not make public provider calls on behalf of users.
- Provider, model, and API key settings are stored in this browser's `localStorage` under `gm_settings`.
- API keys are intentionally excluded from JSON exports and are never written to Firestore by this app. `localStorage` is not a secure secret store: avoid persistent keys on shared browsers.
- A missing key or invalid base URL produces a local explanatory state instead of a request.

## Data boundaries and security notes

- User-created card text is rendered as text, not injected HTML. Imported and stored card URLs are only turned into links when they use `http:` or `https:`. External links opened in a new tab use `noopener noreferrer`.
- JSON import requires at least one valid column and uses an explicit replace-or-merge choice. Malformed imports are rejected without changing the current board.
- Local data is accessible to scripts running in the same browser origin. Do not treat this app as a secure vault for secrets.
- `vercel.json` adds `X-Content-Type-Options`, `Referrer-Policy`, and a restrictive `Permissions-Policy`. No CSP is added because this static app intentionally loads Firebase CDN scripts and user-selected AI endpoints.
- These controls do not replace a deployment-specific Firebase, hosting, or provider security review.

## Run locally

Serve the repository over HTTP (rather than opening `index.html` via `file://`):

```bash
python3 -m http.server 8080
```

Open <http://localhost:8080>. Local mode works without creating an account. Firebase sync requires a configured Firebase project and authorized domain; see [`FIREBASE_SETUP.md`](FIREBASE_SETUP.md).

## Repository files

- `index.html` — UI, styling, desktop/small-screen experience, and CDN script loading.
- `app.js` — board, card, archive, import/export, AI, and workspace lifecycle logic.
- `auth.js` — optional email/password auth and explicit workspace-choice UI.
- `db.js` — optional Firestore read/write wrappers and 800 ms save debounce.
- `firebase-config.js` — public Firebase client configuration with graceful local-mode fallback.
- `firestore.rules` — per-user Firestore access rules.
- `vercel.json` — static SPA rewrite and low-risk response headers.
- `FIREBASE_SETUP.md` — Firebase project and deployment setup.
- `MIGRATION_PLAN.md` — current local-to-cloud choice flow and rollback notes.
- `CHANGELOG.md` — release history and verified behavior.
