/** F06 · Consent per purpose, recorded with the notice version, language and time. */
import { tables, writeAudit, type Db } from '@identity/db';
import { and, eq, isNull } from 'drizzle-orm';
import { ensureProfile } from './profile';
import { nowOf, ServiceError, type Services } from './services';

const { consents } = tables;

/** F06-FR-01 */
export const NOTICE_VERSION = '2026-10-v2';
export const PURPOSES = ['full_check', 'uploads', 'assistance'] as const;
export type Purpose = (typeof PURPOSES)[number];

export async function activeConsents(db: Db, userId: string): Promise<Set<Purpose>> {
  const rows = await db
    .select({ purpose: consents.purpose })
    .from(consents)
    .where(and(eq(consents.userId, userId), isNull(consents.withdrawnAt)));
  return new Set(rows.map((r) => r.purpose).filter((p): p is Purpose => (PURPOSES as readonly string[]).includes(p)));
}

/** F06-FR-02 · checked on the server before every write for the purpose. */
export async function requireConsent(db: Db, userId: string, purpose: Purpose): Promise<void> {
  if (!(await activeConsents(db, userId)).has(purpose))
    throw new ServiceError(purpose === 'uploads' ? 'uploads_consent_required' : purpose === 'assistance' ? 'assistance_consent_required' : 'consent_required');
}

/** F06-AC-1.1 / 1.2 */
export async function grantConsent(s: Services, userId: string, purpose: Purpose, locale: string): Promise<void> {
  const now = nowOf(s);
  const active = await activeConsents(s.db, userId);
  if (purpose !== 'full_check' && !active.has('full_check')) throw new ServiceError('consent_required');
  if (!active.has(purpose)) {
    await s.db.insert(consents).values({ userId, purpose, noticeVersion: NOTICE_VERSION, locale, grantedAt: now });
    await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'consent.granted', details: { purpose, noticeVersion: NOTICE_VERSION, locale } }, now);
  }
  if (purpose === 'full_check') await ensureProfile(s.db, userId, locale, now);
}

/** Marks consents withdrawn; the caller deletes the data first (deletion.ts). */
export async function markWithdrawn(db: Db, userId: string, purposes: readonly Purpose[], now: Date): Promise<void> {
  for (const purpose of purposes) {
    await db
      .update(consents)
      .set({ withdrawnAt: now })
      .where(and(eq(consents.userId, userId), eq(consents.purpose, purpose), isNull(consents.withdrawnAt)));
  }
}

/** F06 · The active consent records, for the settings page. */
export async function consentRecords(db: Db, userId: string) {
  return db
    .select()
    .from(consents)
    .where(and(eq(consents.userId, userId), isNull(consents.withdrawnAt)));
}
