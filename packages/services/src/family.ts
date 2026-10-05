/** M07 · Family members under one account: each has their own profile, documents, Full Check and cases. */
import type { ComparedField, DocumentKind } from '@identity/content';
import { tables, writeAudit } from '@identity/db';
import { compareValues, STATUS_RANK, type DocumentInput, type EngineContext } from '@identity/engine';
import { eq } from 'drizzle-orm';
import { requireConsent } from './consents';
import { deleteProfiles } from './deletion';
import { listProfiles, loadTargets, requireProfile, type Profile } from './profile';
import { buildAnalyseInput } from './report';
import { nowOf, ServiceError, type Services } from './services';
import { cleanText } from './values';

const { citizenProfiles, documents } = tables;

export const MAX_FAMILY = 8;
export const RELATIONSHIPS = ['father', 'mother', 'spouse', 'child', 'other'] as const;
export type Relationship = (typeof RELATIONSHIPS)[number];
export const PARENT_ROLES = ['father', 'mother', 'guardian'] as const;
export type ParentRole = (typeof PARENT_ROLES)[number];

export interface FamilyMemberInput {
  name: string;
  relationship: string;
  /** For a child: the holder's role. */
  parentRole?: string;
  /** The holder ticked the declaration (M07-AC-1.1). */
  declared: boolean;
}

export interface FamilyMember {
  id: string;
  name: string;
  relationship: string;
  parentRole: string | null;
  consentBasis: string | null;
  declaredAt: Date | null;
  documents: number;
}

/** M07-AC-1.1 */
export async function addFamilyMember(s: Services, userId: string, input: FamilyMemberInput): Promise<string> {
  await requireConsent(s.db, userId, 'full_check');
  const holder = await requireProfile(s.db, userId);
  const name = cleanText(input.name, 120);
  if (!name) throw new ServiceError('invalid_value');
  if (!(RELATIONSHIPS as readonly string[]).includes(input.relationship)) throw new ServiceError('invalid_value');
  const child = input.relationship === 'child';
  if (child && !(PARENT_ROLES as readonly string[]).includes(input.parentRole ?? '')) throw new ServiceError('invalid_value');
  if (!input.declared) throw new ServiceError('declaration_required');
  const members = (await listProfiles(s.db, userId)).filter((p) => p.relationship !== 'self');
  if (members.length >= MAX_FAMILY) throw new ServiceError('family_full');
  const now = nowOf(s);
  const [row] = await s.db
    .insert(citizenProfiles)
    .values({
      userId,
      relationship: input.relationship,
      parentRole: child ? input.parentRole! : null,
      consentBasis: child ? 'guardian' : 'their_permission',
      declaredAt: now,
      displayName: name,
      jurisdiction: holder.jurisdiction,
      locale: holder.locale,
      createdAt: now,
      updatedAt: now,
    })
    .returning();
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'family.member_added', subjectKind: 'profile', subjectId: row!.id, details: { relationship: input.relationship, consentBasis: row!.consentBasis } }, now);
  return row!.id;
}

/** M07-FR-04 · Rename a member; the relationship and declaration stay as recorded. */
export async function renameFamilyMember(s: Services, userId: string, profileId: string, name: string): Promise<void> {
  const member = await memberOf(s, userId, profileId);
  const clean = cleanText(name, 120);
  if (!clean) throw new ServiceError('invalid_value');
  const now = nowOf(s);
  await s.db.update(citizenProfiles).set({ displayName: clean, updatedAt: now }).where(eq(citizenProfiles.id, member.id));
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'family.member_updated', subjectKind: 'profile', subjectId: member.id, details: { fields: ['displayName'] } }, now);
}

async function memberOf(s: Services, userId: string, profileId: string): Promise<Profile> {
  const member = await requireProfile(s.db, userId, profileId);
  if (member.relationship === 'self') throw new ServiceError('not_found');
  return member;
}

