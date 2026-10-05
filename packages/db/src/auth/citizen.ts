/** F05 US1 · Citizen sign-in with a one-time code. */
import { randomInt, randomUUID } from 'node:crypto';
import { and, count, desc, eq, gte, isNull } from 'drizzle-orm';
import { writeAudit } from '../audit';
import type { Db } from '../client';
import { constantTimeEqual, sha256Hex } from '../crypto';
import type { OtpSender } from '../otp';
import { otpChallenges, users } from '../schema';
import { createSession } from './sessions';

export const OTP_TTL_MS = 10 * 60_000;
export const OTP_MAX_ATTEMPTS = 5;
export const OTP_MAX_PER_HOUR = 5;
export const OTP_COOLDOWN_MS = 30_000;

/** F05-FR-01 / F05-EX-mobiles */
export function normaliseMobile(input: string): string | null {
  if (/[^\d\s+()-]/.test(input)) return null;
  let digits = input.replace(/\D/g, '');
  if (digits.length === 13 && digits.startsWith('091')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? `+91${digits}` : null;
}

/** A pseudonymous handle for audit events — never the number itself (M15-FR-03). */
export const mobileHandle = (mobile: string, pepper: string) => sha256Hex(`${pepper}:mobile:${mobile}`).slice(0, 16);

const codeHash = (pepper: string, challengeId: string, code: string) => sha256Hex(`${pepper}:${challengeId}:${code}`);

export interface OtpDeps {
  db: Db;
  sender: OtpSender;
  pepper: string;
  now?: Date;
}

export type RequestResult = { ok: true; mobile: string } | { ok: false; error: 'invalid_mobile' | 'too_soon' | 'too_many' };

export async function requestCode(deps: OtpDeps, mobileInput: string): Promise<RequestResult> {
  const now = deps.now ?? new Date();
  const mobile = normaliseMobile(mobileInput);
  if (!mobile) return { ok: false, error: 'invalid_mobile' };
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const [{ n }] = (await deps.db.select({ n: count() }).from(otpChallenges).where(and(eq(otpChallenges.mobile, mobile), gte(otpChallenges.createdAt, hourAgo)))) as [{ n: number }];
  if (n >= OTP_MAX_PER_HOUR) return { ok: false, error: 'too_many' };
  const [last] = await deps.db.select().from(otpChallenges).where(eq(otpChallenges.mobile, mobile)).orderBy(desc(otpChallenges.createdAt)).limit(1);
  if (last && now.getTime() - last.createdAt.getTime() < OTP_COOLDOWN_MS) return { ok: false, error: 'too_soon' };

  const id = randomUUID();
  const code = String(randomInt(0, 1_000_000)).padStart(6, '0');
  await deps.db.insert(otpChallenges).values({ id, mobile, codeHash: codeHash(deps.pepper, id, code), createdAt: now, expiresAt: new Date(now.getTime() + OTP_TTL_MS) });
  await deps.sender.send(mobile, `1dentity sign-in code: ${code}. Valid for 10 minutes. Do not share it with anyone.`);
  await writeAudit(deps.db, { actorKind: 'anonymous', action: 'auth.citizen.code_requested', subjectKind: 'mobile', subjectId: mobileHandle(mobile, deps.pepper) }, now);
  return { ok: true, mobile };
}

export type VerifyResult = { ok: true; userId: string; token: string; isNew: boolean } | { ok: false; error: 'invalid_mobile' | 'expired' | 'too_many_attempts' | 'wrong_code' };

export async function verifyCode(deps: OtpDeps, mobileInput: string, code: string, locale = 'en'): Promise<VerifyResult> {
  const now = deps.now ?? new Date();
  const mobile = normaliseMobile(mobileInput);
  if (!mobile) return { ok: false, error: 'invalid_mobile' };
  const [challenge] = await deps.db
    .select()
    .from(otpChallenges)
    .where(and(eq(otpChallenges.mobile, mobile), isNull(otpChallenges.consumedAt)))
    .orderBy(desc(otpChallenges.createdAt))
    .limit(1);
  const handle = mobileHandle(mobile, deps.pepper);
  if (!challenge || now >= challenge.expiresAt) return { ok: false, error: 'expired' };
  if (challenge.attempts >= OTP_MAX_ATTEMPTS) return { ok: false, error: 'too_many_attempts' };
  if (!/^\d{6}$/.test(code.trim()) || !constantTimeEqual(codeHash(deps.pepper, challenge.id, code.trim()), challenge.codeHash)) {
    await deps.db.update(otpChallenges).set({ attempts: challenge.attempts + 1 }).where(eq(otpChallenges.id, challenge.id));
    await writeAudit(deps.db, { actorKind: 'anonymous', action: 'auth.citizen.code_failed', subjectKind: 'mobile', subjectId: handle }, now);
    return { ok: false, error: challenge.attempts + 1 >= OTP_MAX_ATTEMPTS ? 'too_many_attempts' : 'wrong_code' };
  }
  await deps.db.update(otpChallenges).set({ consumedAt: now }).where(eq(otpChallenges.id, challenge.id));
  let [user] = await deps.db.select().from(users).where(eq(users.mobile, mobile)).limit(1);
  const isNew = !user;
  if (!user) [user] = await deps.db.insert(users).values({ mobile, locale, createdAt: now }).returning();
  await deps.db.update(users).set({ lastSeenAt: now }).where(eq(users.id, user!.id));
  const token = await createSession(deps.db, { kind: 'citizen', userId: user!.id }, now);
  await writeAudit(deps.db, { actorKind: 'citizen', actorId: user!.id, action: isNew ? 'auth.citizen.account_created' : 'auth.citizen.signed_in' }, now);
  return { ok: true, userId: user!.id, token, isNew };
}

/** Removes code records older than a day (F05 data table). */
export async function pruneOtpChallenges(db: Db, now: Date = new Date()) {
  const { lt } = await import('drizzle-orm');
  await db.delete(otpChallenges).where(lt(otpChallenges.createdAt, new Date(now.getTime() - 24 * 3_600_000)));
}
