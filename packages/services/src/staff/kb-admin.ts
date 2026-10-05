/** M13 · Rules admin: versioned knowledge-base items — draft, publish (with a second person for fees and links), withdraw, verify. */
import { freshness, isIsoDate, validateKnowledgeBase, type Freshness } from '@identity/content';
import { assembleKnowledgeBase, effectiveRows, effectiveVersion, tables, writeAudit, type Db, type KbItemKind, type KbRow } from '@identity/db';
import { and, eq, inArray } from 'drizzle-orm';
import { nowOf, ServiceError, type Services, type StaffActor } from '../services';
import { requirePermission } from './guard';

const { kbItems, staffUsers } = tables;

/** M13-FR-01 */
export const KB_KINDS = ['rule', 'authority', 'source', 'catalogue', 'jurisdiction', 'service_price', 'place_variants', 'address_abbreviations'] as const satisfies readonly KbItemKind[];

export function isKbKind(value: string): value is KbItemKind {
  return (KB_KINDS as readonly string[]).includes(value);
}

type Json = Record<string, unknown>;
const isObject = (v: unknown): v is Json => v !== null && typeof v === 'object' && !Array.isArray(v);
const text = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** The key an item is stored under, taken from its own data. */
export function keyOf(kind: KbItemKind, data: unknown): string | null {
  if (!isObject(data)) return null;
  switch (kind) {
    case 'jurisdiction':
      return text(data.code);
    case 'catalogue':
      return text(data.kind);
    case 'place_variants':
    case 'address_abbreviations':
      return 'default';
    default:
      return text(data.id);
  }
}

// ---------------------------------------------------------------- differences (M13-AC-2.3, M13-FR-05)

export interface Change {
  path: string;
  before: unknown;
  after: unknown;
}

/** M13-EX-diff · Paths that differ between two JSON values, in document order. */
export function diffJson(before: unknown, after: unknown, path = ''): Change[] {
  if (Object.is(before, after)) return [];
  if (Array.isArray(before) && Array.isArray(after)) {
    const out: Change[] = [];
    for (let i = 0; i < Math.max(before.length, after.length); i++) out.push(...diffJson(before[i], after[i], `${path}[${i}]`));
    return out;
  }
  if (isObject(before) && isObject(after)) {
    const keys = [...Object.keys(before), ...Object.keys(after).filter((k) => !(k in before))];
    return keys.flatMap((k) => diffJson(before[k], after[k], path ? `${path}.${k}` : k));
  }
  return [{ path: path || '(item)', before, after }];
}

const SECOND_PERSON = new Set(['fees', 'amountInr', 'url', 'sources']);

/** M13-FR-05 / M13-EX-second-person */
export function needsSecondPerson(changes: Change[]): boolean {
  return changes.some((c) => SECOND_PERSON.has(c.path.replace(/\[\d+\]/g, '').split('.').pop() ?? ''));
}

// ---------------------------------------------------------------- validation (M13-FR-04)

type CandidateRow = Pick<KbRow, 'kind' | 'key' | 'version' | 'status' | 'data' | 'verifiedOn'>;

async function validateWith(db: Db, change: { replace: CandidateRow } | { remove: { kind: string; key: string } }): Promise<void> {
  const target = 'replace' in change ? change.replace : change.remove;
  const rows = effectiveRows(await db.select().from(kbItems)).filter((r) => !(r.kind === target.kind && r.key === target.key));
  const { candidate } = assembleKnowledgeBase('replace' in change ? [...rows, change.replace] : rows);
  const result = validateKnowledgeBase(candidate);
  if (!result.ok) throw new ServiceError('invalid_kb', result.errors.slice(0, 20));
}

async function versionsOf(db: Db, kind: string, key: string): Promise<KbRow[]> {
  return (await db.select().from(kbItems).where(and(eq(kbItems.kind, kind), eq(kbItems.key, key)))).sort((a, b) => b.version - a.version);
}

// ---------------------------------------------------------------- reading (M13 US1)

export interface KbItemSummary {
  kind: KbItemKind;
  key: string;
  label: string;
  owner: string | null;
  effective: { version: number; status: KbRow['status'] } | null;
  latest: { version: number; status: KbRow['status'] };
  drafts: number;
  lastVerified: string | null;
  /** `null` for structural items without metadata (catalogue, jurisdictions). */
  freshness: Freshness | null;
}

