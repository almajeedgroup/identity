/** F05 US2 · Staff sign-in: password + mandatory TOTP; lockout; lifecycle (M15-FR-06). */
import { eq } from 'drizzle-orm';
import { writeAudit } from '../audit';
import type { Db } from '../client';
import { decryptValue, encryptValue, hashPassword, verifyPassword, type Keyring } from '../crypto';
import { isStaffRole, type StaffRole } from '../permissions';
import { staffRoles, staffUsers } from '../schema';
import { generateTotpSecret, otpauthUri, verifyTotp } from '../totp';
import { createSession, markSessionMfa, revokeAllForStaff } from './sessions';

export const MIN_PASSWORD_LENGTH = 12;
export const MAX_FAILED_ATTEMPTS = 5;
export const LOCKOUT_MS = 15 * 60_000;

export async function createStaff(
  db: Db,
  input: { email: string; name: string; password: string; roles: StaffRole[] },
  actor: { kind: 'staff' | 'system'; id: string | null },
  now: Date = new Date(),
): Promise<string> {
  if (input.password.length < MIN_PASSWORD_LENGTH) throw new Error(`Passwords need at least ${MIN_PASSWORD_LENGTH} characters`);
  for (const r of input.roles) if (!isStaffRole(r)) throw new Error(`Unknown role ${r}`);
  const [row] = await db
    .insert(staffUsers)
    .values({ email: input.email.trim().toLowerCase(), name: input.name.trim(), passwordHash: await hashPassword(input.password), createdAt: now })
    .returning({ id: staffUsers.id });
  if (input.roles.length) await db.insert(staffRoles).values(input.roles.map((role) => ({ staffId: row!.id, role })));
  await writeAudit(db, { actorKind: actor.kind, actorId: actor.id, action: 'staff.created', subjectKind: 'staff', subjectId: row!.id, details: { roles: input.roles } }, now);
  return row!.id;
}

export type StaffSignIn = { ok: true; token: string; staffId: string; needsEnrolment: boolean } | { ok: false; error: 'invalid' | 'locked' | 'inactive' };

async function recordFailure(db: Db, staff: typeof staffUsers.$inferSelect, now: Date, action: string) {
  const failed = staff.failedAttempts + 1;
  const lock = failed >= MAX_FAILED_ATTEMPTS;
  await db
    .update(staffUsers)
    .set({ failedAttempts: lock ? 0 : failed, lockedUntil: lock ? new Date(now.getTime() + LOCKOUT_MS) : staff.lockedUntil })
    .where(eq(staffUsers.id, staff.id));
  await writeAudit(db, { actorKind: 'anonymous', action, subjectKind: 'staff', subjectId: staff.id, details: { locked: lock } }, now);
}

export async function staffSignIn(db: Db, email: string, password: string, now: Date = new Date()): Promise<StaffSignIn> {
  const [staff] = await db.select().from(staffUsers).where(eq(staffUsers.email, email.trim().toLowerCase())).limit(1);
  if (!staff) {
    await hashPassword(password); // similar timing for unknown accounts
    return { ok: false, error: 'invalid' };
  }
  if (staff.lockedUntil && now < staff.lockedUntil) return { ok: false, error: 'locked' };
  if (staff.status !== 'active') return { ok: false, error: 'inactive' };
  if (!(await verifyPassword(password, staff.passwordHash))) {
    await recordFailure(db, staff, now, 'auth.staff.password_failed');
    return { ok: false, error: 'invalid' };
  }
  await db.update(staffUsers).set({ failedAttempts: 0, lockedUntil: null }).where(eq(staffUsers.id, staff.id));
  const token = await createSession(db, { kind: 'staff', staffId: staff.id, mfaVerified: false }, now);
  await writeAudit(db, { actorKind: 'staff', actorId: staff.id, action: 'auth.staff.password_ok' }, now);
  return { ok: true, token, staffId: staff.id, needsEnrolment: !staff.totpEnabledAt };
}

/** Starts (or restarts, before confirmation) TOTP enrolment; returns the secret to show once. */
export async function beginTotpEnrolment(db: Db, keyring: Keyring, staffId: string): Promise<{ secret: string; uri: string }> {
  const [staff] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffId)).limit(1);
  if (!staff) throw new Error('No such staff member');
  if (staff.totpEnabledAt) throw new Error('2FA is already enrolled');
  const secret = generateTotpSecret();
  await db.update(staffUsers).set({ totpSecret: encryptValue(secret, keyring) }).where(eq(staffUsers.id, staffId));
  return { secret, uri: otpauthUri(secret, staff.email) };
}

export type TotpResult = { ok: true } | { ok: false; error: 'invalid' | 'locked' | 'not_enrolled' };

/** Confirms enrolment or verifies a sign-in; marks the session MFA-verified (F05-AC-2.1). */
export async function verifyStaffTotp(db: Db, keyring: Keyring, staffId: string, sessionToken: string, code: string, now: Date = new Date()): Promise<TotpResult> {
  const [staff] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffId)).limit(1);
  if (!staff?.totpSecret) return { ok: false, error: 'not_enrolled' };
  if (staff.lockedUntil && now < staff.lockedUntil) return { ok: false, error: 'locked' };
  const step = verifyTotp(decryptValue(staff.totpSecret, keyring), code.trim(), Math.floor(now.getTime() / 1000), staff.totpLastStep);
  if (step === null) {
    await recordFailure(db, staff, now, 'auth.staff.totp_failed');
    return { ok: false, error: 'invalid' };
  }
  const enrolling = !staff.totpEnabledAt;
  await db
    .update(staffUsers)
    .set({ totpLastStep: step, failedAttempts: 0, ...(enrolling ? { totpEnabledAt: now } : {}) })
    .where(eq(staffUsers.id, staffId));
  await markSessionMfa(db, sessionToken);
  await writeAudit(db, { actorKind: 'staff', actorId: staffId, action: enrolling ? 'auth.staff.totp_enrolled' : 'auth.staff.signed_in' }, now);
  return { ok: true };
}

/** M15-AC-1.3 / F05-AC-3.2 */
export async function setStaffStatus(db: Db, staffId: string, status: 'active' | 'suspended' | 'offboarded', actor: { kind: 'staff' | 'system'; id: string | null }, now: Date = new Date()) {
  const [staff] = await db.select().from(staffUsers).where(eq(staffUsers.id, staffId)).limit(1);
  if (!staff) throw new Error('No such staff member');
  if (staff.status === 'offboarded') throw new Error('Offboarding is final');
  await db
    .update(staffUsers)
    .set({ status, ...(status === 'offboarded' ? { offboardedAt: now } : {}) })
    .where(eq(staffUsers.id, staffId));
  if (status !== 'active') await revokeAllForStaff(db, staffId, now);
  await writeAudit(db, { actorKind: actor.kind, actorId: actor.id, action: `staff.${status}`, subjectKind: 'staff', subjectId: staffId }, now);
}
