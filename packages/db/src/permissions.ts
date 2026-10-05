/** M15-FR-01/02 · Roles and permissions, checked on the server. */
export const STAFF_ROLES = ['volunteer', 'supervisor', 'content_editor', 'publisher', 'privacy_officer', 'admin'] as const;
export type StaffRole = (typeof STAFF_ROLES)[number];

export const PERMISSIONS = ['dashboard.read', 'customers.read', 'rules.read', 'rules.edit', 'rules.publish', 'audit.read', 'staff.manage', 'cases.work', 'cases.manage'] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<StaffRole, readonly Permission[]> = {
  volunteer: ['dashboard.read', 'customers.read', 'cases.work'],
  supervisor: ['dashboard.read', 'customers.read', 'cases.work', 'cases.manage'],
  content_editor: ['dashboard.read', 'rules.read', 'rules.edit'],
  publisher: ['dashboard.read', 'rules.read', 'rules.edit', 'rules.publish'],
  privacy_officer: ['dashboard.read', 'customers.read', 'audit.read'],
  admin: PERMISSIONS,
};

export function isStaffRole(value: string): value is StaffRole {
  return (STAFF_ROLES as readonly string[]).includes(value);
}

export function can(roles: readonly string[], permission: Permission): boolean {
  return roles.some((r) => isStaffRole(r) && MATRIX[r].includes(permission));
}
