/** F01-FR-11 / F02-FR-15 · The knowledge base lives in the database as versioned items. */
import { validateKnowledgeBase, type KnowledgeBase } from '@identity/content';
import { count } from 'drizzle-orm';
import type { Db } from './client';
import { sha256Hex } from './crypto';
import { kbItems } from './schema';

export type KbItemKind = 'jurisdiction' | 'authority' | 'source' | 'catalogue' | 'rule' | 'place_variants' | 'address_abbreviations' | 'service_price';
type Status = 'draft' | 'in_review' | 'published' | 'withdrawn';

interface Item {
  kind: KbItemKind;
  key: string;
  status: Status;
  data: unknown;
}

const metaStatus = (x: { meta: { status: Status } }) => x.meta.status;

/** Splits a knowledge base into items; items without metadata are structural and published. */
export function kbToItems(kb: KnowledgeBase): Item[] {
  return [
    ...kb.jurisdictions.map((j) => ({ kind: 'jurisdiction' as const, key: j.code, status: 'published' as const, data: j })),
    ...kb.authorities.map((a) => ({ kind: 'authority' as const, key: a.id, status: metaStatus(a), data: a })),
    ...kb.sources.map((s) => ({ kind: 'source' as const, key: s.id, status: metaStatus(s), data: s })),
    ...kb.catalogue.map((c) => ({ kind: 'catalogue' as const, key: c.kind, status: 'published' as const, data: c })),
    ...kb.rules.map((r) => ({ kind: 'rule' as const, key: r.id, status: metaStatus(r), data: r })),
    { kind: 'place_variants', key: 'default', status: metaStatus(kb.placeVariants), data: kb.placeVariants },
    { kind: 'address_abbreviations', key: 'default', status: metaStatus(kb.addressAbbreviations), data: kb.addressAbbreviations },
    ...kb.servicePrices.map((p) => ({ kind: 'service_price' as const, key: p.id, status: metaStatus(p), data: p })),
  ];
}

/** Seeds an empty database (version 1 of every item). Returns false if items already exist. */
export async function seedKnowledgeBaseIfEmpty(db: Db, kb: KnowledgeBase): Promise<boolean> {
  const [{ n }] = (await db.select({ n: count() }).from(kbItems)) as [{ n: number }];
  if (n > 0) return false;
  const items = kbToItems(kb);
  await db.insert(kbItems).values(items.map((i) => ({ ...i, version: 1, data: i.data as object, note: `Seed ${kb.version}` })));
  return true;
}

export type KbRow = typeof kbItems.$inferSelect;
type Row = KbRow;

/** F01-FR-11 · latest published, else latest in review; a withdrawn latest version removes the item; drafts never count. */
export function effectiveVersion(versions: Row[]): Row | null {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  if (sorted[0]?.status === 'withdrawn') return null;
  return sorted.find((v) => v.status === 'published') ?? sorted.find((v) => v.status === 'in_review') ?? null;
}

export const itemId = (r: Pick<Row, 'kind' | 'key'>) => `${r.kind}\u0000${r.key}`;

/** The effective row of every item, in a stable order. */
export function effectiveRows(rows: Row[]): Row[] {
  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(itemId(r), [...(groups.get(itemId(r)) ?? []), r]);
  return [...groups.values()]
    .map(effectiveVersion)
    .filter((r): r is Row => r !== null)
    .sort((a, b) => `${a.kind}${a.key}`.localeCompare(`${b.kind}${b.key}`));
}

/**
 * Builds the (unvalidated) knowledge base from effective rows. The row's status replaces `meta.status`, and a
 * recorded verification replaces `meta.lastVerified` (M13-FR-06).
 */
export function assembleKnowledgeBase(effective: Pick<Row, 'kind' | 'key' | 'version' | 'status' | 'data' | 'verifiedOn'>[]): { candidate: unknown; version: string } {
  const overlay = (r: (typeof effective)[number]) => {
    const d = r.data as { meta?: { status: Status; lastVerified?: string | null } };
    if (!d.meta) return d;
    return { ...d, meta: { ...d.meta, status: r.status, ...(r.verifiedOn ? { lastVerified: r.verifiedOn } : {}) } };
  };
  const of = (kind: KbItemKind) => effective.filter((r) => r.kind === kind).map(overlay);
  const version = `kb-${sha256Hex(effective.map((r) => `${r.kind}/${r.key}@${r.version}${r.verifiedOn ? `~${r.verifiedOn}` : ''}`).join('|')).slice(0, 12)}`;
  return {
    version,
    candidate: {
      version,
      jurisdictions: of('jurisdiction'),
      authorities: of('authority'),
      sources: of('source'),
      catalogue: of('catalogue'),
      rules: of('rule'),
      placeVariants: of('place_variants')[0],
      addressAbbreviations: of('address_abbreviations')[0],
      servicePrices: of('service_price'),
    },
  };
}

export interface LoadedKnowledgeBase {
  kb: KnowledgeBase;
  version: string;
}

export async function loadKnowledgeBase(db: Db): Promise<LoadedKnowledgeBase> {
  const { candidate, version } = assembleKnowledgeBase(effectiveRows(await db.select().from(kbItems)));
  const result = validateKnowledgeBase(candidate);
  if (!result.ok) throw new Error(`The knowledge base in the database is invalid:\n${result.errors.join('\n')}`);
  return { kb: result.kb, version };
}
