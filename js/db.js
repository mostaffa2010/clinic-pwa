// ========================================================
// ASCPT - Unified Database Module (Cloud Firestore + LocalStorage)
// ========================================================

import { fbFirestore, isFirebaseConfigured } from './firebase-config.js';

class DatabaseService {
  constructor() {
    this.initLocalStorage();
    if (this.isTraining) {
      this.initSandboxData();
    }
  }

  get isTraining() {
    return localStorage.getItem('pc_mode_training') === 'true';
  }

  setTrainingMode(enabled) {
    localStorage.setItem('pc_mode_training', enabled ? 'true' : 'false');
    if (enabled) {
      this.initSandboxData();
    }
  }

  get firestore() {
    return fbFirestore;
  }

  get isCloud() {
    // في وضع التدريب يتم عزل السحابة تماماً لضمان عدم لمس بيانات المركز
    if (this.isTraining) return false;
    return Boolean(isFirebaseConfigured && this.firestore);
  }

  get kPatients() { return this.isTraining ? 'pc_sb_patients' : 'pc_patients'; }
  get kSessions() { return this.isTraining ? 'pc_sb_sessions' : 'pc_sessions'; }
  get kExpenses() { return this.isTraining ? 'pc_sb_expenses' : 'pc_expenses'; }
  get kUsers() { return this.isTraining ? 'pc_sb_users' : 'pc_users'; }
  get kAudit() { return this.isTraining ? 'pc_sb_audit_logs' : 'pc_audit_logs'; }

