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

    // Disable enablePersistence on Safari/iOS to prevent WebKit IndexedDB lockup
    const isIOSorSafari = /iPhone|iPad|iPod/.test(navigator.userAgent) || 
      (/^((?!chrome|android).)*safari/i.test(navigator.userAgent));

    if (!isIOSorSafari) {
      fbFirestore.enablePersistence().catch((err) => {
        console.log('Persistence notice:', err.code);
      });
    }

    console.log('Firebase initialized successfully for ASCPT.');
  } catch (err) {
    console.error('Firebase initialization error:', err);
  }
}

export { fbApp, fbFirestore, fbAuth };
