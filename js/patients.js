// ========================================================
// PhysioFlow - Patients Management Module
// ========================================================

import { db } from './db.js';
import { auth } from './auth.js';
import { RolesManager } from './roles.js';

export class PatientsManager {
  constructor(app) {
    this.app = app;
    this.patients = [];
    this.currentSheetPatient = null;
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

    // Bind Sheet Chips toggle
    document.querySelectorAll('.sheet-chip').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        btn.classList.toggle('selected');
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
          <td style="font-weight: 800; color: var(--primary); cursor: pointer;" onclick="patientsManager.openPatientSheet('${p.id}')" title="اضغط لفتح الشيت الطبي"><i class="fa-solid fa-file-waveform" style="margin-left: 6px;"></i> ${p.name}</td>
          <td>${p.age} سنة</td>
          <td><a href="tel:${p.phone}" style="color: var(--primary); text-decoration: none;"><i class="fa-solid fa-phone"></i> ${p.phone}</a></td>
          <td>${p.address || '-'}</td>
          <td><span style="font-weight: 600; color: #1e293b;">${p.doctor}</span></td>
          <td>${billingBadge}</td>
          <td style="font-size: 0.8rem; color: var(--text-muted);">${p.lastUpdatedBy || p.createdBy || '-'}</td>
          <td>
            <div style="display: flex; gap: 6px; align-items: center; flex-wrap: nowrap;">
              <button class="btn btn-primary btn-sm" onclick="patientsManager.openPatientSheet('${p.id}')" title="شيت العلاج الطبيعي">
                <i class="fa-solid fa-file-waveform"></i> الشيت الطبي
              </button>
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

  // ================= Clinical Patient Sheet =================
  openPatientSheet(patientId) {
    const p = this.patients.find(item => item.id === patientId);
    if (!p) return;

    this.currentSheetPatient = p;
    const sheet = p.clinicalSheet || {};

    // 1. Fill Header info
    const nameEl = document.getElementById('sheet-patient-name');
    if (nameEl) nameEl.textContent = p.name;

    const ageEl = document.getElementById('sheet-patient-age');
    if (ageEl) ageEl.textContent = p.age;

    const phoneEl = document.getElementById('sheet-patient-phone');
    if (phoneEl) phoneEl.textContent = p.phone;

    const addrEl = document.getElementById('sheet-patient-address');
    if (addrEl) addrEl.textContent = p.address || 'غير محدد';

    const docEl = document.getElementById('sheet-patient-doctor');
    if (docEl) docEl.textContent = p.doctor;

    const badgeEl = document.getElementById('sheet-patient-billing-badge');
    if (badgeEl) {
      if (p.billing === 'cash') {
        badgeEl.innerHTML = '<span class="badge badge-cash" style="font-size: 0.82rem; padding: 4px 12px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-money-bill-wave"></i> نقدي</span>';
      } else {
        const cType = p.contractType === 'direct' ? 'مباشر' : 'غير مباشر';
        badgeEl.innerHTML = `<span class="badge badge-direct" style="font-size: 0.82rem; padding: 4px 12px; font-weight: 700; white-space: nowrap; display: inline-flex; align-items: center; gap: 5px;"><i class="fa-solid fa-shield-halved"></i> ${p.insuranceCompany || 'تأمين'} (${cType})</span>`;
      }
    }

    const updateEl = document.getElementById('sheet-last-update-text');
    if (updateEl) {
      updateEl.textContent = sheet.lastUpdated 
        ? `${sheet.lastUpdated} (بواسطة: ${sheet.updatedBy || 'الطبيب'})`
        : 'لم يتم تعديل الشيت بعد (شيت جديد)';
    }

    // 2. Fill Diagnosis & Affected Area
    document.getElementById('sheet-diagnosis').value = sheet.diagnosis || '';
    document.getElementById('sheet-affected-area').value = sheet.affectedArea || '';

    // 3. Modalities chips
    const savedModalities = sheet.modalities || [];
    document.querySelectorAll('#sheet-modalities-container .sheet-chip').forEach(btn => {
      const val = btn.getAttribute('data-val');
      btn.classList.toggle('selected', savedModalities.includes(val));
    });
    document.getElementById('sheet-custom-modalities').value = sheet.customModalities || '';

    // 4. Procedures chips
    const savedProcedures = sheet.procedures || [];
    document.querySelectorAll('#sheet-procedures-container .sheet-chip').forEach(btn => {
      const val = btn.getAttribute('data-val');
      btn.classList.toggle('selected', savedProcedures.includes(val));
    });
    document.getElementById('sheet-custom-procedures').value = sheet.customProcedures || '';

    // 5. Exercises chips
    const savedExercises = sheet.exercises || [];
    document.querySelectorAll('#sheet-exercises-container .sheet-chip').forEach(btn => {
      const val = btn.getAttribute('data-val');
      btn.classList.toggle('selected', savedExercises.includes(val));
    });
    document.getElementById('sheet-exercise-details').value = sheet.exerciseDetails || '';

    // 6. Plan & Notes
    document.getElementById('sheet-sessions-count').value = sheet.plannedSessions || '';
    document.getElementById('sheet-doctor-notes').value = sheet.doctorNotes || '';

    // 7. Switch View
    this.app.switchView('patient-sheet');
  }

  async handleSaveSheet(e) {
    e.preventDefault();
    if (!this.currentSheetPatient) return;

    const currentUser = auth.getCurrentUser();
    const saveBtn = document.getElementById('btn-save-sheet');
    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> جاري الحفظ...';
      setTimeout(() => {
        saveBtn.disabled = false;
        saveBtn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> حفظ الشيت الطبي';
      }, 1500);
    }

    // Collect Modalities
    const modalities = Array.from(document.querySelectorAll('#sheet-modalities-container .sheet-chip.selected'))
      .map(b => b.getAttribute('data-val'));

    // Collect Procedures
    const procedures = Array.from(document.querySelectorAll('#sheet-procedures-container .sheet-chip.selected'))
      .map(b => b.getAttribute('data-val'));

    // Collect Exercises
    const exercises = Array.from(document.querySelectorAll('#sheet-exercises-container .sheet-chip.selected'))
      .map(b => b.getAttribute('data-val'));

    const clinicalSheet = {
      diagnosis: document.getElementById('sheet-diagnosis').value.trim(),
      affectedArea: document.getElementById('sheet-affected-area').value.trim(),
      modalities,
      customModalities: document.getElementById('sheet-custom-modalities').value.trim(),
      procedures,
      customProcedures: document.getElementById('sheet-custom-procedures').value.trim(),
      exercises,
      exerciseDetails: document.getElementById('sheet-exercise-details').value.trim(),
      plannedSessions: document.getElementById('sheet-sessions-count').value.trim(),
      doctorNotes: document.getElementById('sheet-doctor-notes').value.trim(),
      lastUpdated: new Date().toLocaleString('en-US'),
      updatedBy: currentUser?.name || 'الطبيب المعالج'
    };

    this.currentSheetPatient.clinicalSheet = clinicalSheet;
    await db.savePatient(this.currentSheetPatient, currentUser);

    await db.logAudit(
      'تحديث الشيت الطبي',
      `قام ${currentUser?.name || 'الطبيب'} بتحديث الشيت الطبي وخطة العلاج للمريض: ${this.currentSheetPatient.name}`,
      currentUser
    );

    const updateEl = document.getElementById('sheet-last-update-text');
    if (updateEl) {
      updateEl.textContent = `${clinicalSheet.lastUpdated} (بواسطة: ${clinicalSheet.updatedBy})`;
    }

    this.app.showToast('تم حفظ وتحديث الشيت الطبي للمريض بنجاح');
    await this.loadPatients();
  }

