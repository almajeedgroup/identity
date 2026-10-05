/** F02-FR-10 / M18-FR-02 · Jurisdiction matching and rule selection. */
import { appliesOn } from '../rules';
import type { CatalogueDocument, CorrectionRule, DocumentKind, KnowledgeBase, PrintedField, ServicePrice } from './schema';

/** A rule for `ruleCode` applies to `citizenCode` and everything below it. */
export function jurisdictionApplies(ruleCode: string, citizenCode: string): boolean {
  return citizenCode === ruleCode || citizenCode.startsWith(`${ruleCode}-`);
}

export function specificity(code: string): number {
  return code.split('-').length;
}

export function usableRule(rule: CorrectionRule, citizenJurisdiction: string, asOf: string): boolean {
  return (rule.meta.status === 'published' || rule.meta.status === 'in_review') && appliesOn(rule.meta, asOf) && jurisdictionApplies(rule.jurisdiction, citizenJurisdiction);
}

/** Most specific usable rule for one document field; ties go to the lower priority number, then id. */
export function selectRule(kb: KnowledgeBase, document: DocumentKind, field: PrintedField, citizenJurisdiction: string, asOf: string): CorrectionRule | null {
  const candidates = kb.rules
    .filter((r) => r.document === document && r.fields.includes(field) && usableRule(r, citizenJurisdiction, asOf))
    .sort((a, b) => specificity(b.jurisdiction) - specificity(a.jurisdiction) || a.priority - b.priority || a.id.localeCompare(b.id));
  return candidates[0] ?? null;
}

export function catalogueEntry(kb: KnowledgeBase, kind: DocumentKind): CatalogueDocument {
  const entry = kb.catalogue.find((c) => c.kind === kind);
  if (!entry) throw new Error(`Document kind ${kind} is not in the catalogue`);
  return entry;
}

export function catalogueIndex(kb: KnowledgeBase, kind: DocumentKind): number {
  return kb.catalogue.findIndex((c) => c.kind === kind);
}

/** The authority responsible for a document in the citizen's jurisdiction (most specific). */
export function authorityFor(kb: KnowledgeBase, kind: DocumentKind, citizenJurisdiction: string) {
  const entry = catalogueEntry(kb, kind);
  const match = entry.authorities
    .filter((a) => jurisdictionApplies(a.jurisdiction, citizenJurisdiction))
    .sort((a, b) => specificity(b.jurisdiction) - specificity(a.jurisdiction))[0];
  return match ? kb.authorities.find((a) => a.id === match.authority) ?? null : null;
}

/** C-01 / F02-FR-17 · The 1dentity service price, or null when admins have not set one ("to be confirmed"). */
export function servicePriceFor(kb: KnowledgeBase, service: ServicePrice['service'], document: DocumentKind | undefined, asOf: string): ServicePrice | null {
  const usable = kb.servicePrices.filter((p) => p.service === service && p.meta.status !== 'withdrawn' && appliesOn(p.meta, asOf));
  return usable.find((p) => p.document === document) ?? usable.find((p) => p.document === undefined) ?? null;
}
