// ========================================================
// ASCPT - Daily & Monthly Financial & Statistical Reports
// ========================================================

import { db } from './db.js';
import { auth } from './auth.js';
import { RolesManager } from './roles.js';

export class FinanceManager {
  constructor(app) {
    this.app = app;
    this.reportMode = 'daily'; // 'daily' | 'monthly'
    this.currentDate = new Date().toISOString().split('T')[0];
    this.currentMonth = this.currentDate.substring(0, 7); // YYYY-MM
    this.selectedDoctor = 'all';
  }

  async init() {
    this.bindEvents();
    
    const datePicker = document.getElementById('finance-date-picker');
    if (datePicker) datePicker.value = this.currentDate;

    const monthPicker = document.getElementById('finance-month-picker');
    if (monthPicker) monthPicker.value = this.currentMonth;

    await this.loadReport();
  }

  bindEvents() {
    // Daily Date Picker
    const datePicker = document.getElementById('finance-date-picker');
    if (datePicker) {
      datePicker.addEventListener('change', (e) => {
        this.currentDate = e.target.value;
        this.loadDailyReport();
      });
    }

    // Monthly Month Picker
    const monthPicker = document.getElementById('finance-month-picker');
    if (monthPicker) {
      monthPicker.addEventListener('change', (e) => {
        this.currentMonth = e.target.value;
        this.loadMonthlyReport();
      });
    }

    // Doctor Filter for Daily
    const doctorFilter = document.getElementById('finance-doctor-filter');
    if (doctorFilter) {
      doctorFilter.addEventListener('change', (e) => {
        this.selectedDoctor = e.target.value;
        this.loadDailyReport();
      });
    }

    // Expense Form
    const formExpense = document.getElementById('form-expense');
    if (formExpense) {
      formExpense.addEventListener('submit', (e) => this.handleAddExpense(e));
    }
  }

  setDateQuick(type) {
    if (type === 'today') {
      this.currentDate = new Date().toISOString().split('T')[0];
    } else if (type === 'yesterday') {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      this.currentDate = d.toISOString().split('T')[0];
    }
    const datePicker = document.getElementById('finance-date-picker');
    if (datePicker) datePicker.value = this.currentDate;

    // Toggle active class on quick date buttons
    const btnToday = document.getElementById('btn-quick-fin-today');
    const btnYest = document.getElementById('btn-quick-fin-yesterday');
    if (btnToday) btnToday.classList.toggle('active', type === 'today');
    if (btnYest) btnYest.classList.toggle('active', type === 'yesterday');

    this.loadDailyReport();
  }

  async deleteExpense(expenseId) {
    const confirmed = await this.app.showConfirm('هل أنت متأكد من حذف هذا المصروف؟', 'تأكيد الحذف');
    if (confirmed) {
      const currentUser = auth.getCurrentUser();
      await db.deleteExpense(expenseId);
      await db.logAudit('حذف مصروف', `حذف مصروف برقم ${expenseId}`, currentUser);
      this.app.showToast('تم حذف المصروف بنجاح');
      await this.loadReport();
      this.app.refreshAll();
    }
  }

  setReportMode(mode) {
    this.reportMode = mode;
    
    const btnDaily = document.getElementById('btn-mode-daily');
    const btnMonthly = document.getElementById('btn-mode-monthly');
    const filterDaily = document.getElementById('filter-group-daily');
    const filterMonthly = document.getElementById('filter-group-monthly');
    const contentDaily = document.getElementById('finance-daily-content');
    const contentMonthly = document.getElementById('finance-monthly-content');
    const labelPatients = document.getElementById('rep-total-patients-label');

    if (mode === 'daily') {
      if (btnDaily) { btnDaily.className = 'btn btn-primary btn-sm'; }
      if (btnMonthly) { btnMonthly.className = 'btn btn-outline btn-sm'; }
      if (filterDaily) filterDaily.style.display = 'flex';
      if (filterMonthly) filterMonthly.style.display = 'none';
      if (contentDaily) contentDaily.style.display = 'block';
      if (contentMonthly) contentMonthly.style.display = 'none';
      if (labelPatients) labelPatients.textContent = 'مرضى اليوم';
      this.loadDailyReport();
    } else {
      if (btnDaily) { btnDaily.className = 'btn btn-outline btn-sm'; }
      if (btnMonthly) { btnMonthly.className = 'btn btn-primary btn-sm'; }
      if (filterDaily) filterDaily.style.display = 'none';
      if (filterMonthly) filterMonthly.style.display = 'flex';
      if (contentDaily) contentDaily.style.display = 'none';
      if (contentMonthly) contentMonthly.style.display = 'block';
      if (labelPatients) labelPatients.textContent = 'مرضى الشهر';
      this.loadMonthlyReport();
    }
  }

