// ========================================================
// PhysioCare - Daily Sessions & Check-in Module
// ========================================================

import { db } from './db.js';
import { auth } from './auth.js';
import { RolesManager } from './roles.js';

export class SessionsManager {
  constructor(app) {
    this.app = app;
    this.todayDateStr = new Date().toISOString().split('T')[0];
    this.currentSessionDate = this.todayDateStr;
    this.selectedPatientId = null;
    this.editingSessionId = null;
  }

  async init() {
    this.bindEvents();
    const dateInput = document.getElementById('session-date');
    if (dateInput) dateInput.value = this.currentSessionDate;
    this.updateDateLabel();
    await this.loadTodaySessions();
  }

  bindEvents() {
    // 0. Session Date Change
    const dateInput = document.getElementById('session-date');
    if (dateInput) {
      dateInput.addEventListener('change', (e) => {
        this.currentSessionDate = e.target.value;
        this.updateDateLabel();
        this.loadTodaySessions();
      });
    }

    // 1. Body parts buttons toggle (100% bug-free click handling)
    const chipsContainer = document.getElementById('body-parts-container');
    if (chipsContainer) {
      chipsContainer.querySelectorAll('.chip-choice').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.preventDefault();
          btn.classList.toggle('selected');
          this.updateBodyPartsCount();
        });
      });
    }

    // 2. Patient Picker Search Filter
    const pickerSearch = document.getElementById('picker-search-input');
    if (pickerSearch) {
      pickerSearch.addEventListener('input', () => this.renderPickerPatients());
    }

    // 3. Toggle Insurance fields on radio change
    const payRadios = document.querySelectorAll('input[name="session-pay-type"]');
    payRadios.forEach(r => {
      r.addEventListener('change', (e) => {
        const insFields = document.getElementById('session-insurance-fields');
        insFields.style.display = e.target.value === 'insurance' ? 'block' : 'none';
      });
    });

    // 4. Form Submit
    const form = document.getElementById('form-log-session');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSaveSession(e));
    }
  }

  updateBodyPartsCount() {
    const selected = document.querySelectorAll('#body-parts-container .chip-choice.selected');
    const countDisplay = document.getElementById('selected-parts-count');
    if (countDisplay) {
      countDisplay.textContent = selected.length;
    }
  }

  getSelectedBodyParts() {
    return Array.from(document.querySelectorAll('#body-parts-container .chip-choice.selected'))
      .map(btn => btn.getAttribute('data-part'));
  }

  // Searchable Patient Picker
  async openPatientPicker() {
    const searchInput = document.getElementById('picker-search-input');
    if (searchInput) searchInput.value = '';
    await this.renderPickerPatients();
    this.app.openModal('modal-patient-picker');
    if (searchInput) {
      setTimeout(() => searchInput.focus(), 250);
    }
  }

  async renderPickerPatients() {
    const container = document.getElementById('picker-patients-list');
    if (!container) return;

    const searchTerm = document.getElementById('picker-search-input')?.value.trim().toLowerCase() || '';
    const patients = await db.getPatients();

    const filtered = patients.filter(p => {
      return p.name.toLowerCase().includes(searchTerm) ||
        p.phone.includes(searchTerm) ||
        (p.insuranceCompany && p.insuranceCompany.toLowerCase().includes(searchTerm));
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 24px; color: var(--text-muted); font-size: 0.9rem;">
          لا يوجد مريض بهذا الاسم أو الرقم.<br>
          <button type="button" class="btn btn-primary btn-sm" style="margin-top: 10px;" onclick="app.closeModal('modal-patient-picker'); app.patientsManager.openAddModal();">
            <i class="fa-solid fa-user-plus"></i> تسجيل مريض جديد الآن
          </button>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(p => {
      let badge = '';
      if (p.billing === 'cash') {
        badge = `<span class="badge badge-cash">نقدي</span>`;
      } else {
        const cType = p.contractType === 'direct' ? 'مباشر' : 'غير مباشر';
        badge = `<span class="badge badge-direct">${p.insuranceCompany || 'تأمين'} (${cType})</span>`;
      }

      return `
        <div class="picker-item" onclick="sessionsManager.selectPatient('${p.id}')">
          <div>
            <div style="font-weight: 700; color: var(--text-main); font-size: 0.95rem;">
              <i class="fa-solid fa-user" style="color: var(--primary); margin-left: 6px;"></i> ${p.name}
            </div>
            <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 3px;">
              <i class="fa-solid fa-phone" style="font-size: 0.75rem;"></i> ${p.phone} | <span style="color: #1e293b; font-weight: 600;">${p.doctor}</span>
            </div>
          </div>
          <div>${badge}</div>
        </div>
      `;
    }).join('');
  }

  async selectPatient(patientId) {
    const patients = await db.getPatients();
    const patient = patients.find(p => p.id === patientId);
    if (!patient) return;

    this.selectedPatientId = patient.id;
    document.getElementById('session-patient-id').value = patient.id;

    // Update UI Box
    const trigger = document.getElementById('patient-picker-trigger');
    const selectedBox = document.getElementById('selected-patient-box');
    const nameEl = document.getElementById('selected-patient-name');
    const subEl = document.getElementById('selected-patient-sub');

    if (trigger) trigger.style.display = 'none';
    if (selectedBox) selectedBox.style.display = 'flex';

    if (nameEl) nameEl.textContent = patient.name;
    if (subEl) {
      const billingTxt = patient.billing === 'cash' 
        ? 'نقدي' 
        : `تأمين: ${patient.insuranceCompany || 'شركة'} (${patient.contractType === 'direct' ? 'مباشر' : 'غير مباشر'})`;
      subEl.textContent = `الهاتف: ${patient.phone} | الطبيب: ${patient.doctor} | ${billingTxt}`;
    }

    // Auto-fill Doctor
    const docSelect = document.getElementById('session-doctor-select');
    if (docSelect) docSelect.value = patient.doctor;

    // Auto-fill Billing & Insurance
    const payRadios = document.querySelectorAll('input[name="session-pay-type"]');
    payRadios.forEach(r => { r.checked = (r.value === patient.billing); });

    const insFields = document.getElementById('session-insurance-fields');
    if (patient.billing === 'insurance') {
      insFields.style.display = 'block';
      document.getElementById('session-insurance-name').value = patient.insuranceCompany || '';
      const cRadios = document.querySelectorAll('input[name="session-contract-type"]');
      cRadios.forEach(r => { r.checked = (r.value === (patient.contractType || 'direct')); });
    } else {
      insFields.style.display = 'none';
    }

    this.app.closeModal('modal-patient-picker');
  }

  resetPatientSelection() {
    this.selectedPatientId = null;
    document.getElementById('session-patient-id').value = '';
    const trigger = document.getElementById('patient-picker-trigger');
    const selectedBox = document.getElementById('selected-patient-box');
    if (trigger) trigger.style.display = 'flex';
    if (selectedBox) selectedBox.style.display = 'none';
  }

  async handleSaveSession(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري تسجيل الجلسة...';
      setTimeout(() => {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> حفظ الجلسة';
      }, 1500);
    }
    const currentUser = auth.getCurrentUser();
    
    if (!this.selectedPatientId) {
      await this.app.showAlert('يرجى اختيار المريض من السجل أولاً لتسجيل الجلسة.', 'تنبيه', 'warning');
      this.openPatientPicker();
      return;
    }

    const patients = await db.getPatients();
    const patient = patients.find(p => p.id === this.selectedPatientId);
    const patientName = patient ? patient.name : 'مريض';

    const doctor = document.getElementById('session-doctor-select').value;
    
    // Body parts selection
    const selectedParts = this.getSelectedBodyParts();
    if (selectedParts.length === 0) {
      await this.app.showAlert('يرجى تحديد عضو واحد على الأقل تم علاجه في الجلسة (اضغط على أزرار الأعضاء المعالجة).', 'تنبيه', 'warning');
      return;
    }

    const payType = document.querySelector('input[name="session-pay-type"]:checked')?.value || 'cash';
    let insuranceName = '';
    let contractType = '';
    if (payType === 'insurance') {
      insuranceName = document.getElementById('session-insurance-name').value.trim();
      contractType = document.querySelector('input[name="session-contract-type"]:checked')?.value || 'direct';
    }

    const amountPaid = parseFloat(document.getElementById('session-amount-paid').value) || 0;
    const notes = document.getElementById('session-notes').value.trim();

    const sessionDateVal = document.getElementById('session-date')?.value || this.currentSessionDate;
    const isEdit = Boolean(this.editingSessionId);

    const sessionData = {
      id: this.editingSessionId || null,
      date: sessionDateVal,
      patientId: this.selectedPatientId,
      patientName,
      doctor,
      bodyParts: selectedParts,
      bodyPartsCount: selectedParts.length,
      payType,
      insuranceName,
      contractType,
      amountPaid,
      notes
    };

    await db.saveSession(sessionData, currentUser);
    const auditAction = isEdit ? 'تعديل جلسة' : 'تسجيل جلسة';
    const auditDesc = isEdit
      ? `تعديل بيانات جلسة المريض ${patientName} بتاريخ ${sessionDateVal} (مسدد: ${amountPaid} ج.م)`
      : `تسجيل جلسة للمريض ${patientName} مع ${doctor} بتاريخ ${sessionDateVal} (${selectedParts.length} أعضاء: ${selectedParts.join('، ')} - مسدد: ${amountPaid} ج.م)`;

    await db.logAudit(auditAction, auditDesc, currentUser);
    this.app.showToast(isEdit ? 'تم تعديل بيانات الجلسة بنجاح' : 'تم تسجيل وحفظ الجلسة بنجاح');
    this.resetSessionForm();
    await this.loadTodaySessions();
    
    // التحديث الفوري للحسابات والتقرير اليومي
    await this.app.financeManager.loadDailyReport();
  }

  setDateQuick(type) {
    if (type === 'today') {
      this.currentSessionDate = this.todayDateStr;
    } else if (type === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      this.currentSessionDate = d.toISOString().split('T')[0];
    }
    const dateInput = document.getElementById('session-date');
    if (dateInput) dateInput.value = this.currentSessionDate;

    // Toggle active class on quick date buttons
    const btnToday = document.getElementById('btn-quick-sess-today');
    const btnYest = document.getElementById('btn-quick-sess-yesterday');
    if (btnToday) btnToday.classList.toggle('active', type === 'today');
    if (btnYest) btnYest.classList.toggle('active', type === 'yesterday');

    this.updateDateLabel();
    this.loadTodaySessions();
  }

  updateDateLabel() {
    const label = document.getElementById('sessions-table-date-label');
    if (!label) return;
    if (this.currentSessionDate === this.todayDateStr) {
      label.textContent = 'اليوم';
    } else {
      const yest = new Date();
      yest.setDate(yest.getDate() - 1);
      if (this.currentSessionDate === yest.toISOString().split('T')[0]) {
        label.textContent = `أمس (${this.currentSessionDate})`;
      } else {
        label.textContent = this.currentSessionDate;
      }
    }
  }

  async editSession(sessionId) {
    const allSessions = await db.getSessions();
    const s = allSessions.find(item => item.id === sessionId);
    if (!s) return;

    // 1. Switch to sessions view
    this.app.switchView('sessions');

    // 2. Set state
    this.editingSessionId = s.id;
    this.currentSessionDate = s.date || this.todayDateStr;
    const dateInput = document.getElementById('session-date');
    if (dateInput) dateInput.value = this.currentSessionDate;
    this.updateDateLabel();

    // 3. Select patient
    await this.selectPatient(s.patientId);

    // 4. Select doctor
    const docSelect = document.getElementById('session-doctor-select');
    if (docSelect) {
      docSelect.value = s.doctor;
      this.app.updateCustomSelectDisplay('session-doctor-select');
    }

    // 5. Select body parts
    const savedParts = s.bodyParts || [];
    document.querySelectorAll('#body-parts-container .chip-choice').forEach(btn => {
      const val = btn.getAttribute('data-part');
      btn.classList.toggle('selected', savedParts.includes(val));
    });
    this.updateBodyPartsCount();

    // 6. Payment
    const payRadios = document.querySelectorAll('input[name="session-pay-type"]');
    payRadios.forEach(r => { r.checked = (r.value === s.payType); });

    const insFields = document.getElementById('session-insurance-fields');
    if (s.payType === 'insurance') {
      insFields.style.display = 'block';
      document.getElementById('session-insurance-name').value = s.insuranceName || '';
      const cRadios = document.querySelectorAll('input[name="session-contract-type"]');
      cRadios.forEach(r => { r.checked = (r.value === (s.contractType || 'direct')); });
    } else {
      insFields.style.display = 'none';
    }

    document.getElementById('session-amount-paid').value = s.amountPaid || 0;
    document.getElementById('session-notes').value = s.notes || '';

    // 7. Update submit button
    const submitBtn = document.querySelector('#form-log-session button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa-solid fa-pen-to-square"></i> حفظ تعديل الجلسة';
      submitBtn.className = 'btn btn-success';
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
    this.app.showToast(`جاري تعديل جلسة: ${s.patientName}`);
  }

  resetSessionForm() {
    this.editingSessionId = null;
    const submitBtn = document.querySelector('#form-log-session button[type="submit"]');
    if (submitBtn) {
      submitBtn.innerHTML = '<i class="fa-solid fa-check"></i> حفظ الجلسة';
      submitBtn.className = 'btn btn-primary';
    }
    document.getElementById('form-log-session').reset();
    const dateInput = document.getElementById('session-date');
    if (dateInput) dateInput.value = this.currentSessionDate;
    document.querySelectorAll('#body-parts-container .chip-choice').forEach(c => c.classList.remove('selected'));
    document.getElementById('selected-parts-count').textContent = '0';
    document.getElementById('session-insurance-fields').style.display = 'none';
    this.resetPatientSelection();
  }

  async loadTodaySessions() {
    const sessions = await db.getSessions(this.currentSessionDate);
    const tbody = document.getElementById('sessions-today-tbody');
    const badge = document.getElementById('sessions-today-count-badge');
    if (badge) badge.textContent = `${sessions.length} جلسة`;

    if (!tbody) return;

    if (sessions.length === 0) {
      tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-muted); padding: 25px;">لا توجد جلسات مسجلة اليوم حتى الآن.</td></tr>`;
      return;
    }

    const currentUser = auth.getCurrentUser();
    const canDelete = RolesManager.canDelete(currentUser);

    tbody.innerHTML = sessions.map(s => {
      let payBadge = '';
      if (s.payType === 'cash') {
        payBadge = `<span class="badge badge-cash">نقدي</span>`;
      } else {
        const cType = s.contractType === 'direct' ? 'مباشر' : 'غير مباشر';
        payBadge = `<span class="badge badge-direct">${s.insuranceName || 'تأمين'} (${cType})</span>`;
      }

      return `
        <tr>
          <td style="font-weight: 700;">${s.patientName}</td>
          <td>${s.doctor}</td>
          <td>${payBadge}</td>
          <td>
            <span class="badge badge-role-doctor" title="${s.bodyParts.join('، ')}">
              ${s.bodyPartsCount} أعضاء (${s.bodyParts.slice(0, 2).join('، ')}${s.bodyParts.length > 2 ? '...' : ''})
            </span>
          </td>
          <td style="font-weight: 700; color: var(--success);">${s.amountPaid} ج.م</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${s.recordedBy} (${s.recordedAt})</td>
          <td>
            <div style="display: flex; gap: 4px;">
              <button class="btn btn-outline btn-sm" onclick="sessionsManager.editSession('${s.id}')" title="تعديل بيانات الجلسة">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              ${canDelete ? `
                <button class="btn btn-outline btn-sm btn-delete-record" style="color: var(--danger);" onclick="sessionsManager.deleteSession('${s.id}')" title="حذف">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  async deleteSession(sessionId) {
    const confirmed = await this.app.showConfirm('هل أنت متأكد من حذف هذه الجلسة من سجلات اليوم؟', 'تأكيد الحذف');
    if (confirmed) {
      const currentUser = auth.getCurrentUser();
      await db.deleteSession(sessionId);
      await db.logAudit('حذف جلسة', `حذف حركة جلسة برقم ${sessionId}`, currentUser);
      this.app.showToast('تم حذف الجلسة');
      await this.loadTodaySessions();
      await this.app.financeManager.loadDailyReport();
    }
  }
}
