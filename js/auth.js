// ========================================================
// PhysioCare - Authentication & Session Management (Firebase + Local)
// ========================================================

import { isFirebaseConfigured, firebaseConfig } from './firebase-config.js';
import { db } from './db.js';
import { RolesManager } from './roles.js';

let firebaseAuthInstance = null;
let firebaseAuthMethods = null;

if (isFirebaseConfigured) {
  try {
    const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js');
    const authModule = await import('https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js');
    const fbApp = initializeApp(firebaseConfig);
    firebaseAuthInstance = authModule.getAuth(fbApp);
    firebaseAuthMethods = authModule;
    console.log('Firebase Authentication initialized successfully.');
  } catch (err) {
    console.warn('Failed to load Firebase Auth, falling back to local auth:', err);
  }
}

class AuthService {
  constructor() {
    this.currentUser = null;
    this.isFirebaseAuth = Boolean(firebaseAuthInstance && firebaseAuthMethods);
  }

  async init(onUserChanged) {
    this.onUserChanged = onUserChanged;
    const saved = localStorage.getItem('pc_current_user');
    if (saved) {
      this.currentUser = JSON.parse(saved);
      this.updateUI();
      if (this.onUserChanged) this.onUserChanged(this.currentUser);
    } else {
      this.showLoginModal();
    }
  }

  getCurrentUser() {
    return this.currentUser;
  }

  showLoginModal() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.add('active');
  }

  hideLoginModal() {
    const modal = document.getElementById('modal-auth');
    if (modal) modal.classList.remove('active');
  }

  async login(email, password) {
    const cleanEmail = email.trim().toLowerCase();

    // 1. إذا كان Firebase مفعل
    if (this.isFirebaseAuth) {
      try {
        const { signInWithEmailAndPassword } = firebaseAuthMethods;
        const cred = await signInWithEmailAndPassword(firebaseAuthInstance, cleanEmail, password);
        
        // جلب دور المستخدم من قاعدة البيانات
        const users = await db.getUsers();
        let matchedUser = users.find(u => u.email.toLowerCase() === cleanEmail);

        if (!matchedUser) {
          // إذا كان أول مستخدم يدخل للنظام نعتبره مدير المركز
          matchedUser = {
            id: cred.user.uid,
            name: cred.user.displayName || 'مدير المركز',
            email: cleanEmail,
            role: 'admin'
          };
          await db.saveUser(matchedUser);
        }

        this.currentUser = {
          id: matchedUser.id || cred.user.uid,
          name: matchedUser.name,
          email: cleanEmail,
          role: matchedUser.role || 'admin'
        };

        localStorage.setItem('pc_current_user', JSON.stringify(this.currentUser));
        this.hideLoginModal();
        this.updateUI();
        await db.logAudit('تسجيل دخول سحابي', `دخول ناجح للمستخدم: ${this.currentUser.name}`, this.currentUser);
        if (this.onUserChanged) this.onUserChanged(this.currentUser);
        return { success: true };
      } catch (fbErr) {
        console.error('Firebase Auth Error:', fbErr);
        let msg = 'فشل تسجيل الدخول عبر السحابة. تأكد من البريد وكلمة المرور.';
        if (fbErr.code === 'auth/user-not-found' || fbErr.code === 'auth/wrong-password' || fbErr.code === 'auth/invalid-credential') {
          msg = 'البريد الإلكتروني أو كلمة المرور غير صحيحة.';
        }
        return { success: false, message: msg };
      }
    }

    // 2. الوضع المحلي (Local fallback)
    const users = await db.getUsers();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail && u.password === password);
    
    if (user) {
      this.currentUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };
      localStorage.setItem('pc_current_user', JSON.stringify(this.currentUser));
      this.hideLoginModal();
      this.updateUI();
      await db.logAudit('تسجيل دخول', `قام المستخدم ${user.name} بتسجيل الدخول للنظام`, this.currentUser);
      if (this.onUserChanged) this.onUserChanged(this.currentUser);
      return { success: true };
    } else {
      return { success: false, message: 'بيانات الدخول غير صحيحة، يرجى التأكد من البريد وكلمة المرور.' };
    }
  }

  async quickDemoLogin(role) {
    const users = await db.getUsers();
    const user = users.find(u => u.role === role) || users[0];
    if (user) {
      this.currentUser = {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role
      };
      localStorage.setItem('pc_current_user', JSON.stringify(this.currentUser));
      this.hideLoginModal();
      this.updateUI();
      await db.logAudit('دخول تجريبي', `تم الدخول بحساب ${user.name} (${RolesManager.getRoleLabel(user.role)})`, this.currentUser);
      if (this.onUserChanged) this.onUserChanged(this.currentUser);
    }
  }

  async logout() {
    if (this.isFirebaseAuth) {
      try {
        const { signOut } = firebaseAuthMethods;
        await signOut(firebaseAuthInstance);
      } catch (e) {
        console.error('SignOut error:', e);
      }
    }

    if (this.currentUser) {
      await db.logAudit('تسجيل خروج', `قام المستخدم ${this.currentUser.name} بالخروج من النظام`, this.currentUser);
    }

    this.currentUser = null;
    localStorage.removeItem('pc_current_user');
    this.updateUI();
    this.showLoginModal();
    if (this.onUserChanged) this.onUserChanged(null);
  }

  updateUI() {
    const headerDisplay = document.getElementById('header-user-display');
    const sidebarName = document.getElementById('sidebar-user-name');
    const sidebarRole = document.getElementById('sidebar-user-role');

    if (this.currentUser) {
      const roleText = RolesManager.getRoleLabel(this.currentUser.role);
      if (headerDisplay) headerDisplay.textContent = `${this.currentUser.name} (${roleText})`;
      if (sidebarName) sidebarName.textContent = this.currentUser.name;
      if (sidebarRole) {
        sidebarRole.textContent = roleText;
        sidebarRole.className = `badge badge-role-${this.currentUser.role}`;
      }
      RolesManager.applyPermissions(this.currentUser);
    } else {
      if (headerDisplay) headerDisplay.textContent = 'غير مسجل';
      if (sidebarName) sidebarName.textContent = 'زائر';
    }
  }
}

export const auth = new AuthService();
