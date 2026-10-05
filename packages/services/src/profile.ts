/** M16 · The master profile, confirmed target values and overrides. Targets never change a document value (C-16, C-17). */
import { COMPARED_FIELDS, type ComparedField } from '@identity/content';
import { canonicalJson, tables, writeAudit, type Db } from '@identity/db';
import type { AddressValue, FieldValue, Override, Target } from '@identity/engine';
import { and, asc, desc, eq, isNull } from 'drizzle-orm';
import { requireConsent } from './consents';
import { nowOf, ServiceError, type Actor, type Services } from './services';
import { cleanAddress, cleanText } from './values';

const { citizenProfiles, documents, masterValues, overrides, targetChanges } = tables;

export type Profile = typeof citizenProfiles.$inferSelect;

export async function findProfile(db: Db, userId: string): Promise<Profile | null> {
  const [row] = await db
    .select()
    .from(citizenProfiles)
    .where(and(eq(citizenProfiles.userId, userId), eq(citizenProfiles.relationship, 'self')))
    .limit(1);
  return row ?? null;
}

export async function ensureProfile(db: Db, userId: string, locale: string, now: Date = new Date()): Promise<Profile> {
  const existing = await findProfile(db, userId);
  if (existing) return existing;
  const [row] = await db.insert(citizenProfiles).values({ userId, locale, createdAt: now, updatedAt: now }).returning();
  return row!;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

/**
 * The profile of a citizen who has agreed to the Full Check (F06-FR-02): their own, or — with `profileId` — one of
 * their family members (M07-AC-1.2). A profile of anyone else is "not found".
 */
export async function requireProfile(db: Db, userId: string, profileId?: string | null): Promise<Profile> {
  const own = await findProfile(db, userId);
  if (!own) throw new ServiceError('consent_required');
  if (!profileId || profileId === own.id) return own;
  if (!UUID.test(profileId)) throw new ServiceError('not_found');
  const [member] = await db
    .select()
    .from(citizenProfiles)
    .where(and(eq(citizenProfiles.id, profileId), eq(citizenProfiles.userId, userId)))
    .limit(1);
  if (!member) throw new ServiceError('not_found');
  return member;
}

/** Every profile of the account: the holder's first, then family members in the order they were added. */
export async function listProfiles(db: Db, userId: string): Promise<Profile[]> {
  const rows = await db.select().from(citizenProfiles).where(eq(citizenProfiles.userId, userId)).orderBy(asc(citizenProfiles.createdAt));
  return [...rows.filter((r) => r.relationship === 'self'), ...rows.filter((r) => r.relationship !== 'self')];
}

export interface ProfileUpdate {
  displayName?: string;
  jurisdiction?: string;
  district?: string;
  email?: string;
  currentAddress?: AddressValue | null;
}

/** M16-FR-01 */
export async function updateProfile(s: Services, userId: string, update: ProfileUpdate, profileId?: string | null): Promise<Profile> {
  await requireConsent(s.db, userId, 'full_check');
  const profile = await requireProfile(s.db, userId, profileId);
  const now = nowOf(s);
  const { kb } = await s.knowledge();
  if (update.jurisdiction !== undefined && !kb.jurisdictions.some((j) => j.code === update.jurisdiction)) throw new ServiceError('invalid_value');
  const email = update.email !== undefined ? cleanText(update.email, 254) : undefined;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new ServiceError('invalid_value');
  const set: Partial<typeof citizenProfiles.$inferInsert> = { updatedAt: now };
  if (update.displayName !== undefined) set.displayName = cleanText(update.displayName, 120) || null;
  if (update.jurisdiction !== undefined) set.jurisdiction = update.jurisdiction;
  if (update.district !== undefined) set.district = cleanText(update.district, 80) || null;
  if (email !== undefined) set.email = email || null;
  if (update.currentAddress !== undefined) set.currentAddress = update.currentAddress ? cleanAddress(update.currentAddress) : null;
  const [row] = await s.db.update(citizenProfiles).set(set).where(eq(citizenProfiles.id, profile.id)).returning();
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'profile.updated', subjectKind: 'profile', subjectId: profile.id, details: { fields: Object.keys(update).sort() } }, now);
  return row!;
}

// ---------------------------------------------------------------- targets (M16 US3)

export async function loadTargets(db: Db, profileId: string): Promise<Partial<Record<ComparedField, Target>>> {
  const rows = await db.select().from(masterValues).where(eq(masterValues.profileId, profileId));
  const out: Partial<Record<ComparedField, Target>> = {};
  for (const r of rows) if ((COMPARED_FIELDS as readonly string[]).includes(r.field)) out[r.field as ComparedField] = { value: r.value as FieldValue, status: 'confirmed' };
  return out;
}

/**
 * M16-AC-3.3 / M16-FR-05 · Confirm or change a target. The old and new values go to the profile's target history;
 * the audit log records the field and actor only (M15-FR-03). Staff must give a reason (M16-AC-4.2).
 */
