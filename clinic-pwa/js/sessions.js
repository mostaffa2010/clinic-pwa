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
  }

  async init() {
    this.bindEvents();
    await this.loadTodaySessions();
  }

  bindEvents() {
    // Body parts chips toggle
    const chipsContainer = document.getElementById('body-parts-container');
    if (chipsContainer) {
      chipsContainer.querySelectorAll('.chip-choice').forEach(chip => {
        chip.addEventListener('click', (e) => {
          // avoid double event if clicked on input
          if (e.target.tagName !== 'INPUT') {
            const input = chip.querySelector('input');
            if (input) input.checked = !input.checked;
          }
          const isChecked = chip.querySelector('input')?.checked;
          chip.classList.toggle('selected', isChecked);
          this.updateBodyPartsCount();
        });
      });
    }

    // Patient select change -> auto-populate doctor & payment info
    const patientSelect = document.getElementById('session-patient-select');
    if (patientSelect) {
      patientSelect.addEventListener('change', async (e) => {
        const pId = e.target.value;
        if (!pId) return;
        const patients = await db.getPatients();
        const patient = patients.find(p => p.id === pId);
        if (patient) {
          document.getElementById('session-doctor-select').value = patient.doctor;
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
        }
      });
    }

    // Toggle Insurance fields on radio change
    const payRadios = document.querySelectorAll('input[name="session-pay-type"]');
    payRadios.forEach(r => {
      r.addEventListener('change', (e) => {
        const insFields = document.getElementById('session-insurance-fields');
        insFields.style.display = e.target.value === 'insurance' ? 'block' : 'none';
      });
    });

    // Form Submit
    const form = document.getElementById('form-log-session');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSaveSession(e));
    }
  }

  updateBodyPartsCount() {
    const selectedInputs = document.querySelectorAll('#body-parts-container input:checked');
    const countDisplay = document.getElementById('selected-parts-count');
    if (countDisplay) {
      countDisplay.textContent = selectedInputs.length;
    }
  }

  async handleSaveSession(e) {
    e.preventDefault();
    const currentUser = auth.getCurrentUser();
    const patientSelect = document.getElementById('session-patient-select');
    const patientId = patientSelect.value;
    if (!patientId) {
      alert('يرجى اختيار المريض من السجل');
      return;
    }

    const patients = await db.getPatients();
    const patient = patients.find(p => p.id === patientId);
    const patientName = patient ? patient.name : 'مريض غير مسجل';

    const doctor = document.getElementById('session-doctor-select').value;
    
    // Body parts
    const selectedChips = Array.from(document.querySelectorAll('#body-parts-container input:checked')).map(i => i.value);
    if (selectedChips.length === 0) {
      alert('يرجى تحديد عضو واحد على الأقل تم علاجه في الجلسة.');
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

    const sessionData = {
      date: this.todayDateStr,
      patientId,
      patientName,
      doctor,
      bodyParts: selectedChips,
      bodyPartsCount: selectedChips.length,
      payType,
      insuranceName,
      contractType,
      amountPaid,
      notes
    };

    await db.saveSession(sessionData, currentUser);
    await db.logAudit(
      'تسجيل جلسة',
      `تسجيل جلسة للمريض ${patientName} مع ${doctor} (${selectedChips.length} أعضاء - مدفوع: ${amountPaid} ج.م)`,
      currentUser
    );

    this.app.showToast('تم تسجيل الجلسة بنجاح');
    this.resetSessionForm();
    await this.loadTodaySessions();
    this.app.refreshAll();
  }

  resetSessionForm() {
    document.getElementById('form-log-session').reset();
    document.querySelectorAll('#body-parts-container .chip-choice').forEach(c => c.classList.remove('selected'));
    document.querySelectorAll('#body-parts-container input').forEach(i => i.checked = false);
    document.getElementById('selected-parts-count').textContent = '0';
    document.getElementById('session-insurance-fields').style.display = 'none';
  }

  async loadTodaySessions() {
    const sessions = await db.getSessions(this.todayDateStr);
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
              ${s.bodyPartsCount} أعضاء (${s.bodyParts[0] || ''}...)
            </span>
          </td>
          <td style="font-weight: 700; color: var(--success);">${s.amountPaid} ج.م</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${s.recordedBy} (${s.recordedAt})</td>
          <td>
            ${canDelete ? `
              <button class="btn btn-outline btn-sm btn-delete-record" style="color: var(--danger);" onclick="sessionsManager.deleteSession('${s.id}')">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : '-'}
          </td>
        </tr>
      `;
    }).join('');
  }

  async deleteSession(sessionId) {
    if (confirm('هل أنت متأكد من حذف هذه الجلسة؟')) {
      const currentUser = auth.getCurrentUser();
      await db.deleteSession(sessionId);
      await db.logAudit('حذف جلسة', `حذف حركة جلسة برقم ${sessionId}`, currentUser);
      this.app.showToast('تم حذف الجلسة');
      await this.loadTodaySessions();
      this.app.refreshAll();
    }
  }
}
