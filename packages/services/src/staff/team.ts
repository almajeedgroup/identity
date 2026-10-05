/** M15 US6 · Team management for admins; the console always keeps an admin (M15-AC-6.2). */
import { createStaff, isStaffRole, MIN_PASSWORD_LENGTH, setStaffStatus, tables, writeAudit, type StaffRole } from '@identity/db';
import { asc, eq } from 'drizzle-orm';
import { nowOf, ServiceError, type Services, type StaffActor } from '../services';
import { requirePermission } from './guard';

const { staffRoles, staffUsers } = tables;

export interface StaffMember {
  id: string;
  email: string;
  name: string;
  roles: string[];
  status: 'active' | 'suspended' | 'offboarded';
  twoFactor: boolean;
  createdAt: Date;
}

export async function listStaff(s: Services, actor: StaffActor): Promise<StaffMember[]> {
  await requirePermission(s, actor, 'staff.manage');
  const [people, roles] = await Promise.all([s.db.select().from(staffUsers).orderBy(asc(staffUsers.createdAt)), s.db.select().from(staffRoles)]);
  return people.map((p) => ({
    id: p.id,
    email: p.email,
    name: p.name,
    roles: roles.filter((r) => r.staffId === p.id).map((r) => r.role).sort(),
    status: p.status,
    twoFactor: !!p.totpEnabledAt,
    createdAt: p.createdAt,
  }));
}

function cleanRoles(roles: readonly string[]): StaffRole[] {
  const out = [...new Set(roles)].filter(isStaffRole);
  if (out.length === 0) throw new ServiceError('no_roles');
  return out;
}

/** M15-AC-6.1 */
export async function addStaff(s: Services, actor: StaffActor, input: { email: string; name: string; password: string; roles: readonly string[] }): Promise<string> {
  await requirePermission(s, actor, 'staff.manage');
  const email = input.email.trim().toLowerCase();
  const name = input.name.replace(/\s+/g, ' ').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !name || name.length > 120) throw new ServiceError('invalid_value');
  if (input.password.length < MIN_PASSWORD_LENGTH) throw new ServiceError('weak_password');
  const roles = cleanRoles(input.roles);
  const [taken] = await s.db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.email, email)).limit(1);
  if (taken) throw new ServiceError('email_taken');
  return createStaff(s.db, { email, name, password: input.password, roles }, { kind: 'staff', id: actor.id }, nowOf(s));
}

export async function setRoles(s: Services, actor: StaffActor, staffId: string, roles: readonly string[]): Promise<void> {
  await requirePermission(s, actor, 'staff.manage', { kind: 'staff', id: staffId });
  const next = cleanRoles(roles);
  if (staffId === actor.id && !next.includes('admin')) throw new ServiceError('self_lockout');
  const [person] = await s.db.select({ id: staffUsers.id }).from(staffUsers).where(eq(staffUsers.id, staffId)).limit(1);
  if (!person) throw new ServiceError('not_found');
  const now = nowOf(s);
  await s.db.transaction(async (tx) => {
    await tx.delete(staffRoles).where(eq(staffRoles.staffId, staffId));
    await tx.insert(staffRoles).values(next.map((role) => ({ staffId, role })));
  });
  // Roles are read on every request (F05), so new permissions apply at once.
  await writeAudit(s.db, { actorKind: 'staff', actorId: actor.id, action: 'staff.roles_changed', subjectKind: 'staff', subjectId: staffId, details: { roles: next } }, now);
}

/** M15-AC-1.3 · Suspension and offboarding revoke sessions at once. */
export async function changeStaffStatus(s: Services, actor: StaffActor, staffId: string, status: 'active' | 'suspended' | 'offboarded'): Promise<void> {
  await requirePermission(s, actor, 'staff.manage', { kind: 'staff', id: staffId });
  if (staffId === actor.id) throw new ServiceError('self_lockout');
  if (!['active', 'suspended', 'offboarded'].includes(status)) throw new ServiceError('invalid_value');
  const [person] = await s.db.select({ status: staffUsers.status }).from(staffUsers).where(eq(staffUsers.id, staffId)).limit(1);
  if (!person) throw new ServiceError('not_found');
  if (person.status === 'offboarded') throw new ServiceError('invalid_value');
  await setStaffStatus(s.db, staffId, status, { kind: 'staff', id: actor.id }, nowOf(s));
}