  // ================= Dynamic Clinical Chips (Manager Controlled) =================
  renderAllClinicalChips(sheet = {}) {
    this.renderCategoryChips('modality', 'sheet-modalities-container', sheet.modalities || []);
    this.renderCategoryChips('procedure', 'sheet-procedures-container', sheet.procedures || []);
    this.renderCategoryChips('exercise', 'sheet-exercises-container', sheet.exercises || []);
  }

  renderCategoryChips(category, containerId, selectedList = []) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const options = db.getClinicalOptions(category);
    const iconMap = {
      modality: 'fa-solid fa-bolt-lightning',
      procedure: 'fa-solid fa-hand-holding-hand',
      exercise: 'fa-solid fa-person-running'
    };
    const defaultIcon = iconMap[category] || 'fa-solid fa-circle-check';

    container.innerHTML = options.map(opt => {
      const isSelected = selectedList.includes(opt);
      return `
        <button type="button" class="chip-choice sheet-chip ${isSelected ? 'selected' : ''}" data-group="${category}" data-val="${opt}">
          <i class="${defaultIcon}"></i> ${opt}
        </button>
      `;
    }).join('');

    // Re-bind chip selection click listener
    container.querySelectorAll('.chip-choice').forEach(btn => {
      btn.addEventListener('click', () => {
        btn.classList.toggle('selected');
      });
    });
  }

  openAddOptionModal(category) {
    const user = auth.getCurrentUser();
    if (!RolesManager.canManageUsers(user)) {
      this.app.showAlert('إضافة وحذف الأزرار الدائمة متاح لمدير المركز فقط. يمكن للأطباء تدوين أي ملاحظات إضافية في خانة الملاحظات بالأسفل.', 'صلاحية المدير');
      return;
    }

    const titles = {
      modality: 'إضافة جهاز فيزيائي دائم',
      procedure: 'إضافة إجراء / علاج يدوي دائم',
      exercise: 'إضافة تمرين علاجي دائم'
    };

    document.getElementById('opt-target-category').value = category;
    document.getElementById('modal-opt-title').innerHTML = `<i class="fa-solid fa-circle-plus"></i> ${titles[category] || 'إضافة زر جديد'}`;
    document.getElementById('opt-new-name').value = '';
    this.app.openModal('modal-add-clinical-option');
  }

  async handleSaveNewOption(e) {
    e.preventDefault();
    const category = document.getElementById('opt-target-category').value;
    const nameInput = document.getElementById('opt-new-name');
    const name = nameInput.value.trim();

    if (!name || !category) return;

    await db.addClinicalOption(category, name);
    const containerMap = {
      modality: 'sheet-modalities-container',
      procedure: 'sheet-procedures-container',
      exercise: 'sheet-exercises-container'
    };

    // Preserve currently selected chips
    const curSelected = Array.from(document.querySelectorAll(`#${containerMap[category]} .sheet-chip.selected`)).map(b => b.getAttribute('data-val'));
    curSelected.push(name); // select newly added option
    this.renderCategoryChips(category, containerMap[category], curSelected);

    this.app.closeModal('modal-add-clinical-option');
    this.app.showToast(`تمت إضافة زر "${name}" لجميع أطباء المركز بنجاح`);
    await db.logAudit('إضافة زر سريري', `إضافة زر ${name} في قسم ${category}`, auth.getCurrentUser());
  }

  async openDeleteOptionModal(category) {
    const user = auth.getCurrentUser();
    if (!RolesManager.canManageUsers(user)) {
      this.app.showAlert('إضافة وحذف الأزرار الدائمة متاح لمدير المركز فقط.', 'صلاحية المدير');
      return;
    }

    const options = db.getClinicalOptions(category);
    if (!options || options.length === 0) {
      this.app.showAlert('لا توجد أزرار مضافة لحذفها في هذا القسم.', 'تنبيه');
      return;
    }

    // Prompt manager with selection
    const optListText = options.map((o, idx) => `${idx + 1}. ${o}`).join('\n');
    const inputNum = window.prompt(`أدخل رقم الزر الذي ترغب في حذفه نهائياً من قائمة الأطباء:\n\n${optListText}`);
    
    if (inputNum) {
      const idx = parseInt(inputNum) - 1;
      if (idx >= 0 && idx < options.length) {
        const toDelete = options[idx];
        const confirmed = await this.app.showConfirm(`هل أنت متأكد من حذف زر "${toDelete}" نهائياً؟`, 'تأكيد الحذف');
        if (confirmed) {
          await db.deleteClinicalOption(category, toDelete);
          const containerMap = {
            modality: 'sheet-modalities-container',
            procedure: 'sheet-procedures-container',
            exercise: 'sheet-exercises-container'
          };
          const curSelected = Array.from(document.querySelectorAll(`#${containerMap[category]} .sheet-chip.selected`))
            .map(b => b.getAttribute('data-val'))
            .filter(v => v !== toDelete);
          this.renderCategoryChips(category, containerMap[category], curSelected);
          this.app.showToast(`تم حذف زر "${toDelete}"`);
          await db.logAudit('حذف زر سريري', `حذف زر ${toDelete} من قسم ${category}`, auth.getCurrentUser());
        }
      } else {
        this.app.showAlert('رقم الاختيار غير صحيح', 'خطأ');
      }
    }
  }

  printCurrentSheet() {
    if (!this.currentSheetPatient) {
      this.app.showAlert('يرجى فتح شيت المريض أولاً قبل الطباعة.', 'تنبيه', 'warning');
      return;
    }

    const p = this.currentSheetPatient;
    const sheet = p.clinicalSheet || {};

    // 1. Fill Printable Template
    const now = new Date().toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' });
    const today = new Date().toLocaleDateString('ar-EG-u-nu-latn');
    document.getElementById('print-sheet-meta').textContent = `تاريخ ووقت الطباعة: ${today} ${now}`;

    document.getElementById('p-print-name').textContent = p.name;
    document.getElementById('p-print-age').textContent = `${p.age} سنة`;
    document.getElementById('p-print-phone').textContent = p.phone;
    document.getElementById('p-print-address').textContent = p.address || '-';
    document.getElementById('p-print-doctor').textContent = p.doctor;
    document.getElementById('p-print-billing').textContent = p.billing === 'cash' 
      ? 'نقدي (Cash)' 
      : `${p.insuranceCompany || 'تأمين'} (${p.contractType === 'direct' ? 'تعاقد مباشر' : 'تعاقد غير مباشر'})`;

    // 2. Diagnosis
    document.getElementById('p-print-diagnosis').textContent = 
      `${sheet.diagnosis || 'لم يحدد'} | العضو/المنطقة: ${sheet.affectedArea || 'غير محدد'}`;

    // 3. Modalities
    const mods = [...(sheet.modalities || [])];
    if (sheet.customModalities) mods.push(sheet.customModalities);
    document.getElementById('p-print-modalities').textContent = mods.length > 0 ? mods.join(' • ') : 'لا توجد أجهزة مقررة';

    // 4. Procedures
    const procs = [...(sheet.procedures || [])];
    if (sheet.customProcedures) procs.push(sheet.customProcedures);
    document.getElementById('p-print-procedures').textContent = procs.length > 0 ? procs.join(' • ') : 'لا توجد إجراءات يدوية مقررة';

    // 5. Exercises
    const exList = [...(sheet.exercises || [])];
    document.getElementById('p-print-exercises').textContent = exList.length > 0 ? exList.join(' • ') : 'لا توجد تمارين محددة';
    document.getElementById('p-print-exercise-details').textContent = sheet.exerciseDetails ? `التفاصيل: ${sheet.exerciseDetails}` : '';

    // 6. Plan & Notes
    const planText = sheet.plannedSessions ? `الخطة: ${sheet.plannedSessions} | ` : '';
    document.getElementById('p-print-notes').textContent = `${planText}${sheet.doctorNotes || 'لا توجد ملاحظات إضافية'}`;

    // 3. Activate print class and trigger print
    document.body.classList.add('printing-sheet');

    const cleanPrintClass = () => {
      document.body.classList.remove('printing-sheet');
      window.removeEventListener('afterprint', cleanPrintClass);
    };
    window.addEventListener('afterprint', cleanPrintClass);

    window.print();

    setTimeout(cleanPrintClass, 2000);
  }
}