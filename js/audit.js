// ========================================================
// PhysioCare - Audit Trail & Staff Admin Management
// ========================================================

import { db } from './db.js';
import { auth } from './auth.js';
import { RolesManager } from './roles.js';
import { firebaseConfig, isFirebaseConfigured } from './firebase-config.js';

export class AuditAndAdminManager {
  constructor(app) {
    this.app = app;
  }

  async init() {
    this.bindEvents();
    await this.loadUsers();
    await this.loadAuditLogs();
  }

  bindEvents() {
    const formAddUser = document.getElementById('form-add-user');
    if (formAddUser) {
      formAddUser.addEventListener('submit', (e) => this.handleAddUser(e));
    }
  }

  async handleAddUser(e) {
    e.preventDefault();
    const currentUser = auth.getCurrentUser();
    if (!RolesManager.canManageUsers(currentUser)) {
      await this.app.showAlert('عذراً، هذه الصلاحية لمدير المركز فقط.', 'تنبيه', 'warning');
      return;
    }

    const name = document.getElementById('newuser-name').value.trim();
    const email = document.getElementById('newuser-email').value.trim().toLowerCase();
    const password = document.getElementById('newuser-password').value;
    const role = document.getElementById('newuser-role').value;

    const existingUsers = await db.getUsers();
    if (existingUsers.some(u => u.email === email)) {
      await this.app.showAlert('هذا البريد أو اسم المستخدم مسجل بالفعل في المركز.', 'تنبيه', 'warning');
      return;
    }

    const newUser = {
      name,
      email,
      password,
      role
    };

    // إنشاء المستخدم في Firebase Authentication سحابياً
    if (isFirebaseConfigured && window.firebase) {
      try {
        const secApp = window.firebase.initializeApp(firebaseConfig, 'SecondaryAuth_' + Date.now());
        await secApp.auth().createUserWithEmailAndPassword(email, password);
        await secApp.delete();
        console.log('User created in Firebase Auth:', email);
      } catch (authErr) {
        console.warn('Firebase Auth user create note:', authErr.message);
      }
    }

    await db.saveUser(newUser);
    await db.logAudit('إضافة موظف', `قام المدير بإضافة مستخدم جديد: ${name} بدقة دور (${RolesManager.getRoleLabel(role)})`, currentUser);
    await this.app.populateDoctorDropdowns();

    document.getElementById('form-add-user').reset();
    this.app.showToast('تم إنشاء حساب المستخدم بنجاح');
    await this.loadUsers();
    await this.loadAuditLogs();
  }

  async loadUsers() {
    const tbody = document.getElementById('admin-users-tbody');
    if (!tbody) return;

    const users = await db.getUsers();
    const currentUser = auth.getCurrentUser();

    tbody.innerHTML = users.map(u => {
      const isSelf = currentUser && currentUser.id === u.id;
      return `
        <tr>
          <td style="font-weight: 700;">${u.name}</td>
          <td>${u.email}</td>
          <td><span class="badge badge-role-${u.role}">${RolesManager.getRoleLabel(u.role)}</span></td>
          <td>
            ${!isSelf ? `
              <button class="btn btn-outline btn-sm" style="color: var(--danger);" onclick="auditManager.deleteUser('${u.id}', '${u.name}')" title="حذف المستخدم">
                <i class="fa-solid fa-trash"></i>
              </button>
            ` : '<span style="font-size: 0.8rem; color: var(--text-muted);">حسابك الحالي</span>'}
          </td>
        </tr>
      `;
    }).join('');
  }

  async deleteUser(userId, userName) {
    const confirmed = await this.app.showConfirm(`هل أنت متأكد من حذف حساب الموظف: ${userName}؟`, 'تأكيد الحذف');
    if (confirmed) {
      const currentUser = auth.getCurrentUser();
      await db.deleteUser(userId);
      await db.logAudit('حذف موظف', `قام المدير بحذف حساب: ${userName}`, currentUser);
      this.app.showToast('تم حذف المستخدم');
      await this.loadUsers();
      await this.loadAuditLogs();
    }
  }

  async loadAuditLogs() {
    const tbody = document.getElementById('audit-log-tbody');
    if (!tbody) return;

    const logs = await db.getAuditLogs();
    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-muted); padding: 20px;">لا توجد سجلات تعديل مسجلة حتى الآن.</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(l => `
      <tr>
        <td style="font-weight: 700;">${l.userName}</td>
        <td><span class="badge badge-role-${l.userRole}">${RolesManager.getRoleLabel(l.userRole)}</span></td>
        <td><span class="badge badge-direct">${l.actionType}</span></td>
        <td>${l.description}</td>
        <td style="font-size: 0.8rem; color: var(--text-muted);">${l.timestamp}</td>
      </tr>
    `).join('');
  }
}