function labelOf(kind: KbItemKind, data: unknown): string {
  if (!isObject(data)) return '';
  const en = (v: unknown) => (isObject(v) && typeof v.en === 'string' ? v.en : '');
  switch (kind) {
    case 'authority':
    case 'jurisdiction':
      return en(data.name);
    case 'source':
      return en(data.title);
    case 'catalogue':
      return en(data.label);
    case 'service_price':
      return `${String(data.service)} · ${String(data.document ?? 'any document')} · ₹${String(data.amountInr)}`;
    case 'place_variants':
      return 'Place name variants';
    case 'address_abbreviations':
      return 'Address abbreviations';
    default:
      return text(data.id) ?? '';
  }
}

const metaOf = (row: KbRow | null) => (row && isObject(row.data) && isObject(row.data.meta) ? (row.data.meta as Json) : null);
const verifiedOf = (row: KbRow | null) => row?.verifiedOn ?? (text(metaOf(row)?.lastVerified) as string | null) ?? null;

export function summarise(rows: KbRow[], asOf: string): KbItemSummary[] {
  const groups = new Map<string, KbRow[]>();
  for (const r of rows) groups.set(`${r.kind}\u0000${r.key}`, [...(groups.get(`${r.kind}\u0000${r.key}`) ?? []), r]);
  const out: KbItemSummary[] = [];
  for (const versions of groups.values()) {
    const sorted = [...versions].sort((a, b) => b.version - a.version);
    const latest = sorted[0]!;
    const effective = effectiveVersion(sorted);
    const shown = effective ?? latest;
    const meta = metaOf(shown);
    const lastVerified = effective ? verifiedOf(effective) : null;
    out.push({
      kind: latest.kind as KbItemKind,
      key: latest.key,
      label: labelOf(latest.kind as KbItemKind, shown.data),
      owner: text(meta?.owner),
      effective: effective ? { version: effective.version, status: effective.status } : null,
      latest: { version: latest.version, status: latest.status },
      drafts: sorted.filter((r) => r.status === 'draft' && (!effective || r.version > effective.version)).length,
      lastVerified,
      freshness: meta ? freshness({ lastVerified }, asOf) : null,
    });
  }
  const rank = (k: string) => KB_KINDS.indexOf(k as never);
  return out.sort((a, b) => rank(a.kind) - rank(b.kind) || a.key.localeCompare(b.key));
}

export async function listKbItems(s: Services, actor: StaffActor): Promise<KbItemSummary[]> {
  await requirePermission(s, actor, 'rules.read');
  return summarise(await s.db.select().from(kbItems), nowOf(s).toISOString().slice(0, 10));
}

export interface KbVersionView {
  version: number;
  status: KbRow['status'];
  data: unknown;
  note: string | null;
  createdAt: Date;
  createdBy: string | null;
  createdById: string | null;
  publishedBy: string | null;
  publishedAt: Date | null;
  verifiedOn: string | null;
  verifiedBy: string | null;
  verifiedSource: string | null;
}

export interface KbItemDetail {
  kind: KbItemKind;
  key: string;
  label: string;
  effectiveVersion: number | null;
  versions: KbVersionView[];
}

export async function getKbItem(s: Services, actor: StaffActor, kind: string, key: string): Promise<KbItemDetail | null> {
  await requirePermission(s, actor, 'rules.read');
  if (!isKbKind(kind)) return null;
  const rows = await versionsOf(s.db, kind, key);
  if (rows.length === 0) return null;
  const ids = [...new Set(rows.flatMap((r) => [r.createdById, r.publishedById, r.verifiedById]).filter((x): x is string => !!x))];
  const people = ids.length ? await s.db.select({ id: staffUsers.id, name: staffUsers.name }).from(staffUsers).where(inArray(staffUsers.id, ids)) : [];
  const name = (id: string | null) => (id ? (people.find((p) => p.id === id)?.name ?? 'Former staff member') : null);
  const effective = effectiveVersion(rows);
  return {
    kind,
    key,
    label: labelOf(kind, (effective ?? rows[0]!).data),
    effectiveVersion: effective?.version ?? null,
    versions: rows.map((r) => ({
      version: r.version,
      status: r.status,
      data: r.data,
      note: r.note,
      createdAt: r.createdAt,
      createdBy: name(r.createdById) ?? (r.createdById ? null : 'Seed'),
      createdById: r.createdById,
      publishedBy: name(r.publishedById),
      publishedAt: r.publishedAt,
      verifiedOn: r.verifiedOn,
      verifiedBy: name(r.verifiedById),
      verifiedSource: r.verifiedSource,
    })),
  };
}

