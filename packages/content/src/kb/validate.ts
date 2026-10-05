/** F02-AC-6.1 … 9.2 · Knowledge-base validation: schema plus cross-references. */
import { KnowledgeBase } from './schema';

export type KbValidation = { ok: true; kb: KnowledgeBase } | { ok: false; errors: string[] };

export function validateKnowledgeBase(input: unknown): KbValidation {
  const parsed = KnowledgeBase.safeParse(input);
  if (!parsed.success) {
    return { ok: false, errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) };
  }
  const kb = parsed.data;
  const errors: string[] = [];
  const unique = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const x of ids) {
      if (seen.has(x)) errors.push(`${what} "${x}" is defined more than once`);
      seen.add(x);
    }
  };
  unique(kb.jurisdictions.map((j) => j.code), 'jurisdiction');
  unique(kb.authorities.map((a) => a.id), 'authority');
  unique(kb.sources.map((s) => s.id), 'source');
  unique(kb.catalogue.map((c) => c.kind), 'catalogue document');
  unique(kb.rules.map((r) => r.id), 'rule');
  unique(kb.servicePrices.map((p) => p.id), 'service price');

  const jurisdictions = new Set(kb.jurisdictions.map((j) => j.code));
  const authorities = new Set(kb.authorities.map((a) => a.id));
  const sources = new Set(kb.sources.map((s) => s.id));
  const documents = new Set(kb.catalogue.map((c) => c.kind));
  const knownJurisdiction = (code: string, where: string) => {
    if (!jurisdictions.has(code)) errors.push(`${where}: unknown jurisdiction "${code}"`);
  };

  for (const a of kb.authorities) {
    knownJurisdiction(a.jurisdiction, `authority "${a.id}"`);
    for (const s of a.sources) if (!sources.has(s)) errors.push(`authority "${a.id}": unknown source "${s}"`);
  }
  for (const s of kb.sources) if (!authorities.has(s.authority)) errors.push(`source "${s.id}": unknown authority "${s.authority}"`);
  for (const c of kb.catalogue) {
    for (const a of c.authorities) {
      knownJurisdiction(a.jurisdiction, `catalogue "${c.kind}"`);
      if (!authorities.has(a.authority)) errors.push(`catalogue "${c.kind}": unknown authority "${a.authority}"`);
    }
  }
  for (const r of kb.rules) {
    const where = `rule "${r.id}"`;
    knownJurisdiction(r.jurisdiction, where);
    if (!authorities.has(r.authority)) errors.push(`${where}: unknown authority "${r.authority}"`);
    if (!documents.has(r.document)) errors.push(`${where}: document "${r.document}" is not in the catalogue`);
    for (const s of r.sources) if (!sources.has(s)) errors.push(`${where}: unknown source "${s}"`);
    for (const p of r.prerequisites) if (!documents.has(p.document)) errors.push(`${where}: prerequisite document "${p.document}" is not in the catalogue`);
    // F02-AC-7.2 — history in increasing order, ending at the current version.
    const versions = r.history.map((h) => h.version);
    if (versions.some((v, i) => i > 0 && v <= versions[i - 1]!)) errors.push(`${where}: history versions must increase`);
    if (versions[versions.length - 1] !== r.meta.version) errors.push(`${where}: latest history entry must match version ${r.meta.version}`);
  }

  // F02-AC-9.1 — no word in two groups; canonical listed.
  const groupOf = new Map<string, string>();
  for (const g of kb.placeVariants.groups) {
    if (!g.variants.includes(g.canonical)) errors.push(`place group "${g.canonical}" must list its canonical form`);
    for (const v of g.variants) {
      const other = groupOf.get(v);
      if (other && other !== g.canonical) errors.push(`place "${v}" is in groups "${other}" and "${g.canonical}"`);
      groupOf.set(v, g.canonical);
    }
  }
  unique(kb.addressAbbreviations.entries.map((e) => e.short), 'address abbreviation');

  return errors.length ? { ok: false, errors } : { ok: true, kb };
}
