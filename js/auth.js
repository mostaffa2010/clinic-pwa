// ========================================================
// ASCPT - Authentication & Session Management (Firebase + Local)
// ========================================================

import { fbAuth, isFirebaseConfigured } from './firebase-config.js';
import { db } from './db.js';
import { RolesManager } from './roles.js';

class AuthService {
  constructor() {
    this.currentUser = null;
  }

  get auth() {
    return fbAuth;
  }

  get isCloud() {
    return Boolean(isFirebaseConfigured && this.auth);
  }

  async init(onUserChanged) {
    this.onUserChanged = onUserChanged;

    // فحص المستخدم المحفوظ محلياً أولاً للسرعة
    const saved = localStorage.getItem('pc_current_user');
    if (saved) {
      const parsed = JSON.parse(saved);
      // تنظيف تلقائي لأي جلسة تجريبية قديمة مسجلة بالإيميل الافتراضي
      if (parsed.email && parsed.email.includes('clinic.com')) {
        localStorage.removeItem('pc_current_user');
        this.currentUser = null;
        this.showLoginModal();
      } else {
        this.currentUser = parsed;
        this.updateUI();
        if (this.onUserChanged) this.onUserChanged(this.currentUser);
      }
    } else {
      this.showLoginModal();
    }

    // الاستماع لحالة الدخول في Firebase
    if (this.isCloud) {
      this.auth.onAuthStateChanged(async (user) => {
        if (user && !this.currentUser) {
          const users = await db.getUsers();
          let matched = users.find(u => u.email.toLowerCase() === user.email.toLowerCase());
          this.currentUser = {
            id: user.uid,
            name: matched?.name || user.displayName || 'مدير المركز (ASCPT)',
            email: user.email,
            role: matched?.role || 'admin'
          };
          localStorage.setItem('pc_current_user', JSON.stringify(this.currentUser));
          this.hideLoginModal();
          this.updateUI();
          if (this.onUserChanged) this.onUserChanged(this.currentUser);
        }
      });
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

    // 1. تجربة الدخول السحابي أولاً إن أمكن
    if (this.isCloud) {
      try {
        const cred = await this.auth.signInWithEmailAndPassword(cleanEmail, password);
        const fbUser = cred.user;

        const users = await db.getUsers();
        let matchedUser = users.find(u => u.email.toLowerCase() === cleanEmail);

        if (!matchedUser) {
          matchedUser = {
            id: fbUser.uid,
            name: fbUser.displayName || (cleanEmail === 'admin@ascpt.com' ? 'مدير المركز (ASCPT)' : 'مستخدم المركز'),
            email: cleanEmail,
            role: 'admin'
          };
          await db.saveUser(matchedUser);
        }

        this.currentUser = {
          id: matchedUser.id || fbUser.uid,
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
        console.warn('Firebase login notice, checking local users:', fbErr.message);
      }
    }

    // 2. الدخول المحلي أو التجريبي
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
    const user = users.find(u => u.role === role) || {
      id: 'u-quick',
      name: role === 'admin' ? 'د. مصطفى محمود' : (role === 'doctor' ? 'د. أحمد خليل' : 'أ. منار خالد'),
      email: `${role}@ascpt.com`,
      role: role
    };

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

  async logout() {
    if (this.isCloud) {
      try {
        await this.auth.signOut();
      } catch (e) {
        console.warn('SignOut error:', e);
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
