/** M02 Part B + M18 over stored data: the Full Check report, its roadmap, and snapshots of what it said (F01-FR-12). */
import type { ComparedField, DocumentKind } from '@identity/content';
import { canonicalJson, sha256Hex, tables, type Db } from '@identity/db';
import { analyse, buildRoadmap, hasAddress, type AddressValue, type Analysis, type AnalyseInput, type DocumentFields, type DocumentInput, type Roadmap } from '@identity/engine';
import { desc, eq, inArray } from 'drizzle-orm';
import { requireConsent } from './consents';
import { loadOverrides, loadTargets, requireProfile, type Profile, type StoredOverride } from './profile';
import { nowOf, type Services } from './services';

const { analysisRuns, documentFields, documents } = tables;

/** C-17 · Only verified documents and their confirmed values are compared. */
export async function buildAnalyseInput(db: Db, profile: Profile): Promise<{ input: AnalyseInput; overrides: StoredOverride[]; pending: number }> {
  const docs = await db.select().from(documents).where(eq(documents.profileId, profile.id));
  const verified = docs.filter((d) => d.status === 'verified');
  const rows = verified.length
    ? await db
        .select()
        .from(documentFields)
        .where(inArray(documentFields.documentId, verified.map((d) => d.id)))
    : [];
  const inputs: DocumentInput[] = verified.map((doc) => {
    const fields: Record<string, unknown> = {};
    for (const r of rows) if (r.documentId === doc.id && r.version === doc.currentVersion && r.confirmed !== null) fields[r.field] = r.confirmed;
    return { id: doc.id, kind: doc.kind as DocumentKind, fields: fields as DocumentFields };
  });
  const overrides = await loadOverrides(db, profile.id);
  const address = profile.currentAddress as AddressValue | null;
  return {
    input: {
      documents: inputs,
      targets: await loadTargets(db, profile.id),
      overrides,
      ...(address && hasAddress(address) ? { profileAddress: address } : {}),
    },
    overrides,
    pending: docs.length - verified.length,
  };
}

interface IssueSnapshot {
  document: string;
  kind: DocumentKind;
  field: ComparedField;
  status: string;
  display: string;
  targetDisplay: string;
}

interface RunResult {
  signature: string;
  documents: string[];
  issues: IssueSnapshot[];
}

export interface CheckResult {
  analysis: Analysis;
  roadmap: Roadmap;
  overrides: StoredOverride[];
  kbVersion: string;
  /** Uploaded documents still waiting for the citizen to confirm them. */
  pending: number;
  /** M16-AC-5.1 · issues in the previous check that are gone now (documents still present). */
  resolved: IssueSnapshot[];
  checkedAt: Date;
}

/**
 * Runs the engine on the citizen's confirmed data. A snapshot is stored whenever the outcome changes, so the report can
 * say which issues were resolved since the previous check.
 */
export async function runFullCheck(s: Services, userId: string, profileId?: string | null): Promise<CheckResult> {
  await requireConsent(s.db, userId, 'full_check');
  const profile = await requireProfile(s.db, userId, profileId);
  const knowledge = await s.knowledge();
  const now = nowOf(s);
  const { input, overrides, pending } = await buildAnalyseInput(s.db, profile);
  const analysis = analyse(input, knowledge.ctx);
  const roadmap = buildRoadmap(analysis, knowledge.ctx, { jurisdiction: profile.jurisdiction, asOf: now.toISOString().slice(0, 10) });

  const issues: IssueSnapshot[] = analysis.issues.map((i) => ({ document: i.document, kind: i.kind, field: i.field, status: i.status, display: i.display, targetDisplay: i.targetDisplay }));
  const documentIds = analysis.documents.map((d) => d.id).sort();
  const signature = sha256Hex(canonicalJson({ kb: knowledge.version, documents: documentIds, issues }));
  let runs = (await s.db.select().from(analysisRuns).where(eq(analysisRuns.profileId, profile.id)).orderBy(desc(analysisRuns.createdAt)).limit(2)).map((r) => r.result as RunResult);
  if (runs[0]?.signature !== signature) {
    const result: RunResult = { signature, documents: documentIds, issues };
    await s.db.insert(analysisRuns).values({ profileId: profile.id, kbVersion: knowledge.version, issueCount: analysis.issueCount, result, createdAt: now });
    runs = [result, ...runs.slice(0, 1)];
  }
  const previous = runs[1];
  const present = new Set(documentIds);
  const resolved = (previous?.issues ?? []).filter((p) => present.has(p.document) && !issues.some((i) => i.document === p.document && i.field === p.field));
  return { analysis, roadmap, overrides, kbVersion: knowledge.version, pending, resolved, checkedAt: now };
}
