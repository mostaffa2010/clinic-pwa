// ========================================================
// PhysioCare - Patients Management Module
// ========================================================

import { db } from './db.js';
import { auth } from './auth.js';
import { RolesManager } from './roles.js';

export class PatientsManager {
  constructor(app) {
    this.app = app;
    this.patients = [];
  }

  async init() {
    this.bindEvents();
    await this.loadPatients();
  }

  bindEvents() {
    const searchInput = document.getElementById('patient-search-input');
    if (searchInput) {
      searchInput.addEventListener('input', () => this.renderPatients());
    }

    const filterType = document.getElementById('patient-filter-type');
    if (filterType) {
      filterType.addEventListener('change', () => this.renderPatients());
    }

    const btnOpenAdd = document.getElementById('btn-open-add-patient');
    if (btnOpenAdd) {
      btnOpenAdd.addEventListener('click', () => this.openAddModal());
    }

    // Toggle Insurance Fields in Patient Form
    const billingRadios = document.querySelectorAll('input[name="p-billing"]');
    billingRadios.forEach(r => {
      r.addEventListener('change', (e) => {
        const insBox = document.getElementById('p-insurance-details');
        if (insBox) {
          insBox.style.display = e.target.value === 'insurance' ? 'block' : 'none';
        }
      });
    });

    // Form Submission
    const form = document.getElementById('form-patient');
    if (form) {
      form.addEventListener('submit', (e) => this.handleSavePatient(e));
    }
  }

  async loadPatients() {
    this.patients = await db.getPatients();
    this.renderPatients();
    this.populateSessionsDropdown();
  }

