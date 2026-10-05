import 'server-only';
import { can, resolveSession, SESSION_POLICY, writeAudit, type Permission, type tables } from '@identity/db';
import type { StaffActor } from '@identity/services';
import { cookies } from 'next/headers';
import { notFound, redirect } from 'next/navigation';
import { platform } from './platform';

/** F05-FR-10 · Staff use their own cookie, sent only to /staff. */
export const STAFF_COOKIE = 'identity_staff';

export interface StaffSession {
  token: string;
  staff: typeof tables.staffUsers.$inferSelect;
  roles: string[];
  mfaVerified: boolean;
}

export async function staffSession(): Promise<StaffSession | null> {
  const token = (await cookies()).get(STAFF_COOKIE)?.value;
  if (!token) return null;
  const session = await resolveSession((await platform()).db, token);
  // M15-AC-1.2 · a citizen session never opens a staff page.
  return session?.kind === 'staff' ? { token, staff: session.staff, roles: session.roles, mfaVerified: session.mfaVerified } : null;
}

/**
 * F05-AC-2.1 / M15-FR-02 · Signed in with password and TOTP, and holding the permission — otherwise sign-in,
 * the 2FA step, or "not found" with an `access.denied` event.
 */
export async function requireStaff(permission?: Permission) {
  const session = await staffSession();
  if (!session) redirect('/staff/sign-in');
  if (!session.mfaVerified) redirect(session.staff.totpEnabledAt ? '/staff/verify' : '/staff/enrol');
  const p = await platform();
  const actor: StaffActor = { id: session.staff.id, name: session.staff.name, roles: session.roles };
  if (permission && !can(session.roles, permission)) {
    await writeAudit(p.db, { actorKind: 'staff', actorId: actor.id, action: 'access.denied', details: { permission } });
    notFound();
  }
  return { actor, session, p, s: p.services, can: (perm: Permission) => can(session.roles, perm) };
}

export async function setStaffCookie(token: string) {
  const { config } = await platform();
  (await cookies()).set(STAFF_COOKIE, token, { httpOnly: true, sameSite: 'strict', secure: config.secureCookies, path: '/staff', maxAge: SESSION_POLICY.staff.maxMs / 1000 });
}

export async function clearStaffCookie() {
  (await cookies()).delete({ name: STAFF_COOKIE, path: '/staff' });
}
