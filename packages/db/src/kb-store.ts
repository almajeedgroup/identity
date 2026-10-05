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

type Row = typeof kbItems.$inferSelect;

/** F01-FR-11 · latest published, else latest in review; a withdrawn latest version removes the item; drafts never count. */
export function effectiveVersion(versions: Row[]): Row | null {
  const sorted = [...versions].sort((a, b) => b.version - a.version);
  if (sorted[0]?.status === 'withdrawn') return null;
  return sorted.find((v) => v.status === 'published') ?? sorted.find((v) => v.status === 'in_review') ?? null;
}

export interface LoadedKnowledgeBase {
  kb: KnowledgeBase;
  version: string;
}

export async function loadKnowledgeBase(db: Db): Promise<LoadedKnowledgeBase> {
  const rows = await db.select().from(kbItems);
  const groups = new Map<string, Row[]>();
  for (const r of rows) groups.set(`${r.kind}\u0000${r.key}`, [...(groups.get(`${r.kind}\u0000${r.key}`) ?? []), r]);
  const effective = [...groups.values()].map(effectiveVersion).filter((r): r is Row => r !== null).sort((a, b) => `${a.kind}${a.key}`.localeCompare(`${b.kind}${b.key}`));
  const withStatus = (r: Row) => {
    const d = r.data as { meta?: { status: Status } };
    return d.meta ? { ...d, meta: { ...d.meta, status: r.status } } : d;
  };
  const of = (kind: KbItemKind) => effective.filter((r) => r.kind === kind).map(withStatus);
  const single = (kind: KbItemKind) => of(kind)[0];
  const version = `kb-${sha256Hex(effective.map((r) => `${r.kind}/${r.key}@${r.version}`).join('|')).slice(0, 12)}`;
  const candidate = {
    version,
    jurisdictions: of('jurisdiction'),
    authorities: of('authority'),
    sources: of('source'),
    catalogue: of('catalogue'),
    rules: of('rule'),
    placeVariants: single('place_variants'),
    addressAbbreviations: single('address_abbreviations'),
    servicePrices: of('service_price'),
  };
  const result = validateKnowledgeBase(candidate);
  if (!result.ok) throw new Error(`The knowledge base in the database is invalid:\n${result.errors.join('\n')}`);
  return { kb: result.kb, version };
}