  renderPatients() {
    const tbody = document.getElementById('patients-tbody');
    if (!tbody) return;

    const searchTerm = document.getElementById('patient-search-input')?.value.trim().toLowerCase() || '';
    const filterType = document.getElementById('patient-filter-type')?.value || 'all';

    let filtered = this.patients.filter(p => {
      const matchSearch = 
        p.name.toLowerCase().includes(searchTerm) ||
        p.phone.includes(searchTerm) ||
        (p.insuranceCompany && p.insuranceCompany.toLowerCase().includes(searchTerm));

      if (!matchSearch) return false;

      if (filterType === 'cash') return p.billing === 'cash';
      if (filterType === 'insurance_direct') return p.billing === 'insurance' && p.contractType === 'direct';
      if (filterType === 'insurance_indirect') return p.billing === 'insurance' && p.contractType === 'indirect';

      return true;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">لا يوجد مرضى مطابقين للبحث.</td></tr>`;
      return;
    }

    const currentUser = auth.getCurrentUser();
    const canDelete = RolesManager.canDelete(currentUser);

    tbody.innerHTML = filtered.map(p => {
      let billingBadge = '';
      if (p.billing === 'cash') {
        billingBadge = `<span class="badge badge-cash"><i class="fa-solid fa-money-bill"></i> نقدي</span>`;
      } else if (p.contractType === 'direct') {
        billingBadge = `<span class="badge badge-direct"><i class="fa-solid fa-file-contract"></i> ${p.insuranceCompany || 'تأمين'} (مباشر)</span>`;
      } else {
        billingBadge = `<span class="badge badge-indirect"><i class="fa-solid fa-handshake"></i> ${p.insuranceCompany || 'تأمين'} (غير مباشر)</span>`;
      }

      return `
        <tr>
          <td style="font-weight: 700;">${p.name}</td>
          <td>${p.age} سنة</td>
          <td><a href="tel:${p.phone}" style="color: var(--primary); text-decoration: none;"><i class="fa-solid fa-phone"></i> ${p.phone}</a></td>
          <td>${p.address || '-'}</td>
          <td><span style="font-weight: 600; color: #1e293b;">${p.doctor}</span></td>
          <td>${billingBadge}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${p.lastUpdatedBy || p.createdBy || '-'}</td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center;">
              <a href="https://wa.me/${(p.phone || '').replace(/[^0-9]/g, '').replace(/^0/, '20')}" target="_blank" class="btn btn-outline btn-sm" style="color: #10b981; border-color: #10b981;" title="محادثة واتساب">
                <i class="fa-brands fa-whatsapp"></i>
              </a>
              <button class="btn btn-outline btn-sm" onclick="patientsManager.openEditModal('${p.id}')" title="تعديل">
                <i class="fa-solid fa-pen-to-square"></i>
              </button>
              ${canDelete ? `
                <button class="btn btn-outline btn-sm btn-delete-record" style="color: var(--danger);" onclick="patientsManager.confirmDelete('${p.id}')" title="حذف">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : ''}
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  populateSessionsDropdown() {
    const select = document.getElementById('session-patient-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- اختر المريض من السجل --</option>' + 
      this.patients.map(p => {
        const info = p.billing === 'cash' ? 'نقدي' : `تأمين: ${p.insuranceCompany || 'شركة'}`;
        return `<option value="${p.id}">${p.name} (${p.doctor}) - [${info}]</option>`;
      }).join('');
  }

  openAddModal() {
    document.getElementById('form-patient').reset();
    document.getElementById('p-id').value = '';
    document.getElementById('modal-patient-title').innerHTML = '<i class="fa-solid fa-user-plus"></i> تسجيل مريض جديد';
    document.getElementById('p-insurance-details').style.display = 'none';
    this.app.openModal('modal-patient');
  }

  openEditModal(patientId) {
    const p = this.patients.find(item => item.id === patientId);
    if (!p) return;

    document.getElementById('p-id').value = p.id;
    document.getElementById('p-name').value = p.name;
    document.getElementById('p-age').value = p.age;
    document.getElementById('p-phone').value = p.phone;
    document.getElementById('p-address').value = p.address || '';
    document.getElementById('p-doctor').value = p.doctor;

    const billingRadios = document.querySelectorAll('input[name="p-billing"]');
    billingRadios.forEach(r => { r.checked = (r.value === p.billing); });

    const insBox = document.getElementById('p-insurance-details');
    if (p.billing === 'insurance') {
      insBox.style.display = 'block';
      document.getElementById('p-insurance-company').value = p.insuranceCompany || '';
      const contractRadios = document.querySelectorAll('input[name="p-contract"]');
      contractRadios.forEach(r => { r.checked = (r.value === p.contractType); });
    } else {
      insBox.style.display = 'none';
    }

    document.getElementById('modal-patient-title').innerHTML = '<i class="fa-solid fa-pen-to-square"></i> تعديل بيانات مريض';
    this.app.openModal('modal-patient');
  }

  async handleSavePatient(e) {
    e.preventDefault();
    const saveBtn = document.getElementById('btn-save-patient');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = 'حفظ المريض';
      }, 1500);
    }
    const currentUser = auth.getCurrentUser();
    const id = document.getElementById('p-id').value;
    const name = document.getElementById('p-name').value.trim();
    const age = parseInt(document.getElementById('p-age').value);
    const phone = document.getElementById('p-phone').value.trim();
    const address = document.getElementById('p-address').value.trim();
    const doctor = document.getElementById('p-doctor').value;
    const billing = document.querySelector('input[name="p-billing"]:checked')?.value || 'cash';

    let insuranceCompany = '';
    let contractType = '';
    if (billing === 'insurance') {
      insuranceCompany = document.getElementById('p-insurance-company').value.trim();
      contractType = document.querySelector('input[name="p-contract"]:checked')?.value || 'direct';
    }

    const patientData = {
      id: id || null,
      name,
      age,
      phone,
      address,
      doctor,
      billing,
      insuranceCompany,
      contractType
    };

    const actionResult = await db.savePatient(patientData, currentUser);
    const auditDesc = id 
      ? `تعديل ملف المريض: ${name}`
      : `تسجيل مريض جديد: ${name} (طبيب: ${doctor} - نظام: ${billing})`;
      
    await db.logAudit(id ? 'تعديل مريض' : 'إضافة مريض', auditDesc, currentUser);

    this.app.closeModal('modal-patient');
    this.app.showToast(id ? 'تم تعديل بيانات المريض بنجاح' : 'تم إضافة المريض بنجاح');
    await this.loadPatients();
  }

  async confirmDelete(patientId) {
    const p = this.patients.find(item => item.id === patientId);
    if (!p) return;

    const confirmed = await this.app.showConfirm(`هل أنت متأكد من حذف ملف المريض: ${p.name}؟ هذا الإجراء لا يمكن التراجع عنه.`, 'تأكيد حذف المريض');
    if (confirmed) {
      const currentUser = auth.getCurrentUser();
      await db.deletePatient(patientId);
      await db.logAudit('حذف مريض', `قام بحذف ملف المريض: ${p.name}`, currentUser);
      this.app.showToast('تم حذف ملف المريض');
      await this.loadPatients();
    }
  }
}
