# GeneralManager — Context & Task Manager

GeneralManager is a browser-based personal context and task manager for organizing work across AI agents, research, repositories, URLs, notes, and ideas.

**Status:** Static personal workspace with Firebase authentication and per-user persistence. Version 2.1 is a release candidate; see [RELEASE_REVIEW.md](RELEASE_REVIEW.md) for verification and outstanding release gates. No build step is required.

**Live deployment (anonymous check):** <https://general-manager-tau.vercel.app>

After deploying 2.1, `?demo=1` opens a temporary synthetic workspace without an account or cloud writes. The deployed version is not verified by the local test suite.

## Product and current scope

Implemented in this repository:

- Kanban board with editable columns and draggable cards.
- Quick capture, card types, priorities, search, filters, checklists, notes, URLs, duplicate/delete/archive actions, and archive restore.
- JSON import/export and a one-time migration path from older local browser data.
- Versioned, bounded import validation and atomic board/archive writes with revision conflict detection.
- A per-user local recovery copy for pending changes; originals survive failed migration.
- Email/password sign-up, sign-in, persistence, and sign-out through Firebase Authentication.
- Per-user board and archive persistence through Cloud Firestore.
- Optional browser-side AI assistant panel with OpenAI-compatible, OpenRouter, NVIDIA NIM, or custom endpoints.

Not implemented here:

- A server-side API or AI proxy. AI requests are made by the browser to the endpoint selected by the user.
- Collaborative realtime editing or automatic merging of concurrent cloud changes. Cloud state loads on sign-in/reload; stale writes are rejected by this client.
- A package-manager build or backend service. A dependency-free Node test suite is included.
- Certified mobile or live Firebase behaviour: responsive CSS is implemented, but browser/emulator validation remains pending for this release candidate.

The repository contains `FIREBASE_SETUP.md`, `firestore.rules`, `firebase-config.js`, and `vercel.json` for deployment and Firebase setup. Backend services remain unimplemented; mobile layout changes still need visual verification.

## Evidence-backed stack

- HTML, CSS, and browser JavaScript; no framework or bundler is present.
- Firebase's browser-compatible SDK for Authentication and Cloud Firestore.
- Vercel static deployment configuration; no build command is needed.

## Run locally

Serve the repository over HTTP (recommended because the app loads external SDK scripts and Firebase resources):

```bash
python3 -m http.server 8080
```

Open <http://localhost:8080> and create or sign in to an account. To use your own Firebase project, follow [`FIREBASE_SETUP.md`](FIREBASE_SETUP.md) and publish rules equivalent to [`firestore.rules`](firestore.rules). The checked-in client configuration is project-specific; replace it when deploying a fork.

## Data and security limitations

- Board and archive data are intended to be isolated per authenticated Firebase user, subject to the deployed Firestore rules.
- AI provider keys stay in memory until reload/sign-out. Only endpoint and model preferences are retained in `localStorage`; upgrading removes legacy stored keys, so enter your key again. The UI confirms board-context transmission before AI actions. Connection tests also contact the selected provider and may incur charges.
- Pending workspace changes are journaled under `gm_recovery_v1_<uid>` in localStorage. Recovery contains plaintext board content; this is not an encrypted vault. Avoid shared browser profiles. Do not clear browser storage before exporting or recovering unsynced changes.
- The Firebase web configuration identifies a client project but does not replace Authentication or Firestore security rules.
- There is no server-side secret protection, rate limiting, or multi-tenant administration layer in this repository.
- The public deployment is suitable for evaluating the UI, not proof that a custom Firebase project or production security review has been completed.

## Verify before deploying

Run `npm test` and `npm run check` (Node 24; no dependencies required). The persistence suite uses a test double, not the Firestore emulator. The optional `tests/browser-smoke.cjs` requires a separately installed Playwright/Chromium environment and is not a completed verification in this workspace. Follow all gates in [RELEASE_REVIEW.md](RELEASE_REVIEW.md), including closing old app tabs before rollout.
