# FIREBASE_SETUP.md — Optional GeneralManager sync

GeneralManager is usable without Firebase. Configure Firebase only when you want email/password accounts and per-user cloud sync.

## Services used

- Firebase Authentication: email/password sign-in and sign-up.
- Cloud Firestore: per-user board and archive documents.

There is no server-side AI proxy. AI requests are made directly from the browser to the user-selected OpenAI-compatible endpoint.

## 1. Create a Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Create or select a project.
3. Register a Web App (`</>`). Firebase web configuration values identify the client project; they are not server secrets.

## 2. Enable Authentication

1. Open **Build → Authentication**.
2. Click **Get started**.
3. Enable **Email/Password** under **Sign-in method**.

## 3. Create Firestore

1. Open **Build → Firestore Database**.
2. Create the database in Production mode.
3. Select the desired region.

## 4. Configure the client

Copy the web app's `firebaseConfig` values into `firebase-config.js`.

The app still loads in local mode when the Firebase SDK or client configuration is unavailable. A Firebase initialization error must not be used as evidence that local persistence is broken.

## 5. Publish the rules

Use the rules in [`firestore.rules`](firestore.rules):

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/data/{document} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }

    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

The resulting documents are:

```text
users/{uid}/data/board   → { columns: [], cards: [], meta: {} }
users/{uid}/data/archive → { cards: [] }
```

## 6. Deploy to Vercel

This repository is a static site. Vercel does not need a build command or output directory.

```bash
git push origin feat/public-tool-polish
```

Import the repository into Vercel with Framework Preset **Other**. `vercel.json` supplies the SPA rewrite and these response headers:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

No CSP is included because the app intentionally loads Firebase CDN scripts and sends optional browser-side AI requests to a user-selected endpoint.

## 7. Authorize the deployment domain

In **Authentication → Settings → Authorized domains**, add the Vercel hostname and any custom hostname. `localhost` is usually already present; add it if Firebase rejects local sign-in.

## 8. Verify the optional sync flow

1. Open the app over HTTP, for example `http://localhost:8080`.
2. Confirm the board opens without an account.
3. Create a local card and reload; local data should remain.
4. Click **Sign in to sync**.
5. If local and cloud data both exist, confirm that the explicit workspace choice appears.
6. Import only after reading the replacement confirmation when a cloud workspace already exists.
7. Verify a signed-in edit persists after reload.
8. Sign out and confirm that the device's local workspace is shown again.

## Local server

```bash
python3 -m http.server 8080
```

Open <http://localhost:8080>. No Firebase configuration is required for local mode.
