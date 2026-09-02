// ========================================================
// PhysioCare - Main Application Coordinator
// ========================================================

import { PWAManager } from './pwa.js';
import { auth } from './auth.js';
import { db } from './db.js';
import { PatientsManager } from './patients.js';
import { SessionsManager } from './sessions.js';
import { FinanceManager } from './finance.js';
import { ExportManager } from './export.js';
import { AuditAndAdminManager } from './audit.js';

class App {
  constructor() {
    this.currentView = 'dashboard';
    this.dialogResolve = null;
  }

  async init() {
    // 1. تفعيل الـ PWA
    PWAManager.init();

    // 2. ضبط عرض التاريخ في لوحة المتابعة
    const dateDisplay = document.getElementById('dashboard-date-display');
    if (dateDisplay) {
      const today = new Date();
      dateDisplay.textContent = today.toLocaleDateString('ar-EG', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }

    // 3. تهيئة مديري الوحدات
    this.patientsManager = new PatientsManager(this);
    this.sessionsManager = new SessionsManager(this);
    this.financeManager = new FinanceManager(this);
    this.exportManager = new ExportManager(this, this.financeManager);
    this.auditManager = new AuditAndAdminManager(this);

    // ربط المديرين بنافذة المتصفح لتعمل الأزرار الداخلية
    window.app = this;
    window.auth = auth;
    window.patientsManager = this.patientsManager;
    window.sessionsManager = this.sessionsManager;
    window.financeManager = this.financeManager;
    window.auditManager = this.auditManager;

    // 4. ربط أحداث التنقل والحوارات
    this.bindNavigation();
    this.bindModalsAndAuth();
    this.bindCustomDialog();

    // 5. تهيئة نظام تسجيل الدخول والمصادقة
    await auth.init(async (user) => {
      await this.refreshAll();
    });

    // 6. تحميل البيانات
    await this.patientsManager.init();
    await this.sessionsManager.init();
    await this.financeManager.init();
    this.exportManager.init();
    await this.auditManager.init();
  }

  bindNavigation() {
    // Desktop Sidebar Links
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Mobile Bottom Nav Items
    document.querySelectorAll('.bottom-nav .b-nav-item').forEach(btn => {
      btn.addEventListener('click', () => {
        const view = btn.getAttribute('data-view');
        this.switchView(view);
      });
    });

    // Logout Buttons
    document.getElementById('btn-logout-mobile')?.addEventListener('click', () => auth.logout());
    document.getElementById('btn-logout-desktop')?.addEventListener('click', () => auth.logout());
  }

  switchView(viewName) {
    this.currentView = viewName;

    // Toggle active classes on view sections
    document.querySelectorAll('.view-section').forEach(sec => sec.classList.remove('active'));
    const targetSection = document.getElementById(`view-${viewName}`);
    if (targetSection) targetSection.classList.add('active');

    // Update active state on Desktop sidebar
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    // Update active state on Mobile bottom nav
    document.querySelectorAll('.bottom-nav .b-nav-item').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-view') === viewName);
    });

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Refresh specific view data if needed
    if (viewName === 'finance') this.financeManager.loadDailyReport();
    if (viewName === 'sessions') this.sessionsManager.loadTodaySessions();
    if (viewName === 'patients') this.patientsManager.loadPatients();
    if (viewName === 'admin') {
      this.auditManager.loadUsers();
      this.auditManager.loadAuditLogs();
    }
  }

  bindModalsAndAuth() {
    // Form Login Submit
    const formLogin = document.getElementById('form-login');
    if (formLogin) {
      formLogin.addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;
        const errMsg = document.getElementById('login-error-msg');

        const result = await auth.login(email, password);
        if (!result.success) {
          errMsg.textContent = result.message;
          errMsg.style.display = 'block';
        } else {
          errMsg.style.display = 'none';
        }
      });
    }

    // Close modal when clicking on backdrop
    document.querySelectorAll('.modal-backdrop').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal && modal.id !== 'modal-auth' && modal.id !== 'modal-custom-dialog') {
          modal.classList.remove('active');
        }
      });
    });
  }

  bindCustomDialog() {
    const btnConfirm = document.getElementById('dialog-btn-confirm');
    const btnCancel = document.getElementById('dialog-btn-cancel');

    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => {
        this.closeModal('modal-custom-dialog');
        if (this.dialogResolve) this.dialogResolve(true);
      });
    }

    if (btnCancel) {
      btnCancel.addEventListener('click', () => {
        this.closeModal('modal-custom-dialog');
        if (this.dialogResolve) this.dialogResolve(false);
      });
    }
  }

  showAlert(message, title = 'تنبيه', type = 'info') {
    return new Promise((resolve) => {
      this.dialogResolve = resolve;
      const modal = document.getElementById('modal-custom-dialog');
      const titleEl = document.getElementById('dialog-title');
      const msgEl = document.getElementById('dialog-message');
      const iconEl = document.getElementById('dialog-icon');
      const btnCancel = document.getElementById('dialog-btn-cancel');
      const btnConfirm = document.getElementById('dialog-btn-confirm');

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (btnCancel) btnCancel.style.display = 'none';
      if (btnConfirm) {
        btnConfirm.textContent = 'حسناً';
        btnConfirm.className = 'btn btn-primary';
      }

      if (iconEl) {
        iconEl.className = `custom-dialog-icon ${type}`;
        if (type === 'warning') iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        else if (type === 'danger') iconEl.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i>';
        else if (type === 'success') iconEl.innerHTML = '<i class="fa-solid fa-circle-check"></i>';
        else iconEl.innerHTML = '<i class="fa-solid fa-circle-info"></i>';
      }

      this.openModal('modal-custom-dialog');
    });
  }

  showConfirm(message, title = 'تأكيد الإجراء') {
    return new Promise((resolve) => {
      this.dialogResolve = resolve;
      const titleEl = document.getElementById('dialog-title');
      const msgEl = document.getElementById('dialog-message');
      const iconEl = document.getElementById('dialog-icon');
      const btnCancel = document.getElementById('dialog-btn-cancel');
      const btnConfirm = document.getElementById('dialog-btn-confirm');

      if (titleEl) titleEl.textContent = title;
      if (msgEl) msgEl.textContent = message;
      if (btnCancel) btnCancel.style.display = 'inline-flex';
      if (btnConfirm) {
        btnConfirm.textContent = 'تأكيد';
        btnConfirm.className = 'btn btn-danger';
      }

      if (iconEl) {
        iconEl.className = 'custom-dialog-icon warning';
        iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
      }

      this.openModal('modal-custom-dialog');
    });
  }

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  showToast(message) {
    const toast = document.getElementById('toast-notification');
    const msgEl = document.getElementById('toast-message');
    if (toast && msgEl) {
      msgEl.textContent = message;
      toast.classList.add('show');
      setTimeout(() => {
        toast.classList.remove('show');
      }, 3000);
    }
  }

  async refreshAll() {
    if (this.patientsManager) await this.patientsManager.loadPatients();
    if (this.sessionsManager) await this.sessionsManager.loadTodaySessions();
    if (this.financeManager) await this.financeManager.loadDailyReport();
  }
}

// تشغيل التطبيق بمجرد اكتمال تحميل الصفحة
document.addEventListener('DOMContentLoaded', () => {
  const app = new App();
  app.init();
});
