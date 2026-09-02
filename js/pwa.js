// ========================================================
// PhysioCare - PWA & Service Worker Registration
// ========================================================

export class PWAManager {
  static init() {
    // 1. تسجيل الـ Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => {
            console.log('PhysioCare Service Worker Registered successfully:', reg.scope);
          })
          .catch(err => {
            console.log('Service Worker registration failed:', err);
          });
      });
    }

    // 2. مراقبة حالة الاتصال بالإنترنت
    const updateOnlineStatus = () => {
      const isOnline = navigator.onLine;
      const dot = document.getElementById('net-status-dot');
      if (dot) {
        dot.className = isOnline ? 'status-dot' : 'status-dot offline';
        dot.title = isOnline ? 'متصل بالسحابة' : 'وضع غير متصل (حفظ محلي)';
      }
    };

    window.addEventListener('online', updateOnlineStatus);
    window.addEventListener('offline', updateOnlineStatus);
    updateOnlineStatus();

    // 3. دعم زر التثبيت المباشر للـ PWA
    let deferredPrompt;
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      console.log('PWA ready to install.');
    });
  }
}
