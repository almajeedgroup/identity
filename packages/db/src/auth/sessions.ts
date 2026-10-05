/** F05-FR-06 · Server-side sessions; the database stores only the token's hash. */
import { and, eq, isNull } from 'drizzle-orm';
import type { Db } from '../client';
import { randomToken, sha256Hex } from '../crypto';
import { sessions, staffRoles, staffUsers, users } from '../schema';

const HOUR = 3_600_000;
/** F05-EX-sessions */
export const SESSION_POLICY = {
  citizen: { idleMs: 72 * HOUR, maxMs: 14 * 24 * HOUR },
  staff: { idleMs: 30 * 60_000, maxMs: 12 * HOUR },
} as const;

export const SESSION_COOKIE = 'identity_session';

export async function createSession(
  db: Db,
  subject: { kind: 'citizen'; userId: string } | { kind: 'staff'; staffId: string; mfaVerified: boolean },
  now: Date = new Date(),
): Promise<string> {
  const token = randomToken();
  await db.insert(sessions).values({
    id: sha256Hex(token),
    kind: subject.kind,
    userId: subject.kind === 'citizen' ? subject.userId : null,
    staffId: subject.kind === 'staff' ? subject.staffId : null,
    mfaVerified: subject.kind === 'staff' ? subject.mfaVerified : false,
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(now.getTime() + SESSION_POLICY[subject.kind].maxMs),
  });
  return token;
}

export type ResolvedSession =
  | { kind: 'citizen'; sessionId: string; user: typeof users.$inferSelect }
  | { kind: 'staff'; sessionId: string; staff: typeof staffUsers.$inferSelect; roles: string[]; mfaVerified: boolean };

/** F05-AC-3.1/3.2 · null for unknown, revoked, expired, idle or inactive-staff sessions. */
export async function resolveSession(db: Db, token: string | undefined | null, now: Date = new Date()): Promise<ResolvedSession | null> {
  if (!token) return null;
  const id = sha256Hex(token);
  const [s] = await db.select().from(sessions).where(eq(sessions.id, id)).limit(1);
  if (!s || s.revokedAt) return null;
  const policy = SESSION_POLICY[s.kind];
  if (now >= s.expiresAt || now.getTime() - s.lastSeenAt.getTime() > policy.idleMs) {
    await db.update(sessions).set({ revokedAt: now }).where(eq(sessions.id, id));
    return null;
  }
  // Touch at most once a minute.
  if (now.getTime() - s.lastSeenAt.getTime() > 60_000) await db.update(sessions).set({ lastSeenAt: now }).where(eq(sessions.id, id));
  if (s.kind === 'citizen') {
    const [user] = await db.select().from(users).where(eq(users.id, s.userId!)).limit(1);
    return user ? { kind: 'citizen', sessionId: id, user } : null;
  }
  const [staff] = await db.select().from(staffUsers).where(eq(staffUsers.id, s.staffId!)).limit(1);
  if (!staff || staff.status !== 'active') return null;
  const roles = (await db.select({ role: staffRoles.role }).from(staffRoles).where(eq(staffRoles.staffId, staff.id))).map((r) => r.role);
  return { kind: 'staff', sessionId: id, staff, roles, mfaVerified: s.mfaVerified };
}

export async function revokeSessionByToken(db: Db, token: string, now: Date = new Date()) {
  await db.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.id, sha256Hex(token)), isNull(sessions.revokedAt)));
}

export async function revokeAllForStaff(db: Db, staffId: string, now: Date = new Date()) {
  await db.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.staffId, staffId), isNull(sessions.revokedAt)));
}

export async function revokeAllForUser(db: Db, userId: string, now: Date = new Date()) {
  await db.update(sessions).set({ revokedAt: now }).where(and(eq(sessions.userId, userId), isNull(sessions.revokedAt)));
}

export async function markSessionMfa(db: Db, token: string) {
  await db.update(sessions).set({ mfaVerified: true }).where(eq(sessions.id, sha256Hex(token)));
}
