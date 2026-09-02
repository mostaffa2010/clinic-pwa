// ========================================================
// PhysioCare - Roles & Permissions System (RBAC)
// ========================================================

export const ROLES = {
  ADMIN: 'admin',
  DOCTOR: 'doctor',
  RECEPTIONIST: 'receptionist'
};

export const ROLE_LABELS = {
  admin: 'مدير المركز',
  doctor: 'طبيب معالج',
  receptionist: 'سكرتارية / استقبال'
};

export class RolesManager {
  static getRoleLabel(role) {
    return ROLE_LABELS[role] || role;
  }

  static applyPermissions(currentUser) {
    const role = currentUser ? currentUser.role : null;

    // عناصر خاصة بالمدير فقط (Admin Only)
    const adminElements = document.querySelectorAll('.admin-only');
    adminElements.forEach(el => {
      if (role === ROLES.ADMIN) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    });

    // إمكانية الحذف (للمدير فقط)
    const deleteButtons = document.querySelectorAll('.btn-delete-record');
    deleteButtons.forEach(btn => {
      if (role === ROLES.ADMIN) {
        btn.style.display = 'inline-flex';
      } else {
        btn.style.display = 'none';
      }
    });
  }

  static canDelete(currentUser) {
    return currentUser && currentUser.role === ROLES.ADMIN;
  }

  static canManageUsers(currentUser) {
    return currentUser && currentUser.role === ROLES.ADMIN;
  }
}