export async function confirmTarget(s: Services, actor: Actor, profileId: string, field: ComparedField, value: FieldValue, reason?: string): Promise<boolean> {
  if (!(COMPARED_FIELDS as readonly string[]).includes(field)) throw new ServiceError('invalid_field');
  const clean: FieldValue = typeof value === 'string' ? cleanText(value, 200) : cleanAddress(value);
  if (typeof clean === 'string' ? !clean : Object.keys(clean).length === 0) throw new ServiceError('invalid_value');
  const why = reason ? cleanText(reason, 500) : '';
  if (actor.kind === 'staff' && !why) throw new ServiceError('reason_required');
  const now = nowOf(s);
  const [existing] = await s.db
    .select()
    .from(masterValues)
    .where(and(eq(masterValues.profileId, profileId), eq(masterValues.field, field)))
    .limit(1);
  if (existing && canonicalJson(existing.value) === canonicalJson(clean)) return false;
  if (existing) {
    await s.db
      .update(masterValues)
      .set({ value: clean, source: 'citizen_choice', confirmedAt: now, confirmedByKind: actor.kind, confirmedById: actor.id })
      .where(eq(masterValues.id, existing.id));
  } else {
    await s.db.insert(masterValues).values({ profileId, field, value: clean, source: 'citizen_choice', confirmedAt: now, confirmedByKind: actor.kind, confirmedById: actor.id });
  }
  await s.db.insert(targetChanges).values({ profileId, field, oldValue: existing?.value ?? null, newValue: clean, actorKind: actor.kind, actorId: actor.id, reason: why || null, createdAt: now });
  await writeAudit(
    s.db,
    { actorKind: actor.kind, actorId: actor.id, action: existing ? 'target.changed' : 'target.confirmed', subjectKind: 'profile', subjectId: profileId, details: { field } },
    now,
  );
  return true;
}

export async function targetHistory(db: Db, profileId: string) {
  return db.select().from(targetChanges).where(eq(targetChanges.profileId, profileId)).orderBy(desc(targetChanges.createdAt));
}

// ---------------------------------------------------------------- overrides (M16 US4)

export type StoredOverride = Override & { id: string; createdAt: Date; actorKind: 'citizen' | 'staff' };

export async function loadOverrides(db: Db, profileId: string): Promise<StoredOverride[]> {
  const rows = await db
    .select()
    .from(overrides)
    .where(and(eq(overrides.profileId, profileId), isNull(overrides.revokedAt)));
  return rows.map((r) => ({ id: r.id, document: r.documentId, field: r.field as ComparedField, decision: r.decision, reason: r.reason, createdAt: r.createdAt, actorKind: r.actorKind }));
}

/** M16-AC-4.1 / 4.2 · An override with a reason; the previous one for the same document and field is revoked. */
export async function setOverride(
  s: Services,
  actor: Actor,
  profileId: string,
  input: { documentId: string; field: ComparedField; decision: 'accepted_equivalent' | 'requires_correction'; reason: string },
): Promise<string> {
  if (!(COMPARED_FIELDS as readonly string[]).includes(input.field)) throw new ServiceError('invalid_field');
  if (!['accepted_equivalent', 'requires_correction'].includes(input.decision)) throw new ServiceError('invalid_value');
  const reason = cleanText(input.reason, 500);
  if (!reason) throw new ServiceError('reason_required');
  const [doc] = await s.db
    .select({ id: documents.id })
    .from(documents)
    .where(and(eq(documents.id, input.documentId), eq(documents.profileId, profileId)))
    .limit(1);
  if (!doc) throw new ServiceError('not_found');
  const now = nowOf(s);
  await s.db
    .update(overrides)
    .set({ revokedAt: now })
    .where(and(eq(overrides.profileId, profileId), eq(overrides.documentId, input.documentId), eq(overrides.field, input.field), isNull(overrides.revokedAt)));
  const [row] = await s.db
    .insert(overrides)
    .values({ profileId, documentId: input.documentId, field: input.field, decision: input.decision, reason, actorKind: actor.kind, actorId: actor.id, createdAt: now })
    .returning({ id: overrides.id });
  await writeAudit(
    s.db,
    { actorKind: actor.kind, actorId: actor.id, action: 'comparison.overridden', subjectKind: 'document', subjectId: input.documentId, details: { field: input.field, decision: input.decision, overrideId: row!.id } },
    now,
  );
  return row!.id;
}

export async function revokeOverride(s: Services, actor: Actor, profileId: string, overrideId: string): Promise<void> {
  const now = nowOf(s);
  const [row] = await s.db
    .update(overrides)
    .set({ revokedAt: now })
    .where(and(eq(overrides.id, overrideId), eq(overrides.profileId, profileId), isNull(overrides.revokedAt)))
    .returning({ id: overrides.id, documentId: overrides.documentId, field: overrides.field });
  if (!row) throw new ServiceError('not_found');
  await writeAudit(s.db, { actorKind: actor.kind, actorId: actor.id, action: 'comparison.override_removed', subjectKind: 'document', subjectId: row.documentId, details: { field: row.field, overrideId } }, now);
}
