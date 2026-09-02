// ========================================================
// ASCPT - Export & Wi-Fi Printing Module (Robust & Fail-Safe)
// ========================================================

import { db } from './db.js';

export class ExportManager {
  constructor(app, financeManager) {
    this.app = app;
    this.financeManager = financeManager;
  }

  init() {
    // Both event listeners and direct onclicks supported
    const btnExcel = document.getElementById('btn-export-excel');
    if (btnExcel && !btnExcel.onclick) {
      btnExcel.onclick = () => this.exportToExcel();
    }

    const btnPrint = document.getElementById('btn-print-report');
    if (btnPrint && !btnPrint.onclick) {
      btnPrint.onclick = () => this.printReport();
    }
  }

  async exportToExcel() {
    try {
      const dateStr = this.financeManager?.currentDate || new Date().toISOString().split('T')[0];
      const allSessions = await db.getSessions(dateStr);
      const allExpenses = await db.getExpenses(dateStr);

      const totalCash = allSessions.reduce((acc, curr) => acc + (parseFloat(curr.amountPaid) || 0), 0);
      const totalExp = allExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
      const netCash = totalCash - totalExp;

      // 1. إذا كانت مكتبة SheetJS متوفرة
      if (typeof XLSX !== 'undefined') {
        const sessionsData = allSessions.map((s, idx) => ({
          'م': idx + 1,
          'اسم المريض': s.patientName,
          'الطبيب المعالج': s.doctor,
          'نظام الحساب': s.payType === 'cash' ? 'نقدي' : 'تأمين',
          'شركة التأمين': s.insuranceName || '-',
          'نوع التعاقد': s.payType === 'insurance' ? (s.contractType === 'direct' ? 'مباشر' : 'غير مباشر') : '-',
          'عدد الأعضاء': s.bodyPartsCount || (Array.isArray(s.bodyParts) ? s.bodyParts.length : 1),
          'الأعضاء المعالجة': Array.isArray(s.bodyParts) ? s.bodyParts.join('، ') : '',
          'المبلغ المقبوض (ج.م)': s.amountPaid,
          'مسجل الجلسة': s.recordedBy,
          'الوقت': s.recordedAt
        }));

        const expensesData = allExpenses.map((e, idx) => ({
          'م': idx + 1,
          'بند المصروف': e.title,
          'المبلغ (ج.م)': e.amount,
          'المسؤول عن الصرف': e.recordedBy,
          'الوقت': e.time
        }));

        const summaryData = [
          { 'البيان': 'تاريخ التقرير', 'القيمة': dateStr },
          { 'البيان': 'إجمالي عدد المرضى المترددين', 'القيمة': allSessions.length },
          { 'البيان': 'إجمالي الإيرادات النقدية', 'القيمة': `${totalCash} ج.م` },
          { 'البيان': 'إجمالي المصروفات', 'القيمة': `${totalExp} ج.م` },
          { 'البيان': 'صافي النقدية بالدرج', 'القيمة': `${netCash} ج.م` }
        ];

        const docCounts = {};
        allSessions.forEach(s => { docCounts[s.doctor] = (docCounts[s.doctor] || 0) + 1; });
        Object.keys(docCounts).forEach(doc => {
          summaryData.push({ 'البيان': `مرضى ${doc}`, 'القيمة': `${docCounts[doc]} مريض` });
        });

        const wb = XLSX.utils.book_new();
        const wsSummary = XLSX.utils.json_to_sheet(summaryData);
        XLSX.utils.book_append_sheet(wb, wsSummary, 'ملخص الحسابات');

        const wsSessions = XLSX.utils.json_to_sheet(sessionsData.length ? sessionsData : [{ 'تنبيه': 'لا توجد جلسات مسجلة اليوم' }]);
        XLSX.utils.book_append_sheet(wb, wsSessions, 'حركات المرضى والجلسات');

        const wsExpenses = XLSX.utils.json_to_sheet(expensesData.length ? expensesData : [{ 'تنبيه': 'لا توجد مصروفات' }]);
        XLSX.utils.book_append_sheet(wb, wsExpenses, 'المصروفات اليومية');

        const filename = `تقرير_ASCPT_اليومي_${dateStr}.xlsx`;
        XLSX.writeFile(wb, filename);
        this.app.showToast('تم تصدير ملف Excel (.xlsx) بنجاح');
        return;
      }

      // 2. تصدير مباشر عالي الدقة (Native Excel CSV with UTF-8 BOM) يعمل في كافة الظروف
      let csvContent = '\uFEFF';
      csvContent += `تقرير مركز الإسكندرية التخصصي للعلاج الطبيعي (ASCPT) - تاريخ: ${dateStr}\r\n\r\n`;
      csvContent += `إجمالي المرضى,${allSessions.length},إيراد نقدي,${totalCash} ج.م,مصروفات,${totalExp} ج.م,صافي الدرج,${netCash} ج.م\r\n\r\n`;
      csvContent += 'م,اسم المريض,الطبيب المعالج,نظام الحساب,شركة التأمين,نوع التعاقد,الأعضاء المعالجة,المبلغ المسدد (ج.م),المسؤول,الوقت\r\n';

      allSessions.forEach((s, idx) => {
        const partsStr = Array.isArray(s.bodyParts) ? s.bodyParts.join(' - ') : '';
        const contract = s.contractType === 'direct' ? 'مباشر' : (s.contractType === 'indirect' ? 'غير مباشر' : '-');
        csvContent += `${idx + 1},"${s.patientName}","${s.doctor}",${s.payType === 'cash' ? 'نقدي' : 'تأمين'},"${s.insuranceName || '-'}","${contract}","${partsStr}",${s.amountPaid},"${s.recordedBy}","${s.recordedAt}"\r\n`;
      });

      if (allExpenses.length > 0) {
        csvContent += '\r\nالمصروفات اليومية:\r\nم,بند المصروف,المبلغ (ج.م),المسؤول عن الصرف,الوقت\r\n';
        allExpenses.forEach((e, idx) => {
          csvContent += `${idx + 1},"${e.title}",${e.amount},"${e.recordedBy}","${e.time}"\r\n`;
        });
      }

      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `تقرير_ASCPT_اليومي_${dateStr}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      this.app.showToast('تم تصدير ملف Excel بنجاح');
    } catch (err) {
      console.error('Export error:', err);
      this.app.showAlert('تعذر تصدير الملف: ' + err.message, 'تنبيه', 'danger');
    }
  }

  printReport() {
    try {
      const dateStr = this.financeManager?.currentDate || new Date().toISOString().split('T')[0];
      const metaEl = document.getElementById('print-report-meta');
      if (metaEl) {
        const now = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
        metaEl.textContent = `التاريخ: ${dateStr} | وقت الطباعة: ${now}`;
      }

      // الانتقال الفوري لشاشة الحسابات
      if (this.app && this.app.currentView !== 'finance') {
        this.app.switchView('finance');
      }

      // استدعاء أمر الطباعة المباشر لنظام الهاتف
      window.print();
    } catch (err) {
      console.error('Print trigger error:', err);
      window.print();
    }
  }
}
