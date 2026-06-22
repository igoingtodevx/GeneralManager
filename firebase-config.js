const firebaseConfig = {
  apiKey: "AIzaSyBeXDnYD7Oa6CISrPlFPetO1vzLtlryOeg",
  authDomain: "general-manager-app.firebaseapp.com",
  projectId: "general-manager-app",
  storageBucket: "general-manager-app.firebasestorage.app",
  messagingSenderId: "399201291171",
  appId: "1:399201291171:web:20d527845652a90056a816",
  measurementId: "G-CW908MTENS"
};

// Initialize Firebase using the Compat SDK
const app = firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();
