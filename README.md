# GeneralManager — Context & Task Manager

GeneralManager is a browser-based personal context and task manager for organizing work across AI agents, research, repositories, URLs, notes, and ideas.

**Status:** Implemented static web app with Firebase authentication and per-user Firestore data sync. No build step is required.

**Live deployment (anonymous check):** <https://general-manager-tau.vercel.app>

## Product and current scope

Implemented in this repository:

- Kanban board with editable columns and draggable cards.
- Quick capture, card types, priorities, search, filters, checklists, notes, URLs, duplicate/delete/archive actions, and archive restore.
- JSON import/export and a one-time migration path from older local browser data.
- Email/password sign-up, sign-in, persistence, and sign-out through Firebase Authentication.
- Per-user board and archive persistence through Cloud Firestore.
- Optional browser-side AI assistant panel with OpenAI-compatible, OpenRouter, NVIDIA NIM, or custom endpoints.

Not implemented here:

- A server-side API or AI proxy. AI requests are made by the browser to the endpoint selected by the user.
- A mobile-first layout; the current UI declares a 1024px minimum width.
- A package-manager build, backend service, or automated test suite.

The repository contains `FIREBASE_SETUP.md`, `firestore.rules`, `firebase-config.js`, and `vercel.json` for deployment and Firebase setup. Future backend or mobile work should be treated as planned rather than available functionality.

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
- AI settings, including provider credentials entered in the UI, remain in the browser's `localStorage`. `localStorage` is not a secure secret store; do not use a shared browser or expose long-lived keys unnecessarily.
- The Firebase web configuration identifies a client project but does not replace Authentication or Firestore security rules.
- There is no server-side secret protection, rate limiting, or multi-tenant administration layer in this repository.
- The public deployment is suitable for evaluating the UI, not proof that a custom Firebase project or production security review has been completed.
