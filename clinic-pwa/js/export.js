// ========================================================
// PhysioCare - Export & Wi-Fi Printing Module
// ========================================================

import { db } from './db.js';

export class ExportManager {
  constructor(app, financeManager) {
    this.app = app;
    this.financeManager = financeManager;
  }

  init() {
    const btnExcel = document.getElementById('btn-export-excel');
    if (btnExcel) {
      btnExcel.addEventListener('click', () => this.exportToExcel());
    }

    const btnPrint = document.getElementById('btn-print-report');
    if (btnPrint) {
      btnPrint.addEventListener('click', () => this.printReport());
    }
  }

  async exportToExcel() {
    if (typeof XLSX === 'undefined') {
      alert('مكتبة تصدير الإكسيل قيد التحميل، يرجى المحاولة بعد ثوانٍ.');
      return;
    }

    const exportMeta = this.financeManager.getDataForExport();
    const dateStr = exportMeta.date;
    const allSessions = await db.getSessions(dateStr);
    const allExpenses = await db.getExpenses(dateStr);

    // تجهيز بيانات الجلسات لورقة الإكسيل
    const sessionsData = allSessions.map((s, idx) => ({
      'م': idx + 1,
      'اسم المريض': s.patientName,
      'الطبيب المعالج': s.doctor,
      'نظام الحساب': s.payType === 'cash' ? 'نقدي' : 'تأمين',
      'شركة التأمين': s.insuranceName || '-',
      'نوع التعاقد': s.payType === 'insurance' ? (s.contractType === 'direct' ? 'مباشر' : 'غير مباشر') : '-',
      'عدد الأعضاء': s.bodyPartsCount,
      'الأعضاء المعالجة': s.bodyParts.join('، '),
      'المبلغ المقبوض (ج.م)': s.amountPaid,
      'مسجل الجلسة': s.recordedBy,
      'الوقت': s.recordedAt
    }));

    // تجهيز بيانات المصروفات
    const expensesData = allExpenses.map((e, idx) => ({
      'م': idx + 1,
      'بند المصروف': e.title,
      'المبلغ (ج.م)': e.amount,
      'المسؤول عن الصرف': e.recordedBy,
      'الوقت': e.time
    }));

    // حساب الإجماليات
    const totalCash = allSessions.reduce((acc, curr) => acc + (parseFloat(curr.amountPaid) || 0), 0);
    const totalExp = allExpenses.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
    const netCash = totalCash - totalExp;

    const summaryData = [
      { 'البيان': 'تاريخ التقرير', 'القيمة': dateStr },
      { 'البيان': 'إجمالي عدد المرضى المترددين', 'القيمة': allSessions.length },
      { 'البيان': 'إجمالي الإيرادات النقدية', 'القيمة': `${totalCash} ج.م` },
      { 'البيان': 'إجمالي المصروفات', 'القيمة': `${totalExp} ج.م` },
      { 'البيان': 'صافي النقدية بالدرج', 'القيمة': `${netCash} ج.م` }
    ];

    // إحصائيات الأطباء
    const docCounts = {};
    allSessions.forEach(s => { docCounts[s.doctor] = (docCounts[s.doctor] || 0) + 1; });
    Object.keys(docCounts).forEach(doc => {
      summaryData.push({ 'البيان': `عدد مرضى ${doc}`, 'القيمة': `${docCounts[doc]} مريض` });
    });

    // إنشاء ملف الإكسيل ومصنف العمل
    const wb = XLSX.utils.book_new();

    const wsSummary = XLSX.utils.json_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, wsSummary, 'ملخص الحسابات');

    const wsSessions = XLSX.utils.json_to_sheet(sessionsData.length ? sessionsData : [{ 'تنبيه': 'لا توجد جلسات مسجلة' }]);
    XLSX.utils.book_append_sheet(wb, wsSessions, 'حركات المرضى والجلسات');

    const wsExpenses = XLSX.utils.json_to_sheet(expensesData.length ? expensesData : [{ 'تنبيه': 'لا توجد مصروفات' }]);
    XLSX.utils.book_append_sheet(wb, wsExpenses, 'المصروفات اليومية');

    // تحميل الملف على الموبايل أو اللابتوب
    const filename = `تقرير_عيادة_العلاج_الطبيعي_${dateStr}.xlsx`;
    XLSX.writeFile(wb, filename);

    this.app.showToast('تم تصدير ملف Excel بنجاح');
  }

  printReport() {
    const exportMeta = this.financeManager.getDataForExport();
    const metaEl = document.getElementById('print-report-meta');
    if (metaEl) {
      const now = new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' });
      metaEl.textContent = `التاريخ: ${exportMeta.date} | وقت الطباعة: ${now}`;
    }

    // التأكد من التواجد في شاشة التقرير المالي قبل الطباعة
    this.app.switchView('finance');

    // استدعاء أمر الطباعة المباشر لنظام الهاتف
    setTimeout(() => {
      window.print();
    }, 200);
  }
}