  initSandboxData(force = false) {
    if (!localStorage.getItem('pc_sb_patients') || force) {
      localStorage.setItem('pc_sb_patients', JSON.stringify([
        {
          id: 'sb-p1',
          name: 'أحمد محمود العطار (حالة تجريبية)',
          age: 38,
          phone: '01011223344',
          address: 'الإسكندرية - سموحة',
          doctor: 'د. مصطفى محمود',
          billing: 'cash',
          createdAt: new Date().toISOString(),
          createdBy: 'نظام التدريب',
          lastUpdatedBy: 'نظام التدريب',
          clinicalSheet: {
            diagnosis: 'انزلاق غضروفي قطني L4-L5 مع عرق النسا',
            affectedArea: 'الفقرات القطنية والطرف السفلي الأيمن',
            modalities: ['TENS (تيار تنبيهي)', 'كمادات ساخنة (Hot Pack)', 'الشد الفقري (Traction)'],
            customModalities: '',
            procedures: ['تحرير اللفافة العضلية (Myofascial Release)', 'إطالات عضلية (Muscle Stretching)'],
            customProcedures: '',
            exercises: ['تمارين التقوية العضلية (Strengthening)', 'تمارين عضلات الجذع (Core Stability)', 'برنامج التمارين المنزلية (Home Exercise Program)'],
            exerciseDetails: 'تمرين الجسر (Bridging) 3 مجموعات × 10 عدات، إطالة العضلة الكمثرية 30 ثانية 3 مرات يومياً',
            plannedSessions: '12 جلسة (بمعدل 3 جلسات أسبوعياً)',
            doctorNotes: 'تحسن في المدى الحركي وانخفاض حدة الألم في الساق اليمنى بنسبة 40%',
            lastUpdated: '2026-09-02 11:30 ص',
            updatedBy: 'د. مصطفى محمود'
          }
        },
        {
          id: 'sb-p2',
          name: 'مريم إبراهيم حسن (حالة تجريبية)',
          age: 45,
          phone: '01223344556',
          address: 'الإسكندرية - سيدي جابر',
          doctor: 'د. أحمد خليل',
          billing: 'insurance',
          insuranceCompany: 'أكسا (AXA)',
          contractType: 'direct',
          createdAt: new Date().toISOString(),
          createdBy: 'نظام التدريب',
          lastUpdatedBy: 'نظام التدريب'
        },
        {
          id: 'sb-p3',
          name: 'عمر عبد الرحمن علي (حالة تجريبية)',
          age: 29,
          phone: '01112233445',
          address: 'الإسكندرية - لوران',
          doctor: 'د. سارة عادل',
          billing: 'insurance',
          insuranceCompany: 'نكست كير (NextCare)',
          contractType: 'indirect',
          createdAt: new Date().toISOString(),
          createdBy: 'نظام التدريب',
          lastUpdatedBy: 'نظام التدريب'
        }
      ]));
    }

    const todayStr = new Date().toISOString().split('T')[0];
    if (!localStorage.getItem('pc_sb_sessions') || force) {
      localStorage.setItem('pc_sb_sessions', JSON.stringify([
        {
          id: 'sb-sess1',
          date: todayStr,
          patientId: 'sb-p1',
          patientName: 'أحمد محمود العطار (حالة تجريبية)',
          doctor: 'د. مصطفى محمود',
          bodyParts: ['أسفل الظهر / الفقرات القطنية', 'الرقبة'],
          bodyPartsCount: 2,
          payType: 'cash',
          amountPaid: 250,
          notes: 'جلسة أولى - تمارين استطالة وتقوية',
          recordedAt: '10:00 ص',
          recordedBy: 'أ. منار خالد (استقبال)'
        },
        {
          id: 'sb-sess2',
          date: todayStr,
          patientId: 'sb-p2',
          patientName: 'مريم إبراهيم حسن (حالة تجريبية)',
          doctor: 'د. أحمد خليل',
          bodyParts: ['الركبة'],
          bodyPartsCount: 1,
          payType: 'insurance',
          insuranceName: 'أكسا (AXA)',
          contractType: 'direct',
          amountPaid: 50,
          notes: 'نسبة تحمل نقدي',
          recordedAt: '11:15 ص',
          recordedBy: 'أ. منار خالد (استقبال)'
        }
      ]));
    }

    if (!localStorage.getItem('pc_sb_expenses') || force) {
      localStorage.setItem('pc_sb_expenses', JSON.stringify([
        {
          id: 'sb-exp1',
          date: todayStr,
          title: 'شراء جل علاج طبيعي ومستلزمات تدريبية',
          amount: 150,
          recordedBy: 'د. مصطفى محمود',
          time: '09:30 ص'
        }
      ]));
    }

    if (!localStorage.getItem('pc_sb_users') || force) {
      localStorage.setItem('pc_sb_users', JSON.stringify([
        { id: 'sb-u1', name: 'د. مصطفى محمود', email: 'admin@ascpt.com', role: 'admin' },
        { id: 'sb-u2', name: 'د. أحمد خليل', email: 'ahmed@ascpt.com', role: 'doctor' },
        { id: 'sb-u3', name: 'د. سارة عادل', email: 'sara@ascpt.com', role: 'doctor' },
        { id: 'sb-u4', name: 'أ. منار خالد', email: 'rec@ascpt.com', role: 'receptionist' }
      ]));
    }

    if (!localStorage.getItem('pc_sb_audit_logs') || force) {
      localStorage.setItem('pc_sb_audit_logs', JSON.stringify([
        {
          id: 'sb-log1',
          userName: 'نظام التدريب',
          userRole: 'النظام',
          actionType: 'بدء بيئة التدريب',
          description: 'تم تحميل عينات التدريب الافتراضية بنجاح',
          timestamp: new Date().toLocaleString('en-US'),
          timestampRaw: Date.now()
        }
      ]));
    }
  }

  initLocalStorage() {
    if (!localStorage.getItem(this.kPatients)) {
      localStorage.setItem(this.kPatients, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.kUsers)) {
      localStorage.setItem(this.kUsers, JSON.stringify([
        { id: 'u-admin', name: 'مدير المركز (Admin)', email: 'admin@ascpt.com', role: 'admin' }
      ]));
    }
    if (!localStorage.getItem(this.kSessions)) {
      localStorage.setItem(this.kSessions, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.kExpenses)) {
      localStorage.setItem(this.kExpenses, JSON.stringify([]));
    }
    if (!localStorage.getItem(this.kAudit)) {
      localStorage.setItem(this.kAudit, JSON.stringify([]));
    }
  }

