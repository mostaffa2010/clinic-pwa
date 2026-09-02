// ========================================================
// ASCPT - Firebase Configuration & Initialization (iOS Compatible)
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

let fbApp = null;
let fbFirestore = null;
let fbAuth = null;

if (typeof window !== 'undefined' && window.firebase && isFirebaseConfigured) {
  try {
    if (!window.firebase.apps || !window.firebase.apps.length) {
      fbApp = window.firebase.initializeApp(firebaseConfig);
    } else {
      fbApp = window.firebase.app();
    }
    fbFirestore = window.firebase.firestore();
    fbAuth = window.firebase.auth();

    // آمن ومتوافق مع وضع Standalone في متصفح Safari على الآيفون
    try {
      fbFirestore.enablePersistence().catch((err) => {
        console.log('Persistence notice:', err.code);
      });
    } catch (e) {
      console.log('Offline persistence not supported in this WebKit environment');
    }

    console.log('Firebase initialized successfully for ASCPT.');
  } catch (err) {
    console.error('Firebase initialization error:', err);
  }
}

export { fbApp, fbFirestore, fbAuth };
