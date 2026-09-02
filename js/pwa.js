// ========================================================
// PhysioCare - PWA & Auto-Update Service Worker Manager
// ========================================================

export class PWAManager {
  static init() {
    // 1. تسجيل الـ Service Worker مع التحقق الفوري من التحديثات
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => {
            console.log('PhysioCare Service Worker Registered:', reg.scope);
            // فحص التحديثات فورياً في كل مرة يفتح فيها التطبيق
            reg.update();

            reg.addEventListener('updatefound', () => {
              const newWorker = reg.installing;
              if (newWorker) {
                newWorker.addEventListener('statechange', () => {
                  if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('New update available, applying changes...');
                  }
                });
              }
            });
          })
          .catch((err) => {
            console.log('Service Worker registration failed:', err);
          });

        // إعادة تحميل التطبيق تلقائياً عند تفعيل النسخة الجديدة
        let refreshing = false;
        navigator.serviceWorker.addEventListener('controllerchange', () => {
          if (!refreshing) {
            refreshing = true;
            window.location.reload();
          }
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
      console.log('PWA ready to install.');
    });
  }
}