// ---------------------------------------------------------------- writing (M13 US2–US5)

const auditKb = (s: Services, actor: StaffActor, kind: string, action: string, key: string, details: Record<string, unknown>, now: Date) =>
  writeAudit(s.db, { actorKind: 'staff', actorId: actor.id, action: `kb.${kind}.${action}`, subjectKind: `kb.${kind}`, subjectId: key, details }, now);

/** M13-AC-2.1 / M13-FR-02 · A new draft version; nothing effective changes. */
export async function saveDraft(s: Services, actor: StaffActor, input: { kind: string; key?: string; data: unknown; note: string }): Promise<{ key: string; version: number }> {
  await requirePermission(s, actor, 'rules.edit');
  if (!isKbKind(input.kind)) throw new ServiceError('invalid_kind');
  const kind = input.kind;
  let data: unknown = input.data;
  if (typeof data === 'string') {
    try {
      data = JSON.parse(data);
    } catch (error) {
      throw new ServiceError('invalid_json', [(error as Error).message]);
    }
  }
  if (!isObject(data)) throw new ServiceError('invalid_json', ['The item must be a JSON object.']);
  const key = keyOf(kind, data);
  if (!key) throw new ServiceError('invalid_kb', ['The item needs its identifier (id, code or kind).']);
  if (input.key && input.key !== key) throw new ServiceError('key_mismatch');
  const note = input.note.replace(/\s+/g, ' ').trim().slice(0, 500) || 'Updated';
  const now = nowOf(s);
  const today = now.toISOString().slice(0, 10);
  const version = ((await versionsOf(s.db, kind, key))[0]?.version ?? 0) + 1;

  const draft: Json = structuredClone(data);
  if (isObject(draft.meta)) draft.meta = { ...draft.meta, version, status: 'draft', lastVerified: null }; // M13-AC-4.2
  if (kind === 'rule') {
    const history = Array.isArray(draft.history) ? (draft.history as Json[]).filter((h) => typeof h.version === 'number' && h.version < version) : [];
    draft.history = [...history, { version, date: today, change: note, by: actor.name }];
  }
  await validateWith(s.db, { replace: { kind, key, version, status: 'published', data: draft, verifiedOn: null } });
  await s.db.insert(kbItems).values({ kind, key, version, status: 'draft', data: draft, note, createdById: actor.id, createdAt: now });
  await auditKb(s, actor, kind, 'draft_saved', key, { version }, now);
  return { key, version };
}

/** M13-AC-2.4 · Rolling back makes a new draft from an older version. */
export async function rollbackTo(s: Services, actor: StaffActor, kind: string, key: string, version: number) {
  const old = (await versionsOf(s.db, kind, key)).find((r) => r.version === version);
  if (!old) throw new ServiceError('not_found');
  return saveDraft(s, actor, { kind, key, data: old.data, note: `Rollback to version ${version}` });
}

export async function discardDraft(s: Services, actor: StaffActor, kind: string, key: string, version: number): Promise<void> {
  await requirePermission(s, actor, 'rules.edit');
  const row = (await versionsOf(s.db, kind, key)).find((r) => r.version === version);
  if (!row) throw new ServiceError('not_found');
  if (row.status !== 'draft') throw new ServiceError('not_draft');
  await s.db.delete(kbItems).where(and(eq(kbItems.kind, kind), eq(kbItems.key, key), eq(kbItems.version, version)));
  await auditKb(s, actor, kind, 'draft_discarded', key, { version }, nowOf(s));
}

