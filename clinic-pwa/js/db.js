// ========================================================
// PhysioCare - Unified Database Module (Firestore + LocalStorage)
// ========================================================

import { isFirebaseConfigured, firebaseConfig } from './firebase-config.js';

// تهيئة البيانات الأولية الافتراضية للتجربة المباشرة
const DEFAULT_PATIENTS = [
  {
    id: 'p-1',
    name: 'محمود عبد العزيز',
    age: 42,
    phone: '01012345678',
    address: 'الإسكندرية - سموحة',
    doctor: 'د. مصطفى',
    billing: 'cash',
    insuranceCompany: '',
    contractType: '',
    createdAt: '2026-09-01T09:00:00',
    createdBy: 'منار (استقبال)',
    lastUpdatedBy: 'د. مصطفى'
  },
  {
    id: 'p-2',
    name: 'فاطمة إبراهيم',
    age: 36,
    phone: '01298765432',
    address: 'الإسكندرية - سيدي جابر',
    doctor: 'د. سارة',
    billing: 'insurance',
    insuranceCompany: 'أكسا (AXA)',
    contractType: 'direct',
    createdAt: '2026-09-01T11:30:00',
    createdBy: 'منار (استقبال)',
    lastUpdatedBy: 'منار (استقبال)'
  },
  {
    id: 'p-3',
    name: 'عمرو حسام الدين',
    age: 29,
    phone: '01155443322',
    address: 'الإسكندرية - لوران',
    doctor: 'د. أحمد',
    billing: 'insurance',
    insuranceCompany: 'نكست كير (NextCare)',
    contractType: 'indirect',
    createdAt: '2026-09-02T08:15:00',
    createdBy: 'د. مصطفى',
    lastUpdatedBy: 'د. مصطفى'
  }
];

const DEFAULT_USERS = [
  { id: 'u-1', name: 'د. مصطفى محمود', email: 'admin@clinic.com', password: '123', role: 'admin' },
  { id: 'u-2', name: 'د. أحمد خليل', email: 'ahmed@clinic.com', password: '123', role: 'doctor' },
  { id: 'u-3', name: 'د. سارة عادل', email: 'sara@clinic.com', password: '123', role: 'doctor' },
  { id: 'u-4', name: 'أ. منار خالد', email: 'rec@clinic.com', password: '123', role: 'receptionist' }
];

class DatabaseService {
  constructor() {
    this.initStorage();
  }

  initStorage() {
    if (!localStorage.getItem('pc_patients')) {
      localStorage.setItem('pc_patients', JSON.stringify(DEFAULT_PATIENTS));
    }
    if (!localStorage.getItem('pc_users')) {
      localStorage.setItem('pc_users', JSON.stringify(DEFAULT_USERS));
    }
    if (!localStorage.getItem('pc_sessions')) {
      localStorage.setItem('pc_sessions', JSON.stringify([]));
    }
    if (!localStorage.getItem('pc_expenses')) {
      localStorage.setItem('pc_expenses', JSON.stringify([]));
    }
    if (!localStorage.getItem('pc_audit_logs')) {
      localStorage.setItem('pc_audit_logs', JSON.stringify([]));
    }
  }

  // Patients
  async getPatients() {
    const raw = localStorage.getItem('pc_patients');
    return raw ? JSON.parse(raw) : [];
  }

  async savePatient(patientData, currentUser) {
    const patients = await this.getPatients();
    let isEdit = false;

    if (patientData.id) {
      // Edit
      isEdit = true;
      const index = patients.findIndex(p => p.id === patientData.id);
      if (index !== -1) {
        patients[index] = {
          ...patients[index],
          ...patientData,
          lastUpdatedAt: new Date().toISOString(),
          lastUpdatedBy: currentUser?.name || 'مستخدم'
        };
      }
    } else {
      // Create new
      const newPatient = {
        ...patientData,
        id: 'p-' + Date.now(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || 'مستخدم',
        lastUpdatedBy: currentUser?.name || 'مستخدم'
      };
      patients.unshift(newPatient);
    }

    localStorage.setItem('pc_patients', JSON.stringify(patients));
    return isEdit ? 'updated' : 'created';
  }

  async deletePatient(patientId) {
    let patients = await this.getPatients();
    patients = patients.filter(p => p.id !== patientId);
    localStorage.setItem('pc_patients', JSON.stringify(patients));
    return true;
  }

  // Daily Sessions
  async getSessions(filterDate = null) {
    const raw = localStorage.getItem('pc_sessions');
    let sessions = raw ? JSON.parse(raw) : [];
    if (filterDate) {
      sessions = sessions.filter(s => s.date === filterDate);
    }
    return sessions;
  }

  async saveSession(sessionData, currentUser) {
    const sessions = await this.getSessions();
    const newSession = {
      ...sessionData,
      id: 'sess-' + Date.now(),
      recordedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      recordedBy: currentUser?.name || 'مستخدم'
    };
    sessions.unshift(newSession);
    localStorage.setItem('pc_sessions', JSON.stringify(sessions));
    return newSession;
  }

  async deleteSession(sessionId) {
    let sessions = await this.getSessions();
    sessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem('pc_sessions', JSON.stringify(sessions));
    return true;
  }

  // Daily Expenses
  async getExpenses(filterDate = null) {
    const raw = localStorage.getItem('pc_expenses');
    let expenses = raw ? JSON.parse(raw) : [];
    if (filterDate) {
      expenses = expenses.filter(e => e.date === filterDate);
    }
    return expenses;
  }

  async saveExpense(expenseData, currentUser) {
    const expenses = await this.getExpenses();
    const newExp = {
      ...expenseData,
      id: 'exp-' + Date.now(),
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      recordedBy: currentUser?.name || 'مستخدم'
    };
    expenses.unshift(newExp);
    localStorage.setItem('pc_expenses', JSON.stringify(expenses));
    return newExp;
  }

  // Users & Staff
  async getUsers() {
    const raw = localStorage.getItem('pc_users');
    return raw ? JSON.parse(raw) : DEFAULT_USERS;
  }

  async saveUser(userData) {
    const users = await this.getUsers();
    const newUser = {
      ...userData,
      id: 'u-' + Date.now()
    };
    users.push(newUser);
    localStorage.setItem('pc_users', JSON.stringify(users));
    return newUser;
  }

  async deleteUser(userId) {
    let users = await this.getUsers();
    users = users.filter(u => u.id !== userId);
    localStorage.setItem('pc_users', JSON.stringify(users));
    return true;
  }

  // Audit Logs
  async getAuditLogs() {
    const raw = localStorage.getItem('pc_audit_logs');
    return raw ? JSON.parse(raw) : [];
  }

  async logAudit(actionType, description, user) {
    const logs = await this.getAuditLogs();
    const newLog = {
      id: 'log-' + Date.now(),
      userName: user?.name || 'النظام',
      userRole: user?.role || 'غير محدد',
      actionType,
      description,
      timestamp: new Date().toLocaleString('ar-EG')
    };
    logs.unshift(newLog);
    // الاحتفاظ بآخر 200 سجل لمنع زيادة الحجم
    if (logs.length > 200) logs.pop();
    localStorage.setItem('pc_audit_logs', JSON.stringify(logs));
  }
}

export const db = new DatabaseService();
