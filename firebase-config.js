// firebase-config.js
// Firebase is an optional cloud-sync adapter. Local mode must work when the
// CDN is unavailable or this client config is not configured for the host.
const FIREBASE_CONFIG = {
  apiKey: "«reda...…»",
  authDomain: "general-manager-app.firebaseapp.com",
  projectId: "general-manager-app",
  storageBucket: "general-manager-app.firebasestorage.app",
  messagingSenderId: "399201291171",
  appId: "1:399201291171:web:20d527845652a90056a816",
  measurementId: "G-CW908MTENS"
};

let firebaseApp = null;
let auth = null;
let db = null;

if (typeof firebase !== 'undefined') {
  try {
    firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    auth = firebase.auth();
    db = firebase.firestore();
  } catch (error) {
    console.warn('Firebase sync is unavailable; continuing in local mode.', error);
  }
} else {
  console.warn('Firebase SDK was not loaded; continuing in local mode.');
}