export async function listFamily(s: Services, userId: string): Promise<FamilyMember[]> {
  const members = (await listProfiles(s.db, userId)).filter((p) => p.relationship !== 'self');
  const out: FamilyMember[] = [];
  for (const m of members) {
    const docs = await s.db.select({ id: documents.id }).from(documents).where(eq(documents.profileId, m.id));
    out.push({ id: m.id, name: m.displayName ?? '', relationship: m.relationship, parentRole: m.parentRole, consentBasis: m.consentBasis, declaredAt: m.declaredAt, documents: docs.length });
  }
  return out;
}

/** M07-AC-3.1 · Files first, then the profile with its documents, targets, reports and cases. */
export async function removeFamilyMember(s: Services, userId: string, profileId: string): Promise<{ documents: number; uploads: number }> {
  const member = await memberOf(s, userId, profileId);
  const now = nowOf(s);
  const counts = await deleteProfiles(s, [member.id]);
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'family.member_removed', subjectKind: 'profile', subjectId: member.id, details: { relationship: member.relationship, ...counts } }, now);
  return counts;
}

// ---------------------------------------------------------------- relationship names (M07 US2)

const RELATIVE_FIELD: Record<string, ComparedField | undefined> = { father: 'father_name', mother: 'mother_name', husband: 'spouse_name', wife: 'spouse_name' };

export interface RelationshipNote {
  /** Whose documents print the name: `self` (the holder) or `member`. */
  on: 'self' | 'member';
  document: string;
  kind: DocumentKind;
  field: ComparedField;
  printed: string;
  expected: string;
  status: string;
}

/**
 * M07-EX-relationship · pure: documents printing `field` whose value differs from `expected` by more than formatting
 * or a likely equivalent. Information only — never a finding about the relationship (M07-FR-03).
 */
export function relationshipDifferences(docs: DocumentInput[], field: ComparedField, expected: string, ctx: EngineContext): { document: string; kind: DocumentKind; printed: string; status: string }[] {
  const out: { document: string; kind: DocumentKind; printed: string; status: string }[] = [];
  for (const d of docs) {
    const fields = d.fields as Record<string, unknown>;
    let printed = fields[field];
    if (typeof printed !== 'string' && typeof fields.relative_type === 'string' && RELATIVE_FIELD[fields.relative_type] === field) printed = fields.relative_name;
    if (typeof printed !== 'string' || !printed.trim()) continue;
    const { status } = compareValues(field, printed, expected, ctx);
    if (STATUS_RANK[status] >= STATUS_RANK.potential_discrepancy) out.push({ document: d.id, kind: d.kind, printed, status });
  }
  return out;
}

/** Which name field links the two people, seen from each side. */
function links(member: Profile): { onMember?: ComparedField; onHolder?: ComparedField } {
  switch (member.relationship) {
    case 'child':
      return { onMember: member.parentRole === 'father' ? 'father_name' : member.parentRole === 'mother' ? 'mother_name' : undefined };
    case 'father':
      return { onHolder: 'father_name' };
    case 'mother':
      return { onHolder: 'mother_name' };
    case 'spouse':
      return { onMember: 'spouse_name', onHolder: 'spouse_name' };
    default:
      return {};
  }
}

/** M07-AC-2.1 · Compare each side's printed relative name with the other person's confirmed name. */
export async function relationshipNotes(s: Services, userId: string, profileId: string): Promise<RelationshipNote[]> {
  const member = await memberOf(s, userId, profileId);
  const holder = await requireProfile(s.db, userId);
  const { ctx } = await s.knowledge();
  const { onMember, onHolder } = links(member);
  const out: RelationshipNote[] = [];
  const side = async (on: 'self' | 'member', docsOf: Profile, nameOf: Profile, field: ComparedField) => {
    const target = (await loadTargets(s.db, nameOf.id)).name;
    if (!target || typeof target.value !== 'string') return;
    const { input } = await buildAnalyseInput(s.db, docsOf);
    for (const d of relationshipDifferences(input.documents, field, target.value, ctx)) out.push({ on, field, expected: target.value, ...d });
  };
  if (onMember) await side('member', member, holder, onMember);
  if (onHolder) await side('self', holder, member, onHolder);
  return out;
}
