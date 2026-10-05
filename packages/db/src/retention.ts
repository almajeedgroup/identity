/** M15-AC-4.1 / Q-26 · Purge uploads that are past their retention date. */
import { and, isNull, lte } from 'drizzle-orm';
import { eq } from 'drizzle-orm';
import { writeAudit } from './audit';
import type { Db } from './client';
import { uploads } from './schema';
import type { ObjectStore } from './storage';

export const UPLOAD_RETENTION_DAYS_AFTER_VERIFICATION = 30;

export async function purgeDueUploads(db: Db, store: ObjectStore, now: Date = new Date()): Promise<number> {
  const due = await db.select().from(uploads).where(and(isNull(uploads.purgedAt), lte(uploads.purgeAfter, now)));
  for (const u of due) {
    await store.delete(u.storageKey);
    await db.update(uploads).set({ purgedAt: now }).where(eq(uploads.id, u.id));
    await writeAudit(db, { actorKind: 'system', action: 'retention.upload_purged', subjectKind: 'upload', subjectId: u.id, details: { documentId: u.documentId } }, now);
  }
  return due.length;
}