/** M13-AC-3.1 / 3.2 · Publish a draft; its author cannot publish their own change to fees or links. */
export async function publishVersion(s: Services, actor: StaffActor, kind: string, key: string, version: number): Promise<void> {
  await requirePermission(s, actor, 'rules.publish', { kind: `kb.${kind}`, id: key });
  const rows = await versionsOf(s.db, kind, key);
  const row = rows.find((r) => r.version === version);
  if (!row) throw new ServiceError('not_found');
  if (row.status !== 'draft') throw new ServiceError('not_draft');
  const changes = diffJson(effectiveVersion(rows)?.data ?? {}, row.data);
  if (row.createdById === actor.id && needsSecondPerson(changes)) throw new ServiceError('second_person_required');
  await validateWith(s.db, { replace: { ...row, status: 'published', verifiedOn: null } });
  const now = nowOf(s);
  await s.db
    .update(kbItems)
    .set({ status: 'published', publishedById: actor.id, publishedAt: now })
    .where(and(eq(kbItems.kind, kind), eq(kbItems.key, key), eq(kbItems.version, version)));
  await auditKb(s, actor, kind, 'published', key, { version, changes: changes.length }, now);
}

/** M13-AC-3.3 · Withdraw: a withdrawn version is added and the item leaves the effective knowledge base. */
export async function withdrawItem(s: Services, actor: StaffActor, kind: string, key: string, reason: string): Promise<number> {
  await requirePermission(s, actor, 'rules.publish', { kind: `kb.${kind}`, id: key });
  const why = reason.replace(/\s+/g, ' ').trim().slice(0, 500);
  if (!why) throw new ServiceError('reason_required');
  const rows = await versionsOf(s.db, kind, key);
  const effective = effectiveVersion(rows);
  if (!effective) throw new ServiceError('not_found');
  await validateWith(s.db, { remove: { kind, key } });
  const now = nowOf(s);
  const version = rows[0]!.version + 1;
  await s.db.insert(kbItems).values({ kind, key, version, status: 'withdrawn', data: effective.data as object, note: why, createdById: actor.id, createdAt: now, publishedById: actor.id, publishedAt: now });
  await auditKb(s, actor, kind, 'withdrawn', key, { version }, now);
  return version;
}

/** M13-AC-4.1 / M13-FR-06 · Record that the effective version was checked against an official source. */
export async function recordVerification(s: Services, actor: StaffActor, kind: string, key: string, input: { date: string; sourceId: string }): Promise<void> {
  await requirePermission(s, actor, 'rules.edit');
  const rows = await versionsOf(s.db, kind, key);
  const effective = effectiveVersion(rows);
  if (!effective) throw new ServiceError('not_found');
  if (!metaOf(effective)) throw new ServiceError('no_metadata');
  const now = nowOf(s);
  if (!isIsoDate(input.date) || input.date > now.toISOString().slice(0, 10)) throw new ServiceError('invalid_date');
  const { kb } = await s.knowledge();
  if (!kb.sources.some((src) => src.id === input.sourceId)) throw new ServiceError('invalid_value');
  await s.db
    .update(kbItems)
    .set({ verifiedOn: input.date, verifiedById: actor.id, verifiedSource: input.sourceId, verifiedAt: now })
    .where(and(eq(kbItems.kind, kind), eq(kbItems.key, key), eq(kbItems.version, effective.version)));
  await auditKb(s, actor, kind, 'verified', key, { version: effective.version, source: input.sourceId, date: input.date }, now);
}

/** Starting points for new items (M13-FR-01). */
export function templateFor(kind: KbItemKind): Json {
  const meta = { owner: 'Content lead', source: 'Official source to be named', version: 1, lastVerified: null, status: 'draft' };
  const text4 = (en: string) => ({ en, kn: en, hi: en, ur: en });
  switch (kind) {
    case 'service_price':
      return { id: 'assistance-standard', service: 'assistance', amountInr: 0, meta: { ...meta, owner: 'Product owner', source: 'Pricing decision' } };
    case 'source':
      return { id: 'new-source', title: text4('Official page title'), url: 'https://www.example.gov.in/', authority: 'uidai', kind: 'guidance', meta };
    case 'authority':
      return { id: 'new-authority', name: text4('Authority name'), jurisdiction: 'IN-KA', sources: [], meta };
    case 'jurisdiction':
      return { code: 'IN-KA-BLR', name: text4('Bengaluru Urban') };
    default:
      return { id: `new-${kind.replace(/_/g, '-')}`, meta };
  }
}
