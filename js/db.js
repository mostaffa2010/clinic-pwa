// ========================================================
// PhysioCare - Unified Database Module (Cloud Firestore + LocalStorage)
// ========================================================

import { isFirebaseConfigured, firebaseConfig } from './firebase-config.js';

let firestoreInstance = null;
let firestoreMethods = null;

// تهيئة Firebase Firestore إذا تم وضع المفاتيح
if (isFirebaseConfigured) {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const fstore = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js');
    
    const fbApp = initializeApp(firebaseConfig);
    firestoreInstance = fstore.getFirestore(fbApp);
    firestoreMethods = fstore;
    console.log('Firebase Cloud Firestore initialized successfully.');
  } catch (err) {
    console.warn('Failed to load Firebase modules, falling back to local database:', err);
  }
}

class DatabaseService {
  constructor() {
    this.isFirestore = Boolean(firestoreInstance && firestoreMethods);
    if (!this.isFirestore) {
      this.initLocalStorage();
    }
  }

  initLocalStorage() {
    if (!localStorage.getItem('pc_patients')) {
      localStorage.setItem('pc_patients', JSON.stringify([]));
    }
    if (!localStorage.getItem('pc_users')) {
      localStorage.setItem('pc_users', JSON.stringify([
        { id: 'u-admin', name: 'د. مصطفى محمود', email: 'admin@clinic.com', password: '123', role: 'admin' },
        { id: 'u-doc1', name: 'د. أحمد خليل', email: 'ahmed@clinic.com', password: '123', role: 'doctor' },
        { id: 'u-doc2', name: 'د. سارة عادل', email: 'sara@clinic.com', password: '123', role: 'doctor' },
        { id: 'u-rec', name: 'أ. منار خالد', email: 'rec@clinic.com', password: '123', role: 'receptionist' }
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

  // مسح البيانات التجريبية بالكامل والبدء بسجل نظيف
  clearDemoData() {
    localStorage.setItem('pc_patients', JSON.stringify([]));
    localStorage.setItem('pc_sessions', JSON.stringify([]));
    localStorage.setItem('pc_expenses', JSON.stringify([]));
    localStorage.setItem('pc_audit_logs', JSON.stringify([]));
  }

  // =================== PATIENTS ===================
  async getPatients() {
    if (this.isFirestore) {
      try {
        const { collection, getDocs, query, orderBy } = firestoreMethods;
        const snap = await getDocs(collection(firestoreInstance, 'patients'));
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('Firestore getPatients error:', err);
      }
    }
    const raw = localStorage.getItem('pc_patients');
    return raw ? JSON.parse(raw) : [];
  }

  async savePatient(patientData, currentUser) {
    if (this.isFirestore) {
      try {
        const { collection, addDoc, doc, updateDoc } = firestoreMethods;
        if (patientData.id) {
          const docRef = doc(firestoreInstance, 'patients', patientData.id);
          const { id, ...dataToUpdate } = patientData;
          await updateDoc(docRef, {
            ...dataToUpdate,
            lastUpdatedAt: new Date().toISOString(),
            lastUpdatedBy: currentUser?.name || 'مستخدم'
          });
          return 'updated';
        } else {
          const { id, ...newPatientData } = patientData;
          await addDoc(collection(firestoreInstance, 'patients'), {
            ...newPatientData,
            createdAt: new Date().toISOString(),
            createdBy: currentUser?.name || 'مستخدم',
            lastUpdatedBy: currentUser?.name || 'مستخدم'
          });
          return 'created';
        }
      } catch (err) {
        console.error('Firestore savePatient error:', err);
      }
    }

    // LocalStorage Fallback
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
    if (this.isFirestore) {
      try {
        const { doc, deleteDoc } = firestoreMethods;
        await deleteDoc(doc(firestoreInstance, 'patients', patientId));
        return true;
      } catch (err) {
        console.error('Firestore deletePatient error:', err);
      }
    }

    let patients = await this.getPatients();
    patients = patients.filter(p => p.id !== patientId);
    localStorage.setItem('pc_patients', JSON.stringify(patients));
    return true;
  }

  // =================== SESSIONS ===================
  async getSessions(filterDate = null) {
    if (this.isFirestore) {
      try {
        const { collection, getDocs, query, where } = firestoreMethods;
        let q = collection(firestoreInstance, 'sessions');
        if (filterDate) {
          q = query(q, where('date', '==', filterDate));
        }
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('Firestore getSessions error:', err);
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
    if (this.isFirestore) {
      try {
        const { collection, addDoc } = firestoreMethods;
        const newSession = {
          ...sessionData,
          recordedAt: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          recordedBy: currentUser?.name || 'مستخدم'
        };
        const docRef = await addDoc(collection(firestoreInstance, 'sessions'), newSession);
        return { id: docRef.id, ...newSession };
      } catch (err) {
        console.error('Firestore saveSession error:', err);
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
    if (this.isFirestore) {
      try {
        const { doc, deleteDoc } = firestoreMethods;
        await deleteDoc(doc(firestoreInstance, 'sessions', sessionId));
        return true;
      } catch (err) {
        console.error('Firestore deleteSession error:', err);
      }
    }

    let sessions = await this.getSessions();
    sessions = sessions.filter(s => s.id !== sessionId);
    localStorage.setItem('pc_sessions', JSON.stringify(sessions));
    return true;
  }

  // =================== EXPENSES ===================
  async getExpenses(filterDate = null) {
    if (this.isFirestore) {
      try {
        const { collection, getDocs, query, where } = firestoreMethods;
        let q = collection(firestoreInstance, 'expenses');
        if (filterDate) {
          q = query(q, where('date', '==', filterDate));
        }
        const snap = await getDocs(q);
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('Firestore getExpenses error:', err);
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
    if (this.isFirestore) {
      try {
        const { collection, addDoc } = firestoreMethods;
        const newExp = {
          ...expenseData,
          time: new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }),
          recordedBy: currentUser?.name || 'مستخدم'
        };
        const docRef = await addDoc(collection(firestoreInstance, 'expenses'), newExp);
        return { id: docRef.id, ...newExp };
      } catch (err) {
        console.error('Firestore saveExpense error:', err);
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
    if (this.isFirestore) {
      try {
        const { collection, getDocs } = firestoreMethods;
        const snap = await getDocs(collection(firestoreInstance, 'users'));
        return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      } catch (err) {
        console.error('Firestore getUsers error:', err);
      }
    }

    const raw = localStorage.getItem('pc_users');
    return raw ? JSON.parse(raw) : [];
  }

  async saveUser(userData) {
    if (this.isFirestore) {
      try {
        const { collection, addDoc } = firestoreMethods;
        const docRef = await addDoc(collection(firestoreInstance, 'users'), userData);
        return { id: docRef.id, ...userData };
      } catch (err) {
        console.error('Firestore saveUser error:', err);
      }
    }

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
    if (this.isFirestore) {
      try {
        const { doc, deleteDoc } = firestoreMethods;
        await deleteDoc(doc(firestoreInstance, 'users', userId));
        return true;
      } catch (err) {
        console.error('Firestore deleteUser error:', err);
      }
    }

    let users = await this.getUsers();
    users = users.filter(u => u.id !== userId);
    localStorage.setItem('pc_users', JSON.stringify(users));
    return true;
  }

  // =================== AUDIT LOGS ===================
  async getAuditLogs() {
    if (this.isFirestore) {
      try {
        const { collection, getDocs } = firestoreMethods;
        const snap = await getDocs(collection(firestoreInstance, 'audit_logs'));
        const logs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return logs.sort((a, b) => (b.timestampRaw || 0) - (a.timestampRaw || 0));
      } catch (err) {
        console.error('Firestore getAuditLogs error:', err);
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

    if (this.isFirestore) {
      try {
        const { collection, addDoc } = firestoreMethods;
        await addDoc(collection(firestoreInstance, 'audit_logs'), newLog);
        return;
      } catch (err) {
        console.error('Firestore logAudit error:', err);
      }
    }

    const logs = await this.getAuditLogs();
    logs.unshift({ id: 'log-' + Date.now(), ...newLog });
    if (logs.length > 200) logs.pop();
    localStorage.setItem('pc_audit_logs', JSON.stringify(logs));
  }
}

export const db = new DatabaseService();
