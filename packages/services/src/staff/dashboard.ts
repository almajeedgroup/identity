/** M15-AC-5.1 · The console home: counts only, no personal data. */
import { tables } from '@identity/db';
import { count, desc, isNull, ne } from 'drizzle-orm';
import { nowOf, type Services, type StaffActor } from '../services';
import { requirePermission } from './guard';
import { summarise } from './kb-admin';

const { analysisRuns, citizenProfiles, documents, kbItems, uploads, users } = tables;

export interface Dashboard {
  customers: number;
  fullCheckProfiles: number;
  documents: number;
  awaitingConfirmation: number;
  uploadsStored: number;
  /** Sum of the issue counts in each profile's latest report. */
  openIssues: number;
  kb: { items: number; published: number; inReview: number; drafts: number; unverified: number; stale: number; rechecking: number };
}

export async function dashboard(s: Services, actor: StaffActor): Promise<Dashboard> {
  await requirePermission(s, actor, 'dashboard.read');
  const n = async (q: Promise<{ n: number }[]>) => Number((await q)[0]?.n ?? 0);
  const [customers, fullCheckProfiles, docs, awaiting, stored] = await Promise.all([
    n(s.db.select({ n: count() }).from(users)),
    n(s.db.select({ n: count() }).from(citizenProfiles)),
    n(s.db.select({ n: count() }).from(documents)),
    n(s.db.select({ n: count() }).from(documents).where(ne(documents.status, 'verified'))),
    n(s.db.select({ n: count() }).from(uploads).where(isNull(uploads.purgedAt))),
  ]);
  const runs = await s.db.select({ profileId: analysisRuns.profileId, issueCount: analysisRuns.issueCount }).from(analysisRuns).orderBy(desc(analysisRuns.createdAt));
  const latest = new Map<string, number>();
  for (const r of runs) if (!latest.has(r.profileId)) latest.set(r.profileId, r.issueCount);
  const items = summarise(await s.db.select().from(kbItems), nowOf(s).toISOString().slice(0, 10));
  return {
    customers,
    fullCheckProfiles,
    documents: docs,
    awaitingConfirmation: awaiting,
    uploadsStored: stored,
    openIssues: [...latest.values()].reduce((a, b) => a + b, 0),
    kb: {
      items: items.length,
      published: items.filter((i) => i.effective?.status === 'published').length,
      inReview: items.filter((i) => i.effective?.status === 'in_review').length,
      drafts: items.reduce((a, i) => a + i.drafts, 0),
      unverified: items.filter((i) => i.freshness === 'unverified').length,
      stale: items.filter((i) => i.freshness === 'stale').length,
      rechecking: items.filter((i) => i.freshness === 'rechecking').length,
    },
  };
}
