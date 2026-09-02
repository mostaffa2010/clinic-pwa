// ========================================================
// PhysioCare - Daily Financial & Report Module
// ========================================================

import { db } from './db.js';
import { auth } from './auth.js';

export class FinanceManager {
  constructor(app) {
    this.app = app;
    this.currentDate = new Date().toISOString().split('T')[0];
    this.selectedDoctor = 'all';
  }

  async init() {
    this.bindEvents();
    const datePicker = document.getElementById('finance-date-picker');
    if (datePicker) datePicker.value = this.currentDate;
    await this.loadDailyReport();
  }

  bindEvents() {
    const datePicker = document.getElementById('finance-date-picker');
    if (datePicker) {
      datePicker.addEventListener('change', (e) => {
        this.currentDate = e.target.value;
        this.loadDailyReport();
      });
    }

    const doctorFilter = document.getElementById('finance-doctor-filter');
    if (doctorFilter) {
      doctorFilter.addEventListener('change', (e) => {
        this.selectedDoctor = e.target.value;
        this.loadDailyReport();
      });
    }

    // Add Expense Button & Form
    const btnAddExpense = document.getElementById('btn-add-expense');
    if (btnAddExpense) {
      btnAddExpense.addEventListener('click', () => {
        document.getElementById('form-expense').reset();
        this.app.openModal('modal-expense');
      });
    }

    const formExpense = document.getElementById('form-expense');
    if (formExpense) {
      formExpense.addEventListener('submit', (e) => this.handleAddExpense(e));
    }
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
    await this.loadDailyReport();
    this.app.refreshAll();
  }

  async loadDailyReport() {
    const allSessions = await db.getSessions(this.currentDate);
    const allExpenses = await db.getExpenses(this.currentDate);

    // Apply Doctor Filter if selected
    let filteredSessions = allSessions;
    if (this.selectedDoctor !== 'all') {
      filteredSessions = allSessions.filter(s => s.doctor === this.selectedDoctor);
    }

    // Calculations
    const totalPatients = filteredSessions.length;
    const totalCash = filteredSessions.reduce((acc, curr) => acc + (parseFloat(curr.amountPaid) || 0), 0);
    const insuranceCount = filteredSessions.filter(s => s.payType === 'insurance').length;
    const totalExpenses = allExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    const netCash = totalCash - totalExpenses;

    // Doctor Patient Counts Breakdown
    const docCounts = {};
    allSessions.forEach(s => {
      docCounts[s.doctor] = (docCounts[s.doctor] || 0) + 1;
    });

    // Update KPI UI
    document.getElementById('rep-total-patients').textContent = totalPatients;
    document.getElementById('rep-total-cash').textContent = `${totalCash.toLocaleString('ar-EG')} ج.م`;
    document.getElementById('rep-total-expenses').textContent = `${totalExpenses.toLocaleString('ar-EG')} ج.م`;
    
    const netCashEl = document.getElementById('rep-net-cash');
    if (netCashEl) {
      netCashEl.textContent = `${netCash.toLocaleString('ar-EG')} ج.م`;
      netCashEl.style.color = netCash >= 0 ? 'var(--success)' : 'var(--danger)';
    }

    // Update Doctors Breakdown UI
    const docContainer = document.getElementById('doctors-breakdown-container');
    if (docContainer) {
      const doctors = ['د. مصطفى', 'د. أحمد', 'د. سارة', 'د. كريم'];
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

    // Update Sessions Table in Finance View
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

          return `
            <tr>
              <td style="font-weight: 700;">${s.patientName}</td>
              <td>${s.doctor}</td>
              <td>${payBadge}</td>
              <td>${s.insuranceName || '-'}</td>
              <td>${contractLabel}</td>
              <td><span class="badge badge-role-doctor">${s.bodyPartsCount} أعضاء (${s.bodyParts.join('، ')})</span></td>
              <td style="font-weight: 700; color: var(--success);">${s.amountPaid} ج.م</td>
              <td style="font-size: 0.8rem; color: var(--text-muted);">${s.recordedBy}</td>
            </tr>
          `;
        }).join('');
      }
    }

    // Update Expenses Table
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
          </tr>
        `).join('');
      }
    }

    // Update Dashboard Stats
    const dashPatients = document.getElementById('stat-patients-today');
    const dashCash = document.getElementById('stat-cash-today');
    const dashInsurance = document.getElementById('stat-insurance-count');
    const dashExpenses = document.getElementById('stat-expenses-today');

    if (dashPatients) dashPatients.textContent = allSessions.length;
    if (dashCash) dashCash.textContent = `${totalCash.toLocaleString('ar-EG')} ج.م`;
    if (dashInsurance) dashInsurance.textContent = `${insuranceCount} حالات`;
    if (dashExpenses) dashExpenses.textContent = `${totalExpenses.toLocaleString('ar-EG')} ج.م`;

    // Update Dashboard Recent Table
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
            <td>${s.bodyPartsCount} أعضاء</td>
            <td style="font-weight: 700; color: var(--success);">${s.amountPaid} ج.م</td>
            <td style="font-size: 0.8rem; color: var(--text-muted);">${s.recordedAt}</td>
          </tr>
        `).join('');
      }
    }
  }

  getDataForExport() {
    return {
      date: this.currentDate,
      doctor: this.selectedDoctor
    };
  }
}
