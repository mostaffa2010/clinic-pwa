// ========================================================
// ASCPT - PWA & Service Worker Registration (iOS Safe)
// ========================================================

export class PWAManager {
  static init() {
    // 1. تسجيل الـ Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('ASCPT Service Worker Registered:', reg.scope);
            // فحص وجود تحديثات بهدوء
            reg.update().catch(() => {});
          })
          .catch((err) => {
            console.log('Service Worker registration notice:', err);
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
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      console.log('PWA install prompt ready.');
    });
  }
}
