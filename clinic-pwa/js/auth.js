// ========================================================
// PhysioCare - Authentication & Session Management
// ========================================================

import { db } from './db.js';
import { RolesManager } from './roles.js';

class AuthService {
  constructor() {
    this.currentUser = null;
  }

  async init(onUserChanged) {
    this.onUserChanged = onUserChanged;
    const saved = localStorage.getItem('pc_current_user');
    if (saved) {
      this.currentUser = JSON.parse(saved);
      this.updateUI();
      if (this.onUserChanged) this.onUserChanged(this.currentUser);
    } else {
      // Show login modal
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
    const users = await db.getUsers();
    const user = users.find(u => u.email.toLowerCase() === email.trim().toLowerCase() && u.password === password);
    
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

  logout() {
    if (this.currentUser) {
      db.logAudit('تسجيل خروج', `قام المستخدم ${this.currentUser.name} بالخروج من النظام`, this.currentUser);
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
