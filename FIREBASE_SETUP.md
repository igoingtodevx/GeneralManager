# FIREBASE_SETUP.md — GeneralManager

> Release candidate 2.1: this guide predates the reliability pass. Keep the same Firebase project and owner-scoped rules. Review RELEASE_REVIEW.md before deployment. Cloud persistence now uses atomic board/archive transactions and revision checks; no realtime listener or emulator certification is claimed. No secrets or deployed rules were changed by this patch.

## Firebase Services Used

| Service | Purpose |
|---|---|
| Firebase Authentication | Email/password sign-up and login |
| Cloud Firestore | Board data, archive — per-user, synced across devices |

---

## Step 1 — Create a Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Click **Add project**
3. Name it (e.g. `general-manager-app`)
4. Disable Google Analytics if not needed → **Create project**

---

## Step 2 — Enable Authentication

1. In your project → **Build → Authentication**
2. Click **Get started**
3. Under **Sign-in method** → enable **Email/Password**
4. Save

---

## Step 3 — Create a Firestore Database

1. In your project → **Build → Firestore Database**
2. Click **Create database**
3. Choose **Production mode** (you'll add rules in Step 5)
4. Choose your preferred region (e.g. `us-central1` or nearest to your users)
5. Click **Enable**

---

## Step 4 — Register a Web App

1. Project home → click the **`</>`** (Web) icon → **Add app**
2. Give it a nickname (e.g. `GeneralManager Web`)
3. **Do NOT enable Firebase Hosting** (you're using Vercel)
4. Copy the `firebaseConfig` object shown — it looks like:

```js
const firebaseConfig = {
  apiKey:            "<YOUR_API_KEY>",
  authDomain:        "<YOUR_PROJECT_ID>.firebaseapp.com",
  projectId:         "<YOUR_PROJECT_ID>",
  storageBucket:     "<YOUR_PROJECT_ID>.appspot.com",
  messagingSenderId: "<YOUR_SENDER_ID>",
  appId:             "<YOUR_APP_ID>"
};
```

5. Open `firebase-config.js` and paste these values into the `FIREBASE_CONFIG` object.

---

## Step 5 — Firestore Security Rules

In Firebase Console → **Firestore Database → Rules**, paste:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Each user can only read/write their own data
    match /users/{userId}/data/{document} {
      allow read, write: if request.auth != null
                         && request.auth.uid == userId;
    }

    // Deny everything else
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

Click **Publish**.

---

## Firestore Data Structure

```
users/
  {userId}/
    data/
      board    → { columns: [], cards: [], meta: { boardTitle, lastType } }
      archive  → { cards: [] }
```

- One `board` document per user (mirrors the in-memory JS object exactly)
- One `archive` document per user
- Max practical size: ~200 cards × 500 bytes = ~100 KB (well under the 1 MB doc limit)

---

## Required Environment Variables

The Firebase client config is **not secret** — it is safe in your source code. However, if you want to keep it out of version control:

| Variable | Example value |
|---|---|
| (none required) | Paste directly in `firebase-config.js` |

Alternatively, for a cleaner Vercel setup, inject via a `window.__firebaseConfig` script (see Vercel section below).

---

## Step 6 — Vercel Deployment

### 6a. Push to GitHub
```bash
git add .
git commit -m "Add Firebase Auth + Firestore"
git push
```

### 6b. Import to Vercel
1. Go to [vercel.com](https://vercel.com) → **Add New Project**
2. Import your GitHub repo
3. **Framework Preset**: Other (it's a static site)
4. Leave Build Command and Output Directory empty
5. Click **Deploy**

### 6c. Add Authorized Domain in Firebase Auth

> [!IMPORTANT]
> This step is required for login to work on your Vercel domain.

1. Firebase Console → **Authentication → Settings → Authorized domains**
2. Click **Add domain**
3. Add your Vercel domain: e.g. `general-manager.vercel.app`
4. If you have a custom domain: also add `yourdomain.com`

### 6d. (Optional) Environment Variable Injection

If you want to keep `firebase-config.js` clean of values, inject via `vercel.json`:

Create a `public/_headers` or use a Vercel Edge Config. Simpler: just paste the config values directly in `firebase-config.js` — they are public client credentials.

---

## Step 7 — Local Testing

Open `index.html` directly in your browser (via a local HTTP server, not `file://` — Firebase SDK requires HTTP):

```bash
# Using Python (quickest, no install needed)
python -m http.server 8080

# Or using npx serve
npx serve .
```

Then visit `http://localhost:8080`

> [!NOTE]
> Add `localhost` to Firebase Auth → Authorized Domains (it may already be there by default).

---

## Manual Checklist

- [ ] Firebase project created
- [ ] Email/Password Authentication enabled
- [ ] Firestore database created (Production mode)
- [ ] Web App registered → config copied into `firebase-config.js`
- [ ] Firestore Security Rules published
- [ ] App deployed to Vercel
- [ ] Vercel domain added to Firebase Auth → Authorized Domains
- [ ] Tested: sign up, sign in, logout, data persists across reload
- [ ] Tested: import banner works for localStorage migration