  clearDemoData() {
    localStorage.setItem(this.kPatients, JSON.stringify([]));
    localStorage.setItem(this.kSessions, JSON.stringify([]));
    localStorage.setItem(this.kExpenses, JSON.stringify([]));
    localStorage.setItem(this.kAudit, JSON.stringify([]));
    localStorage.setItem(this.kUsers, JSON.stringify([
      { id: 'u-admin', name: 'مدير المركز (Admin)', email: 'admin@ascpt.com', role: 'admin' }
    ]));
  }

  async getDoctors() {
    const users = await this.getUsers();
    const docs = users
      .filter(u => u.role === 'doctor' || u.role === 'admin')
      .map(u => u.name);
    return docs.length > 0 ? Array.from(new Set(docs)) : ['مدير المركز'];
  }

  withTimeout(promise, timeoutMs = 4000) {
    let timer;
    const timeoutPromise = new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error('Firestore timeout')), timeoutMs);
    });
    return Promise.race([promise, timeoutPromise]).finally(() => clearTimeout(timer));
  }

  // =================== PATIENTS ===================
  async getPatients() {
    if (this.isCloud) {
      try {
        const snap = await this.withTimeout(this.firestore.collection('patients').get());
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn('Cloud getPatients failed, using local storage:', err);
      }
    }
    const raw = localStorage.getItem(this.kPatients);
    return raw ? JSON.parse(raw) : [];
  }

  async savePatient(patientData, currentUser) {
    if (this.isCloud) {
      try {
        if (patientData.id) {
          const { id, ...dataToUpdate } = patientData;
          await this.firestore.collection('patients').doc(id).update({
            ...dataToUpdate,
            lastUpdatedAt: new Date().toISOString(),
            lastUpdatedBy: currentUser?.name || 'مستخدم'
          });
          return 'updated';
        } else {
          const { id, ...newData } = patientData;
          await this.firestore.collection('patients').add({
            ...newData,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.name || 'مستخدم',
            lastUpdatedBy: currentUser?.name || 'مستخدم'
          });
          return 'created';
        }
      } catch (err) {
        console.warn('Cloud savePatient failed, saving locally:', err);
      }
    }

    const patients = await this.getPatients();
    let isEdit = false;

    if (patientData.id) {
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
      const newPatient = {
        ...patientData,
        id: 'p-' + Date.now(),
        createdAt: new Date().toISOString(),
        createdBy: currentUser?.name || 'مستخدم',
        lastUpdatedBy: currentUser?.name || 'مستخدم'
      };
      patients.unshift(newPatient);
    }

    localStorage.setItem(this.kPatients, JSON.stringify(patients));
    return isEdit ? 'updated' : 'created';
  }

  async deletePatient(patientId) {
    if (this.isCloud) {
      try {
        await this.firestore.collection('patients').doc(patientId).delete();
        return true;
      } catch (err) {
        console.warn('Cloud deletePatient failed, deleting locally:', err);
      }
    }

    let patients = await this.getPatients();
    patients = patients.filter(p => p.id !== patientId);
    localStorage.setItem(this.kPatients, JSON.stringify(patients));
    return true;
  }

  // =================== SESSIONS ===================
  async getSessions(filterDate = null) {
    if (this.isCloud) {
      try {
        let ref = this.firestore.collection('sessions');
        if (filterDate) {
          if (filterDate.length === 7) { // Monthly query: YYYY-MM
            ref = ref.where('date', '>=', `${filterDate}-01`).where('date', '<=', `${filterDate}-31`);
          } else {
            ref = ref.where('date', '==', filterDate);
          }
        }
        const snap = await this.withTimeout(ref.get());
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn('Cloud getSessions failed, using local storage:', err);
      }
    }

    const raw = localStorage.getItem(this.kSessions);
    let sessions = raw ? JSON.parse(raw) : [];
    if (filterDate) {
      if (filterDate.length === 7) {
        sessions = sessions.filter(s => s.date && s.date.startsWith(filterDate));
      } else {
        sessions = sessions.filter(s => s.date === filterDate);
      }
    }
    return sessions;
  }

  async saveSession(sessionData, currentUser) {
    if (this.isCloud) {
      try {
        if (sessionData.id) {
          const { id, ...dataToUpdate } = sessionData;
          await this.firestore.collection('sessions').doc(id).update({
            ...dataToUpdate,
            lastEditedBy: currentUser?.name || 'مستخدم',
            lastEditedAt: new Date().toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' })
          });
          return { id, ...sessionData };
        } else {
          const newSession = {
            ...sessionData,
            recordedAt: new Date().toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
            recordedBy: currentUser?.name || 'مستخدم'
          };
          const docRef = await this.firestore.collection('sessions').add(newSession);
          return { id: docRef.id, ...newSession };
        }
      } catch (err) {
        console.warn('Cloud saveSession failed, saving locally:', err);
      }
    }

    const sessions = await this.getSessions();
    let resSession = null;
    if (sessionData.id) {
      const idx = sessions.findIndex(s => s.id === sessionData.id);
      if (idx !== -1) {
        sessions[idx] = {
          ...sessions[idx],
          ...sessionData,
          lastEditedBy: currentUser?.name || 'مستخدم',
          lastEditedAt: new Date().toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' })
        };
        resSession = sessions[idx];
      }
    } else {
      const newSession = {
        ...sessionData,
        id: 'sess-' + Date.now(),
        recordedAt: new Date().toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
        recordedBy: currentUser?.name || 'مستخدم'
      };
      sessions.unshift(newSession);
      resSession = newSession;
    }
    localStorage.setItem(this.kSessions, JSON.stringify(sessions));
    return resSession;
  }

  async deleteSession(sessionId) {
    if (this.isCloud) {
      try {
        await this.firestore.collection('sessions').doc(sessionId).delete();
        return true;
      } catch (err) {
        console.warn('Cloud deleteSession failed, deleting locally:', err);
      }
    }

    let sessions = await this.getSessions();
    sessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem(this.kSessions, JSON.stringify(sessions));
    return true;
  }

  // =================== EXPENSES ===================
  async getExpenses(filterDate = null) {
    if (this.isCloud) {
      try {
        let ref = this.firestore.collection('expenses');
        if (filterDate) {
          if (filterDate.length === 7) { // Monthly query: YYYY-MM
            ref = ref.where('date', '>=', `${filterDate}-01`).where('date', '<=', `${filterDate}-31`);
          } else {
            ref = ref.where('date', '==', filterDate);
          }
        }
        const snap = await this.withTimeout(ref.get());
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn('Cloud getExpenses failed, using local storage:', err);
      }
    }

    const raw = localStorage.getItem(this.kExpenses);
    let expenses = raw ? JSON.parse(raw) : [];
    if (filterDate) {
      if (filterDate.length === 7) {
        expenses = expenses.filter(e => e.date && e.date.startsWith(filterDate));
      } else {
        expenses = expenses.filter(e => e.date === filterDate);
      }
    }
    return expenses;
  }

  async saveExpense(expenseData, currentUser) {
    if (this.isCloud) {
      try {
        const newExp = {
          ...expenseData,
          time: new Date().toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
          recordedBy: currentUser?.name || 'مستخدم'
        };
        const docRef = await this.firestore.collection('expenses').add(newExp);
        return { id: docRef.id, ...newExp };
      } catch (err) {
        console.warn('Cloud saveExpense failed, saving locally:', err);
      }
    }

    const expenses = await this.getExpenses();
    const newExp = {
      ...expenseData,
      id: 'exp-' + Date.now(),
      time: new Date().toLocaleTimeString('ar-EG-u-nu-latn', { hour: '2-digit', minute: '2-digit' }),
      recordedBy: currentUser?.name || 'مستخدم'
    };
    expenses.unshift(newExp);
    localStorage.setItem(this.kExpenses, JSON.stringify(expenses));
    return newExp;
  }

  async deleteExpense(expenseId) {
    if (this.isCloud) {
      try {
        await this.firestore.collection('expenses').doc(expenseId).delete();
        return true;
      } catch (err) {
        console.warn('Cloud deleteExpense failed, deleting locally:', err);
      }
    }

    let expenses = await this.getExpenses();
    expenses = expenses.filter(e => e.id !== expenseId);
    localStorage.setItem(this.kExpenses, JSON.stringify(expenses));
    return true;
  }

  // =================== USERS & ROLES ===================
  async getUsers() {
    if (this.isCloud) {
      try {
        const snap = await this.withTimeout(this.firestore.collection('users').get());
        if (!snap.empty) {
          return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
      } catch (err) {
        console.warn('Cloud getUsers failed, using local storage:', err);
      }
    }

    const raw = localStorage.getItem(this.kUsers);
    return raw ? JSON.parse(raw) : [];
  }

  async saveUser(userData) {
    if (this.isCloud) {
      try {
        const docRef = await this.firestore.collection('users').add(userData);
        return { id: docRef.id, ...userData };
      } catch (err) {
        console.warn('Cloud saveUser failed, saving locally:', err);
      }
    }

    const users = await this.getUsers();
    const newUser = { ...userData, id: 'u-' + Date.now() };
    users.push(newUser);
    localStorage.setItem(this.kUsers, JSON.stringify(users));
    return newUser;
  }

  async deleteUser(userId) {
    if (this.isCloud) {
      try {
        await this.firestore.collection('users').doc(userId).delete();
        return true;
      } catch (err) {
        console.warn('Cloud deleteUser failed, deleting locally:', err);
      }
    }

    let users = await this.getUsers();
    users = users.filter(u => u.id !== userId);
    localStorage.setItem(this.kUsers, JSON.stringify(users));
    return true;
  }

  // =================== AUDIT LOGS ===================
  async getAuditLogs() {
    if (this.isCloud) {
      try {
        const snap = await this.withTimeout(this.firestore.collection('audit_logs').orderBy('timestampRaw', 'desc').get());
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn('Cloud getAuditLogs failed, using local storage:', err);
      }
    }

    const raw = localStorage.getItem(this.kAudit);
    return raw ? JSON.parse(raw) : [];
  }

  async logAudit(actionType, description, user) {
    const newLog = {
      userName: user?.name || 'النظام',
      userRole: user?.role || 'غير محدد',
      actionType,
      description,
      timestamp: new Date().toLocaleString('en-US'),
      timestampRaw: Date.now()
    };

    if (this.isCloud) {
      try {
        await this.firestore.collection('audit_logs').add(newLog);
        return;
      } catch (err) {
        console.warn('Cloud logAudit failed, saving locally:', err);
      }
    }

    const logs = await this.getAuditLogs();
    logs.unshift({ id: 'log-' + Date.now(), ...newLog });
    if (logs.length > 200) logs.pop();
    localStorage.setItem(this.kAudit, JSON.stringify(logs));
  }
  // ================= Backup & Restore =================
  async createFullBackup() {
    const backup = {
      timestamp: new Date().toISOString(),
      center: 'Alexandria Specialist Center for Physical Therapy (ASCPT)',
      patients: await this.getPatients(),
      sessions: await this.getSessions(),
      expenses: await this.getExpenses(),
      users: await this.getUsers(),
      auditLogs: await this.getAuditLogs()
    };
    return backup;
  }

  async restoreFromBackup(backupData) {
    if (!backupData || !Array.isArray(backupData.patients)) {
      throw new Error('ملف النسخة الاحتياطية غير صالح أو تالف.');
    }
    localStorage.setItem(this.kPatients, JSON.stringify(backupData.patients || []));
    localStorage.setItem(this.kSessions, JSON.stringify(backupData.sessions || []));
    localStorage.setItem(this.kExpenses, JSON.stringify(backupData.expenses || []));
    if (Array.isArray(backupData.users) && backupData.users.length > 0) {
      localStorage.setItem(this.kUsers, JSON.stringify(backupData.users));
    }
    return true;
  }
}

export const db = new DatabaseService();
