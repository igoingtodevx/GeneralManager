# Firebase Setup — GeneralManager

GeneralManager uses Firebase Authentication and Cloud Firestore for per-user workspace sync. The vNext browser client remains a static deployment; there is no application backend or server-side AI proxy.

## 1. Create / select a Firebase project

Create a Firebase project in the Firebase console, then add a Web app. Copy the generated web configuration into `firebase-config.js`.

The Firebase web configuration is a public client identifier. Security depends on Authentication and Firestore rules, not on hiding this configuration.

## 2. Enable Email/Password Authentication

In Firebase Console:

1. Open **Authentication**.
2. Open **Sign-in method**.
3. Enable **Email/Password**.
4. Add every production/preview domain you actually intend to use under **Authorized domains** when Firebase requires it.

GeneralManager currently blocks workspace access until Firebase reports an authenticated user.

## 3. Create Cloud Firestore

Create a Firestore database. The client stores data under:

```text
users/{uid}/data/board
users/{uid}/data/archive
```

Deploy rules equivalent to the checked-in [`firestore.rules`](firestore.rules) so an authenticated user can only access their own subtree.

Do not use permissive development rules for a public deployment.

## 4. Deploy rules

With the Firebase CLI configured for the target project:

```bash
firebase deploy --only firestore:rules
```

The repository includes `.firebaserc`, `firebase.json`, and `firestore.rules`; verify the selected project before deploying rules.

## 5. Run locally

Serve the repository over HTTP:

```bash
python3 -m http.server 8080
```

Then open:

```text
http://localhost:8080
```

If local authentication is rejected, add `localhost` to Firebase Authentication's authorized domains.

## 6. Vercel / static hosting

No build command is required. The repository is static HTML/CSS/JavaScript and `vercel.json` rewrites requests to `index.html`.

For a preview deployment, remember that Firebase Authentication may require the preview hostname to be authorized before sign-in can succeed. Production merge should not be used as a substitute for preview testing.

## 7. Existing LocalStorage users

When an authenticated account has no Firestore board yet and old `gm_board` data exists in LocalStorage, GeneralManager offers a one-time import. Import writes board/archive data to Firestore and clears the old board/archive LocalStorage keys after success.

`gm_settings` stays device-local by design.

## 8. AI credentials are separate

Optional AI actions call the configured OpenAI-compatible endpoint directly from the browser.

- AI API keys are **not** stored in Firestore.
- The JSON backup intentionally omits the API key.
- The browser currently stores the key in LocalStorage, which is convenient for a personal device but is not a secure secret store.
- A future desktop build should use an OS-backed secret store instead of carrying this mechanism over unchanged.

## 9. Pre-production checks

Before merging a major UI/data-flow change:

- confirm sign-up/sign-in/sign-out on the preview domain;
- verify the workspace reloads from Firestore after a hard refresh;
- edit a card and confirm the save indicator reaches `Synced`;
- confirm another account cannot read the first account's data;
- export a backup and verify it contains no AI API key;
- test old LocalStorage import only with a disposable account/data set;
- verify Firestore rules are the deployed production rules, not only the checked-in file.
