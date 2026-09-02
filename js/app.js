// ========================================================
// ASCPT - Main Application Coordinator
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

    // ربط مبكر وفوري لضمان عمل كافة الأزرار بدون أي تأخير
    window.app = this;
    window.auth = auth;
    this.patientsManager = new PatientsManager(this);
    this.sessionsManager = new SessionsManager(this);
    this.financeManager = new FinanceManager(this);
    this.exportManager = new ExportManager(this, this.financeManager);
    this.auditManager = new AuditAndAdminManager(this);

    window.patientsManager = this.patientsManager;
    window.sessionsManager = this.sessionsManager;
    window.financeManager = this.financeManager;
    window.exportManager = this.exportManager;
    window.auditManager = this.auditManager;
  }

  async init() {
    // 1. تفعيل PWA
    PWAManager.init();

    // 2. ضبط عرض التاريخ
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

    // 3. ربط أحداث التنقل والحوارات
    this.bindNavigation();
    this.bindHardwareBackButton();
    this.disablePullToRefresh();
    this.updateTrainingModeUI();
    this.bindModalsAndAuth();
    this.bindCustomDialog();

    // 4. تهيئة المصادقة
    await auth.init(async (user) => {
      await this.refreshAll();
    });

    // 5. تحميل الوحدات
    await this.populateDoctorDropdowns();
    await this.patientsManager.init();
    await this.sessionsManager.init();
    await this.financeManager.init();
    this.exportManager.init();
    await this.auditManager.init();

    // مزامنة أزرار القوائم المخصصة
    ['patient-filter-type', 'session-doctor-select', 'finance-doctor-filter', 'newuser-role', 'p-doctor'].forEach(id => {
      this.updateCustomSelectDisplay(id);
    });

    // توجيه أي تنبيهات لتبدو بهوية التطبيق المخصصة
    window.alert = (msg) => this.showAlert(msg, 'تنبيه المركز', 'info');
    window.confirm = (msg) => this.showConfirm(msg, 'تأكيد الإجراء');

    console.log('ASCPT Application fully initialized with custom pickers and dialogs.');
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

  switchView(viewName, isBackNavigation = false) {
    if (this.currentView === viewName && !isBackNavigation) return;

    if (!isBackNavigation) {
      const depth = (history.state?.depth || 0) + 1;
      history.pushState({ view: viewName, depth }, '');
    }

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

  // ================= Disable Pull-To-Refresh on Mobile =================
  disablePullToRefresh() {
    // منع سحب المتصفح عبر معايير CSS القياسية دون حظر لمسات iOS
    document.documentElement.style.overscrollBehaviorY = 'none';
    document.body.style.overscrollBehaviorY = 'none';
  }

  // ================= Hardware Back Button & Mobile Gestures =================
  bindHardwareBackButton() {
    // ضبط الحالة المبدئية للشاشة الرئيسية
    if (!history.state) {
      history.replaceState({ view: 'dashboard', depth: 0 }, '');
    }

    window.addEventListener('popstate', async (event) => {
      // 1. إذا كانت هناك أي نافذة منبثقة أو قائمة مفتوحة، نغلقها فقط
      const activeModal = document.querySelector('.modal-backdrop.active:not(#modal-auth)');
      if (activeModal) {
        activeModal.classList.remove('active');
        return;
      }

      // 2. إذا كانت هناك شاشة سابقة في سجل التنقل
      if (event.state && event.state.view) {
        if (event.state.view !== this.currentView) {
          this.switchView(event.state.view, true);
        }
      } else {
        // 3. وصل إلى الشاشة الرئيسية (Dashboard) ويريد الخروج من التطبيق
        if (this.currentView === 'dashboard') {
          const wantExit = await this.showConfirm(
            'هل ترغب في الخروج من تطبيق ASCPT وإغلاقه؟',
            'تأكيد الخروج'
          );
          if (wantExit) {
            // الخروج الفعلي
            history.back();
          } else {
            // البقاء داخل التطبيق واستعادة الحالة
            history.pushState({ view: 'dashboard', depth: 0 }, '');
          }
        } else {
          // العودة للشاشة الرئيسية
          this.switchView('dashboard', true);
        }
      }
    });
  }

  // ================= Sandbox & Training Mode =================
  updateTrainingModeUI() {
    const isTraining = db.isTraining;
    const banner = document.getElementById('sandbox-banner');
    if (banner) banner.style.display = isTraining ? 'flex' : 'none';

    // في وضع التدريب نخفي زر التدريب العلوي لتوفير مساحة لأن الشريط السفلي يحتوي على زر الخروج
    const mBtn = document.getElementById('btn-toggle-training-mobile');
    if (mBtn) mBtn.style.display = isTraining ? 'none' : 'inline-flex';

    const dText = document.getElementById('training-btn-text-desktop');
    if (dText) dText.textContent = isTraining ? 'الخروج من التدريب (بيانات حقيقية)' : 'تفعيل الوضع التدريبي (Sandbox)';
  }

  async toggleTrainingMode(forceState = null) {
    const nextState = forceState !== null ? forceState : !db.isTraining;
    db.setTrainingMode(nextState);

    this.updateTrainingModeUI();

    if (nextState) {
      this.showToast('تم تفعيل الوضع التدريبي بنجاح - بيانات آمنة للشرح والتجربة');
    } else {
      this.showToast('تم الرجوع إلى قاعدة بيانات ASCPT السحابية الحقيقية');
    }

    await this.refreshAll();
  }

  async resetTrainingData() {
    const confirmed = await this.showConfirm(
      'هل ترغب في إعادة تعيين عينات التدريب الافتراضية (المرضى والجلسات التجريبية للشرح)؟',
      'إعادة ضبط عينات التدريب'
    );
    if (confirmed) {
      db.initSandboxData(true);
      await this.refreshAll();
      this.showToast('تمت استعادة عينات التدريب بنجاح');
    }
  }

  // ================= Backup & Restore =================
  async downloadBackup() {
    try {
      const backup = await db.createFullBackup();
      const str = JSON.stringify(backup, null, 2);
      const blob = new Blob([str], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      const dateStr = new Date().toISOString().split('T')[0];
      a.href = url;
      a.download = `نسخة_احتياطية_ASCPT_${dateStr}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.showToast('تم تنزيل النسخة الاحتياطية بنجاح');
    } catch (err) {
      this.showAlert('تعذر إنشاء النسخة الاحتياطية: ' + err.message, 'خطأ', 'danger');
    }
  }

  triggerRestoreBackup() {
    const input = document.getElementById('backup-file-input');
    if (input) input.click();
  }

  async handleFileRestore(event) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      const confirmed = await this.showConfirm(
        `هل أنت متأكد من استعادة النسخة الاحتياطية المؤرخة في: ${data.timestamp || 'غير محدد'}؟ سيتم دمج وتحديث السجلات.`,
        'تأكيد استعادة البيانات'
      );

      if (confirmed) {
        await db.restoreFromBackup(data);
        await this.refreshAll();
        this.showToast('تمت استعادة البيانات بنجاح');
      }
    } catch (err) {
      this.showAlert('فشلت استعادة البيانات: ' + err.message, 'خطأ في الملف', 'danger');
    } finally {
      event.target.value = '';
    }
  }

  // اختصارات مباشرة للأزرار
  exportToExcel() {
    if (this.exportManager) this.exportManager.exportToExcel();
  }

  printReport() {
    if (this.exportManager) this.exportManager.printReport();
  }

  openAddExpenseModal() {
    if (this.financeManager) this.financeManager.openAddExpenseModal();
  }

  openAddPatientModal() {
    if (this.patientsManager) this.patientsManager.openAddModal();
  }

  // ================= Custom Picker Management =================
  openCustomPicker(selectId, modalTitle = 'اختر من القائمة') {
    const select = document.getElementById(selectId);
    if (!select) return;

    const titleEl = document.getElementById('custom-picker-title');
    if (titleEl) titleEl.innerHTML = `<i class="fa-solid fa-list-check"></i> ${modalTitle}`;

    const container = document.getElementById('custom-picker-list');
    if (!container) return;

    const options = Array.from(select.options);
    const currentVal = select.value;

    container.innerHTML = options.map((opt) => {
      const isSelected = opt.value === currentVal;
      return `
        <div class="custom-picker-row ${isSelected ? 'active-choice' : ''}" onclick="app.selectCustomOption('${selectId}', '${opt.value.replace(/'/g, "\'")}')">
          <span>${opt.text}</span>
          ${isSelected ? '<i class="fa-solid fa-check check-icon"></i>' : ''}
        </div>
      `;
    }).join('');

    this.openModal('modal-custom-picker');
  }

  selectCustomOption(selectId, value) {
    const select = document.getElementById(selectId);
    if (!select) return;

    select.value = value;
    select.dispatchEvent(new Event('change', { bubbles: true }));
    this.updateCustomSelectDisplay(selectId);
    this.closeModal('modal-custom-picker');
  }

  updateCustomSelectDisplay(selectId) {
    const select = document.getElementById(selectId);
    const btn = document.getElementById(`btn-select-${selectId}`);
    if (!select || !btn) return;

    const textSpan = btn.querySelector('.btn-text');
    if (textSpan) {
      const selectedOpt = select.options[select.selectedIndex];
      textSpan.textContent = selectedOpt ? selectedOpt.text : '-- اختر --';
    }
  }

  showAlert(message, title = 'تنبيه المركز', type = 'info') {
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
    if (modal) {
      modal.classList.add('active');
      if (modalId !== 'modal-auth' && modalId !== 'modal-custom-dialog') {
        history.pushState({ modal: modalId, view: this.currentView }, '');
      }
    }
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('active');
      if (history.state && history.state.modal === modalId) {
        history.back();
      }
    }
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

  async handleClearDemoData() {
    const confirmed = await this.showConfirm(
      'هل أنت متأكد من مسح جميع المرضى والجلسات والمصروفات الافتراضية القديمة للبدء بسجل حقيقي فارغ؟',
      'تأكيد تنظيف البيانات'
    );
    if (confirmed) {
      db.clearDemoData();
      await this.refreshAll();
      this.showToast('تم مسح البيانات الافتراضية بنجاح، السجل الآن نظيف وجاهز');
    }
  }

  async populateDoctorDropdowns() {
    const doctors = await db.getDoctors();

    const pDoc = document.getElementById('p-doctor');
    if (pDoc) {
      const prev = pDoc.value;
      pDoc.innerHTML = doctors.map(d => `<option value="${d}">${d}</option>`).join('');
      if (prev && doctors.includes(prev)) pDoc.value = prev;
    }

    const sessDoc = document.getElementById('session-doctor-select');
    if (sessDoc) {
      const prev = sessDoc.value;
      sessDoc.innerHTML = doctors.map(d => `<option value="${d}">${d}</option>`).join('');
      if (prev && doctors.includes(prev)) sessDoc.value = prev;
    }

    // Sync custom button displays
    this.updateCustomSelectDisplay('p-doctor');
    this.updateCustomSelectDisplay('session-doctor-select');
    this.updateCustomSelectDisplay('finance-doctor-filter');
  }

  async refreshAll() {
    await this.populateDoctorDropdowns();
    if (this.patientsManager) await this.patientsManager.loadPatients();
    if (this.sessionsManager) await this.sessionsManager.loadTodaySessions();
    if (this.financeManager) await this.financeManager.loadDailyReport();
  }
}

// تشغيل فوري وآمن يضمن عمل التطبيق مهما كانت حالة التحميل
function startApp() {
  if (window.__ascpt_app_started) return;
  window.__ascpt_app_started = true;
  const appInstance = new App();
  appInstance.init();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', startApp);
} else {
  startApp();
}
