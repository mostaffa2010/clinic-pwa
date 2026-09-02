// ========================================================
// PhysioCare - Firebase Configuration & Initialization
// ========================================================

/*
  خطوات ربط Firebase:
  1. ادخل على https://console.firebase.google.com
  2. أنشئ مشروعاً جديداً وسَمّه مثلاً (physiocare-clinic).
  3. اختر إضافة تطبيق ويب (Web App </>) وانسخ قيم firebaseConfig وضعها بالأسفل.
  4. فعّل Authentication (اختر Email/Password).
  5. فعّل Cloud Firestore (ابدأ في وضع Test Mode).
*/

export const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// فحص ما إذا كان المستخدم قد وضع مفاتيح فايربيز الحقيقية أم لا
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey && 
  firebaseConfig.apiKey !== "YOUR_API_KEY" &&
  firebaseConfig.projectId !== "YOUR_PROJECT_ID"
);
