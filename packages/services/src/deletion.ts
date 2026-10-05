/** F06 US3 · Withdraw and delete — deletion really deletes: files first, then rows (F06-FR-03); audit keeps counts only. */
import { tables, writeAudit } from '@identity/db';
import { and, eq, inArray, ne } from 'drizzle-orm';
import { markWithdrawn } from './consents';
import { findProfile } from './profile';
import { nowOf, type Services } from './services';

const { citizenProfiles, devOutbox, documents, ocrExtractions, otpChallenges, uploads, users } = tables;

async function deleteFilesOf(s: Services, profileId: string): Promise<number> {
  const files = await s.db
    .select({ storageKey: uploads.storageKey, purgedAt: uploads.purgedAt })
    .from(uploads)
    .innerJoin(documents, eq(uploads.documentId, documents.id))
    .where(eq(documents.profileId, profileId));
  for (const f of files) if (!f.purgedAt) await s.store.delete(f.storageKey);
  return files.length;
}

const countDocuments = async (s: Services, profileId: string) => (await s.db.select({ id: documents.id }).from(documents).where(eq(documents.profileId, profileId))).length;

/** F06-AC-3.1 · Withdraw the Full Check: profile, targets, overrides, documents, files and reports go. */
export async function withdrawFullCheck(s: Services, userId: string): Promise<{ documents: number; uploads: number }> {
  const now = nowOf(s);
  const profile = await findProfile(s.db, userId);
  let counts = { documents: 0, uploads: 0 };
  if (profile) {
    counts = { documents: await countDocuments(s, profile.id), uploads: await deleteFilesOf(s, profile.id) };
    await s.db.delete(citizenProfiles).where(eq(citizenProfiles.id, profile.id));
  }
  await markWithdrawn(s.db, userId, ['full_check', 'uploads'], now);
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'consent.withdrawn', details: { purposes: ['full_check', 'uploads'], ...counts } }, now);
  return counts;
}

/** F06-AC-3.2 · Withdraw uploads: every file and OCR text goes; typed and confirmed values stay. */
export async function withdrawUploads(s: Services, userId: string): Promise<{ documents: number; uploads: number }> {
  const now = nowOf(s);
  const profile = await findProfile(s.db, userId);
  let counts = { documents: 0, uploads: 0 };
  if (profile) {
    const docIds = (await s.db.select({ id: documents.id }).from(documents).where(eq(documents.profileId, profile.id))).map((d) => d.id);
    counts.uploads = await deleteFilesOf(s, profile.id);
    if (docIds.length) {
      await s.db.delete(ocrExtractions).where(inArray(ocrExtractions.documentId, docIds));
      await s.db.delete(uploads).where(inArray(uploads.documentId, docIds));
    }
    // Uploads the citizen never confirmed hold only what OCR read — they go too.
    const unconfirmed = await s.db
      .delete(documents)
      .where(and(eq(documents.profileId, profile.id), eq(documents.source, 'upload'), ne(documents.status, 'verified')))
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
  const profile = await findProfile(s.db, userId);
  const counts = profile ? { documents: await countDocuments(s, profile.id), uploads: await deleteFilesOf(s, profile.id) } : { documents: 0, uploads: 0 };
  await s.db.delete(otpChallenges).where(eq(otpChallenges.mobile, user.mobile));
  await s.db.delete(devOutbox).where(eq(devOutbox.recipient, user.mobile));
  // Cascades to profiles, documents, versions, fields, extractions, uploads, targets, overrides, runs, consents, sessions.
  await s.db.delete(users).where(eq(users.id, userId));
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'account.closed', details: counts }, now);
  return counts;
}
