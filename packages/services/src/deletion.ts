/** F06 US3 · Withdraw and delete — deletion really deletes: files first, then rows (F06-FR-03); audit keeps counts only. */
import { tables, writeAudit } from '@identity/db';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { markWithdrawn } from './consents';
import { listProfiles } from './profile';
import { nowOf, type Services } from './services';

const { caseFiles, cases, citizenProfiles, devOutbox, documents, ocrExtractions, otpChallenges, uploads, users } = tables;

/** Case files go from the object store before their rows (F06-FR-03). */
async function deleteCaseFilesOf(s: Services, profileIds: string[]): Promise<number> {
  if (!profileIds.length) return 0;
  const files = await s.db
    .select({ storageKey: caseFiles.storageKey, purgedAt: caseFiles.purgedAt })
    .from(caseFiles)
    .innerJoin(cases, eq(caseFiles.caseId, cases.id))
    .where(inArray(cases.profileId, profileIds));
  for (const f of files) if (!f.purgedAt) await s.store.delete(f.storageKey);
  return files.length;
}

async function deleteFilesOf(s: Services, profileIds: string[]): Promise<number> {
  if (!profileIds.length) return 0;
  const files = await s.db
    .select({ storageKey: uploads.storageKey, purgedAt: uploads.purgedAt })
    .from(uploads)
    .innerJoin(documents, eq(uploads.documentId, documents.id))
    .where(inArray(documents.profileId, profileIds));
  for (const f of files) if (!f.purgedAt) await s.store.delete(f.storageKey);
  return files.length;
}

const countDocuments = async (s: Services, profileIds: string[]) =>
  profileIds.length ? (await s.db.select({ id: documents.id }).from(documents).where(inArray(documents.profileId, profileIds))).length : 0;

/**
 * Deletes profiles with everything that hangs off them — files from the object store first, then the rows (documents,
 * targets, reports and cases cascade). Used for withdrawal, closing the account and removing a family member (M07-AC-3.1).
 */
export async function deleteProfiles(s: Services, profileIds: string[]): Promise<{ documents: number; uploads: number }> {
  const counts = { documents: await countDocuments(s, profileIds), uploads: (await deleteFilesOf(s, profileIds)) + (await deleteCaseFilesOf(s, profileIds)) };
  if (profileIds.length) await s.db.delete(citizenProfiles).where(inArray(citizenProfiles.id, profileIds));
  return counts;
}

/** F06-AC-3.1 / M07-AC-3.2 · Withdraw the Full Check: every profile of the account (family members too) with targets, overrides, documents, files, reports and cases. */
export async function withdrawFullCheck(s: Services, userId: string): Promise<{ documents: number; uploads: number }> {
  const now = nowOf(s);
  const counts = await deleteProfiles(s, (await listProfiles(s.db, userId)).map((p) => p.id));
  await markWithdrawn(s.db, userId, ['full_check', 'uploads', 'assistance'], now);
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'consent.withdrawn', details: { purposes: ['full_check', 'uploads', 'assistance'], ...counts } }, now);
  return counts;
}

/** F06-AC-3.2 · Withdraw uploads: every file and OCR text goes; typed and confirmed values stay. */
export async function withdrawUploads(s: Services, userId: string): Promise<{ documents: number; uploads: number }> {
  const now = nowOf(s);
  const profileIds = (await listProfiles(s.db, userId)).map((p) => p.id);
  let counts = { documents: 0, uploads: 0 };
  if (profileIds.length) {
    const docIds = (await s.db.select({ id: documents.id }).from(documents).where(inArray(documents.profileId, profileIds))).map((d) => d.id);
    counts.uploads = await deleteFilesOf(s, profileIds);
    if (docIds.length) {
      await s.db.delete(ocrExtractions).where(inArray(ocrExtractions.documentId, docIds));
      await s.db.delete(uploads).where(inArray(uploads.documentId, docIds));
    }
    // Uploads the citizen never confirmed hold only what OCR read — they go too.
    const unconfirmed = await s.db
      .delete(documents)
      .where(and(inArray(documents.profileId, profileIds), eq(documents.source, 'upload'), ne(documents.status, 'verified')))
      .returning({ id: documents.id });
    counts.documents = unconfirmed.length;
  }
  await markWithdrawn(s.db, userId, ['uploads'], now);
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'consent.withdrawn', details: { purposes: ['uploads'], ...counts } }, now);
  return counts;
}

/** F06-AC-3.3 / F01-AC-4.3 · Close the account: everything about the citizen is deleted; sessions end with it. */
export async function closeAccount(s: Services, userId: string): Promise<{ documents: number; uploads: number }> {
  const now = nowOf(s);
  const [user] = await s.db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return { documents: 0, uploads: 0 };
  const counts = await deleteProfiles(s, (await listProfiles(s.db, userId)).map((p) => p.id));
  await s.db.delete(otpChallenges).where(eq(otpChallenges.mobile, user.mobile));
  await s.db.delete(devOutbox).where(eq(devOutbox.recipient, user.mobile));
  // Cascades to profiles, documents, versions, fields, extractions, uploads, targets, overrides, runs, consents, sessions.
  await s.db.delete(users).where(eq(users.id, userId));
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'account.closed', details: counts }, now);
  return counts;
}
