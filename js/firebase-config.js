// ========================================================
// ASCPT - Firebase Configuration & Initialization
// ========================================================

export const firebaseConfig = {
  apiKey: "AIzaSyCtimWkleez4489bN8Zd6t9mm8-tgcSHzA",
  authDomain: "alex-center-pt.firebaseapp.com",
  projectId: "alex-center-pt",
  storageBucket: "alex-center-pt.firebasestorage.app",
  messagingSenderId: "124623407564",
  appId: "1:124623407564:web:198c3404d78231f1b53569"
};

export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID"
);
