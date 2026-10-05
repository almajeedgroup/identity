/**
 * M15-AC-5.2 · Customers as staff may see them before a citizen asks for help: a reference, a masked number,
 * dates and counts — never names, document values or files (C-06). Every view is audited.
 */
import { normaliseMobile, tables, writeAudit } from '@identity/db';
import { and, desc, eq, inArray, isNull } from 'drizzle-orm';
import { nowOf, ServiceError, type Services, type StaffActor } from '../services';
import { requirePermission } from './guard';

const { analysisRuns, citizenProfiles, consents, documents, users } = tables;

export interface CustomerRow {
  id: string;
  /** Short reference to quote at the help desk. */
  ref: string;
  mobileMasked: string;
  createdAt: Date;
  lastSeenAt: Date | null;
  fullCheck: boolean;
  uploads: boolean;
  documents: number;
  issues: number | null;
}

export interface CustomerDetail extends CustomerRow {
  documentKinds: { kind: string; status: string }[];
}

export const maskMobile = (mobile: string) => `+91 ••••••${mobile.slice(-4)}`;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

async function rowsFor(s: Services, list: (typeof users.$inferSelect)[]): Promise<CustomerRow[]> {
  if (list.length === 0) return [];
  const ids = list.map((u) => u.id);
  const [active, profiles] = await Promise.all([
    s.db.select({ userId: consents.userId, purpose: consents.purpose }).from(consents).where(and(inArray(consents.userId, ids), isNull(consents.withdrawnAt))),
    s.db.select({ id: citizenProfiles.id, userId: citizenProfiles.userId }).from(citizenProfiles).where(inArray(citizenProfiles.userId, ids)),
  ]);
  const profileIds = profiles.map((p) => p.id);
  const [docs, runs] = profileIds.length
    ? await Promise.all([
        s.db.select({ profileId: documents.profileId }).from(documents).where(inArray(documents.profileId, profileIds)),
        s.db.select({ profileId: analysisRuns.profileId, issueCount: analysisRuns.issueCount }).from(analysisRuns).where(inArray(analysisRuns.profileId, profileIds)).orderBy(desc(analysisRuns.createdAt)),
      ])
    : [[], []];
  return list.map((u) => {
    const profile = profiles.find((p) => p.userId === u.id);
    const latest = profile ? runs.find((r) => r.profileId === profile.id) : undefined;
    return {
      id: u.id,
      ref: u.id.slice(0, 8).toUpperCase(),
      mobileMasked: maskMobile(u.mobile),
      createdAt: u.createdAt,
      lastSeenAt: u.lastSeenAt,
      fullCheck: active.some((c) => c.userId === u.id && c.purpose === 'full_check'),
      uploads: active.some((c) => c.userId === u.id && c.purpose === 'uploads'),
      documents: profile ? docs.filter((d) => d.profileId === profile.id).length : 0,
      issues: latest ? latest.issueCount : null,
    };
  });
}

/** The newest 50 customers, or the one whose full mobile number was typed at the desk. */
export async function listCustomers(s: Services, actor: StaffActor, input: { mobile?: string } = {}): Promise<CustomerRow[]> {
  await requirePermission(s, actor, 'customers.read');
  const searched = !!input.mobile?.trim();
  let list: (typeof users.$inferSelect)[];
  if (searched) {
    const mobile = normaliseMobile(input.mobile!);
    if (!mobile) throw new ServiceError('invalid_mobile');
    list = await s.db.select().from(users).where(eq(users.mobile, mobile)).limit(1);
  } else {
    list = await s.db.select().from(users).orderBy(desc(users.createdAt)).limit(50);
  }
  await writeAudit(s.db, { actorKind: 'staff', actorId: actor.id, action: 'customers.listed', details: { searched, count: list.length } }, nowOf(s));
  return rowsFor(s, list);
}

export async function getCustomer(s: Services, actor: StaffActor, userId: string): Promise<CustomerDetail | null> {
  await requirePermission(s, actor, 'customers.read', { kind: 'user', id: userId });
  if (!UUID.test(userId)) return null;
  const [user] = await s.db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;
  const [row] = await rowsFor(s, [user]);
  const [profile] = await s.db.select({ id: citizenProfiles.id }).from(citizenProfiles).where(eq(citizenProfiles.userId, userId)).limit(1);
  const kinds = profile ? await s.db.select({ kind: documents.kind, status: documents.status }).from(documents).where(eq(documents.profileId, profile.id)) : [];
  await writeAudit(s.db, { actorKind: 'staff', actorId: actor.id, action: 'customer.viewed', subjectKind: 'user', subjectId: userId }, nowOf(s));
  return { ...row!, documentKinds: kinds };
}