  openAddExpenseModal() {
    const form = document.getElementById('form-expense');
    if (form) form.reset();
    this.app.openModal('modal-expense');
  }

  async handleAddExpense(e) {
    e.preventDefault();
    const title = document.getElementById('exp-title').value.trim();
    const amount = parseFloat(document.getElementById('exp-amount').value) || 0;
    const currentUser = auth.getCurrentUser();

    if (!title || amount <= 0) {
      await this.app.showAlert('يرجى كتابة بند المصروف وتحديد مبلغ صالح.', 'بيانات غير مكتملة', 'warning');
      return;
    }

    const expenseData = {
      date: this.currentDate,
      title,
      amount
    };

    await db.saveExpense(expenseData, currentUser);
    await db.logAudit('تسجيل مصروف', `صرف مبلغ ${amount} ج.م لبند: ${title}`, currentUser);

    this.app.closeModal('modal-expense');
    this.app.showToast('تم تسجيل المصروف بنجاح');
    await this.loadReport();
    this.app.refreshAll();
  }

  async loadReport() {
    if (this.reportMode === 'daily') {
      await this.loadDailyReport();
    } else {
      await this.loadMonthlyReport();
    }
  }

  // ================= 1. DAILY REPORT =================
  async loadDailyReport() {
    const allSessions = await db.getSessions(this.currentDate);
    const allExpenses = await db.getExpenses(this.currentDate);
    const doctors = await db.getDoctors();

    let filteredSessions = allSessions;
    if (this.selectedDoctor !== 'all') {
      filteredSessions = allSessions.filter(s => s.doctor === this.selectedDoctor);
    }

    const totalPatients = filteredSessions.length;
    const totalCash = filteredSessions.reduce((acc, curr) => acc + (parseFloat(curr.amountPaid) || 0), 0);
    const totalExpenses = allExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    const netCash = totalCash - totalExpenses;

    const docCounts = {};
    allSessions.forEach(s => { docCounts[s.doctor] = (docCounts[s.doctor] || 0) + 1; });

    // Update KPI UI
    document.getElementById('rep-total-patients').textContent = totalPatients;
    document.getElementById('rep-total-cash').textContent = `${totalCash.toLocaleString('ar-EG')} ج.م`;
    document.getElementById('rep-total-expenses').textContent = `${totalExpenses.toLocaleString('ar-EG')} ج.م`;
    
    const netCashEl = document.getElementById('rep-net-cash');
    if (netCashEl) {
      netCashEl.textContent = `${netCash.toLocaleString('ar-EG')} ج.م`;
      netCashEl.style.color = netCash >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    // Dynamic Doctor Filter
    const docFilter = document.getElementById('finance-doctor-filter');
    if (docFilter) {
      const currentVal = docFilter.value;
      docFilter.innerHTML = '<option value="all">كل الأطباء</option>' + 
        doctors.map(d => `<option value="${d}">${d}</option>`).join('');
      if (doctors.includes(currentVal) || currentVal === 'all') {
        docFilter.value = currentVal;
      }
    }

    // Doctors Breakdown Cards
    const docContainer = document.getElementById('doctors-breakdown-container');
    if (docContainer) {
      docContainer.innerHTML = doctors.map(doc => {
        const count = docCounts[doc] || 0;
        return `
          <div style="background-color: var(--bg-subtle); border: 1px solid var(--border-color); padding: 10px 16px; border-radius: var(--radius-md); display: flex; align-items: center; gap: 10px;">
            <i class="fa-solid fa-user-doctor" style="color: var(--primary);"></i>
            <div>
              <div style="font-weight: 700; font-size: 0.9rem;">${doc}</div>
              <div style="font-size: 0.8rem; color: var(--text-muted);">${count} مريض اليوم</div>
            </div>
          </div>
        `;
      }).join('');
    }

    // Daily Sessions Table
    const tbody = document.getElementById('finance-report-tbody');
    if (tbody) {
      if (filteredSessions.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 25px;">لا توجد حركات جلسات مسجلة في هذا التاريخ.</td></tr>`;
      } else {
        tbody.innerHTML = filteredSessions.map(s => {
          const payBadge = s.payType === 'cash'
            ? `<span class="badge badge-cash">نقدي</span>`
            : `<span class="badge badge-direct">شركة</span>`;
          
          const contractLabel = s.payType === 'insurance'
            ? (s.contractType === 'direct' ? 'مباشر' : 'غير مباشر')
            : '-';

          const parts = Array.isArray(s.bodyParts) ? s.bodyParts.join('، ') : (s.bodyParts || '');
          const count = s.bodyPartsCount || (Array.isArray(s.bodyParts) ? s.bodyParts.length : 1);

          return `
            <tr>
              <td style="font-weight: 700;">${s.patientName}</td>
              <td>${s.doctor}</td>
              <td>${payBadge}</td>
              <td>${s.insuranceName || '-'}</td>
              <td>${contractLabel}</td>
              <td><span class="badge badge-role-doctor">${count} أعضاء (${parts})</span></td>
              <td style="font-weight: 700; color: var(--success);">${s.amountPaid} ج.م</td>
              <td style="font-size: 0.8rem; color: var(--text-muted);">${s.recordedBy}</td>
              <td class="no-print">
                <div style="display: flex; gap: 4px;">
                  <button class="btn btn-outline btn-sm" onclick="sessionsManager.editSession('${s.id}')" title="تعديل بيانات الجلسة">
                    <i class="fa-solid fa-pen-to-square"></i>
                  </button>
                  ${RolesManager.canDelete(auth.getCurrentUser()) ? `
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
    }

    // Daily Expenses Table
    const expTbody = document.getElementById('finance-expenses-tbody');
    if (expTbody) {
      if (allExpenses.length === 0) {
        expTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">لا توجد مصروفات مسجلة لهذا اليوم.</td></tr>`;
      } else {
        expTbody.innerHTML = allExpenses.map(e => `
          <tr>
            <td style="font-weight: 600;">${e.title}</td>
            <td style="font-weight: 700; color: var(--danger);">${e.amount} ج.م</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${e.recordedBy}</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${e.time}</td>
            <td class="no-print">
              ${RolesManager.canDelete(auth.getCurrentUser()) ? `
                <button class="btn btn-outline btn-sm btn-delete-record" style="color: var(--danger);" onclick="financeManager.deleteExpense('${e.id}')" title="حذف">
                  <i class="fa-solid fa-trash"></i>
                </button>
              ` : '-'}
            </td>
          </tr>
        `).join('');
      }
    }

    // Dashboard Stats update
    const dashPatients = document.getElementById('stat-patients-today');
    const dashCash = document.getElementById('stat-cash-today');
    const dashInsurance = document.getElementById('stat-insurance-count');
    const dashExpenses = document.getElementById('stat-expenses-today');

    if (dashPatients) dashPatients.textContent = allSessions.length;
    if (dashCash) dashCash.textContent = `${totalCash.toLocaleString('ar-EG')} ج.م`;
    if (dashInsurance) dashInsurance.textContent = `${allSessions.filter(s => s.payType === 'insurance').length} حالات`;
    if (dashExpenses) dashExpenses.textContent = `${totalExpenses.toLocaleString('ar-EG')} ج.م`;

    const dashTbody = document.querySelector('#dashboard-recent-table tbody');
    if (dashTbody) {
      const recent = allSessions.slice(0, 5);
      if (recent.length === 0) {
        dashTbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-muted); padding: 15px;">لا توجد جلسات مسجلة اليوم.</td></tr>`;
      } else {
        dashTbody.innerHTML = recent.map(s => `
          <tr>
            <td style="font-weight: 700;">${s.patientName}</td>
            <td>${s.doctor}</td>
            <td>${s.payType === 'cash' ? 'نقدي' : (s.insuranceName || 'شركة')}</td>
            <td>${s.bodyPartsCount || 1} أعضاء</td>
            <td style="font-weight: 700; color: var(--success);">${s.amountPaid} ج.م</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${s.recordedAt}</td>
          </tr>
        `).join('');
      }
    }
  }

  // ================= 2. MONTHLY REPORT =================
  async loadMonthlyReport() {
    const allSessions = await db.getSessions(this.currentMonth);
    const allExpenses = await db.getExpenses(this.currentMonth);
    const doctors = await db.getDoctors();

    const totalPatients = allSessions.length;
    const totalCash = allSessions.reduce((acc, curr) => acc + (parseFloat(curr.amountPaid) || 0), 0);
    const totalExpenses = allExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    const netCash = totalCash - totalExpenses;

    // Update KPI UI
    document.getElementById('rep-total-patients').textContent = totalPatients;
    document.getElementById('rep-total-cash').textContent = `${totalCash.toLocaleString('ar-EG')} ج.م`;
    document.getElementById('rep-total-expenses').textContent = `${totalExpenses.toLocaleString('ar-EG')} ج.م`;
    
    const netCashEl = document.getElementById('rep-net-cash');
    if (netCashEl) {
      netCashEl.textContent = `${netCash.toLocaleString('ar-EG')} ج.م`;
      netCashEl.style.color = netCash >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    // A. Doctors Breakdown Table (Monthly)
    const docTbody = document.getElementById('monthly-doctors-tbody');
    if (docTbody) {
      if (doctors.length === 0 || totalPatients === 0) {
        docTbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">لا توجد بيانات جلسات مسجلة لهذا الشهر.</td></tr>`;
      } else {
        docTbody.innerHTML = doctors.map(doc => {
          const docSessions = allSessions.filter(s => s.doctor === doc);
          const cashCount = docSessions.filter(s => s.payType === 'cash').length;
          const insCount = docSessions.filter(s => s.payType === 'insurance').length;
          const total = docSessions.length;
          const pct = totalPatients > 0 ? ((total / totalPatients) * 100).toFixed(1) : 0;

          return `
            <tr>
              <td style="font-weight: 700;"><i class="fa-solid fa-user-doctor" style="color: var(--primary); margin-left: 6px;"></i> ${doc}</td>
              <td style="color: var(--success); font-weight: 700;">${cashCount} مريض</td>
              <td style="color: var(--primary); font-weight: 700;">${insCount} مريض</td>
              <td style="font-weight: 800; font-size: 0.95rem;">${total} مريض</td>
              <td>
                <div style="display: flex; align-items: center; gap: 8px;">
                  <span style="font-weight: 700; width: 45px;">${pct}%</span>
                  <div style="flex: 1; background-color: var(--bg-subtle); height: 8px; border-radius: 4px; overflow: hidden;">
                    <div style="width: ${pct}%; background-color: var(--primary); height: 100%;"></div>
                  </div>
                </div>
              </td>
            </tr>
          `;
        }).join('');
      }
    }

    // B. Insurance & Cash Distribution Table
    const insTbody = document.getElementById('monthly-insurance-tbody');
    if (insTbody) {
      if (totalPatients === 0) {
        insTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">لا توجد حركات مسجلة لهذا الشهر.</td></tr>`;
      } else {
        const categories = {};
        allSessions.forEach(s => {
          if (s.payType === 'cash') {
            const key = 'نقدي (Cash)';
            if (!categories[key]) categories[key] = { name: key, type: 'سداد نقدي مباشر', count: 0 };
            categories[key].count++;
          } else {
            const compName = s.insuranceName || 'شركة غير محددة';
            const contract = s.contractType === 'direct' ? 'تعاقد مباشر' : 'تعاقد غير مباشر';
            const key = `${compName} (${contract})`;
            if (!categories[key]) categories[key] = { name: compName, type: contract, count: 0 };
            categories[key].count++;
          }
        });

        insTbody.innerHTML = Object.values(categories).map(item => {
          const pct = ((item.count / totalPatients) * 100).toFixed(1);
          return `
            <tr>
              <td style="font-weight: 700;">${item.name}</td>
              <td><span class="badge ${item.type.includes('مباشر') ? 'badge-direct' : (item.type.includes('نقدي') ? 'badge-cash' : 'badge-indirect')}">${item.type}</span></td>
              <td style="font-weight: 800; color: var(--primary); font-size: 0.95rem;">${item.count} حالة</td>
              <td style="font-weight: 700;">${pct}%</td>
            </tr>
          `;
        }).join('');
      }
    }

    // C. Monthly Expenses Table
    const mExpTbody = document.getElementById('monthly-expenses-tbody');
    if (mExpTbody) {
      if (allExpenses.length === 0) {
        mExpTbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 20px;">لا توجد مصروفات مسجلة لهذا الشهر.</td></tr>`;
      } else {
        mExpTbody.innerHTML = allExpenses.map(e => `
          <tr>
            <td>${e.date || '-'}</td>
            <td style="font-weight: 600;">${e.title}</td>
            <td style="font-weight: 700; color: var(--danger);">${e.amount} ج.م</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${e.recordedBy || '-'}</td>
          </tr>
        `).join('');
      }
    }
  }

  getDataForExport() {
    return {
      mode: this.reportMode,
      date: this.currentDate,
      month: this.currentMonth,
      doctor: this.selectedDoctor
    };
  }
}
