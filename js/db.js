// ========================================================
// ASCPT - Unified Database Module (Cloud Firestore + LocalStorage)
// ========================================================

import { fbFirestore, isFirebaseConfigured } from './firebase-config.js';

class DatabaseService {
  constructor() {
    this.initLocalStorage();
  }

  get firestore() {
    return fbFirestore;
  }

  get isCloud() {
    return Boolean(isFirebaseConfigured && this.firestore);
  }

  initLocalStorage() {
    if (!localStorage.getItem('pc_patients')) {
      localStorage.setItem('pc_patients', JSON.stringify([]));
    }
    if (!localStorage.getItem('pc_users')) {
      localStorage.setItem('pc_users', JSON.stringify([
        { id: 'u-admin', name: 'مدير المركز (Admin)', email: 'admin@ascpt.com', role: 'admin' }
      ]));
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

  clearDemoData() {
    localStorage.setItem('pc_patients', JSON.stringify([]));
    localStorage.setItem('pc_sessions', JSON.stringify([]));
    localStorage.setItem('pc_expenses', JSON.stringify([]));
    localStorage.setItem('pc_audit_logs', JSON.stringify([]));
    localStorage.setItem('pc_users', JSON.stringify([
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

  // =================== PATIENTS ===================
  async getPatients() {
    if (this.isCloud) {
      try {
        const snap = await this.firestore.collection('patients').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn('Cloud getPatients failed, using local storage:', err);
      }
    }
    const raw = localStorage.getItem('pc_patients');
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

    localStorage.setItem('pc_patients', JSON.stringify(patients));
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
    localStorage.setItem('pc_patients', JSON.stringify(patients));
    return true;
  }

  // =================== SESSIONS ===================
  async getSessions(filterDate = null) {
    if (this.isCloud) {
      try {
        let ref = this.firestore.collection('sessions');
        if (filterDate) {
          ref = ref.where('date', '==', filterDate);
        }
        const snap = await ref.get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn('Cloud getSessions failed, using local storage:', err);
      }
    }

    const raw = localStorage.getItem('pc_sessions');
    let sessions = raw ? JSON.parse(raw) : [];
    if (filterDate) {
      sessions = sessions.filter(s => s.date === filterDate);
    }
    return sessions;
  }

  async saveSession(sessionData, currentUser) {
    if (this.isCloud) {
      try {
        const newSession = {
          ...sessionData,
          recordedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          recordedBy: currentUser?.name || 'مستخدم'
        };
        const docRef = await this.firestore.collection('sessions').add(newSession);
        return { id: docRef.id, ...newSession };
      } catch (err) {
        console.warn('Cloud saveSession failed, saving locally:', err);
      }
    }

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
    localStorage.setItem('pc_sessions', JSON.stringify(sessions));
    return true;
  }

  // =================== EXPENSES ===================
  async getExpenses(filterDate = null) {
    if (this.isCloud) {
      try {
        let ref = this.firestore.collection('expenses');
        if (filterDate) {
          ref = ref.where('date', '==', filterDate);
        }
        const snap = await ref.get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn('Cloud getExpenses failed, using local storage:', err);
      }
    }

    const raw = localStorage.getItem('pc_expenses');
    let expenses = raw ? JSON.parse(raw) : [];
    if (filterDate) {
      expenses = expenses.filter(e => e.date === filterDate);
    }
    return expenses;
  }

  async saveExpense(expenseData, currentUser) {
    if (this.isCloud) {
      try {
        const newExp = {
          ...expenseData,
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
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
      time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
      recordedBy: currentUser?.name || 'مستخدم'
    };
    expenses.unshift(newExp);
    localStorage.setItem('pc_expenses', JSON.stringify(expenses));
    return newExp;
  }

  // =================== USERS & ROLES ===================
  async getUsers() {
    if (this.isCloud) {
      try {
        const snap = await this.firestore.collection('users').get();
        if (!snap.empty) {
          return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        }
      } catch (err) {
        console.warn('Cloud getUsers failed, using local storage:', err);
      }
    }

    const raw = localStorage.getItem('pc_users');
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
    localStorage.setItem('pc_users', JSON.stringify(users));
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
    localStorage.setItem('pc_users', JSON.stringify(users));
    return true;
  }

  // =================== AUDIT LOGS ===================
  async getAuditLogs() {
    if (this.isCloud) {
      try {
        const snap = await this.firestore.collection('audit_logs').orderBy('timestampRaw', 'desc').get();
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.warn('Cloud getAuditLogs failed, using local storage:', err);
      }
    }

    const raw = localStorage.getItem('pc_audit_logs');
    return raw ? JSON.parse(raw) : [];
  }

  async logAudit(actionType, description, user) {
    const newLog = {
      userName: user?.name || 'النظام',
      userRole: user?.role || 'غير محدد',
      actionType,
      description,
      timestamp: new Date().toLocaleString('ar-EG'),
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
    localStorage.setItem('pc_audit_logs', JSON.stringify(logs));
  }
}

export const db = new DatabaseService();
