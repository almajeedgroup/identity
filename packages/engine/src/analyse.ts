/** M02-FR-21 … 24 and M16-FR-03/04 · Field analysis against targets, suggestions, overrides, issues. */
import { COMPARED_FIELDS, catalogueEntry, catalogueIndex, type ComparedField, type PrintedField } from '@identity/content';
import type { EngineContext } from './context';
import { compareValues, displayValue, hasAddress } from './normalize';
import {
  ISSUE_STATUSES,
  STATUS_COLOUR,
  STATUS_RANK,
  type AddressValue,
  type AnalysedDocument,
  type Analysis,
  type DocumentInput,
  type DocumentResult,
  type FieldAnalysis,
  type FieldValue,
  type Issue,
  type Override,
  type Status,
  type Suggestion,
  type Target,
  type ValueStatus,
} from './types';

const RELATIVE_FIELD: Record<string, ComparedField | undefined> = {
  father: 'father_name',
  mother: 'mother_name',
  husband: 'spouse_name',
  wife: 'spouse_name',
};

interface Entry {
  doc: AnalysedDocument;
  printedAs: PrintedField;
  value: FieldValue | null;
  optional: boolean;
}

export function orderDocuments(docs: DocumentInput[], ctx: EngineContext): AnalysedDocument[] {
  return docs
    .map((d, i) => ({ id: d.id, kind: d.kind, tier: catalogueEntry(ctx.kb, d.kind).tier, order: catalogueIndex(ctx.kb, d.kind) * 1000 + i }))
    .sort((a, b) => a.tier - b.tier || a.order - b.order);
}

const present = (v: FieldValue | undefined | null): v is FieldValue =>
  v !== undefined && v !== null && (typeof v === 'string' ? v.trim().length > 0 : hasAddress(v));

/** Entries for one field: the documents that print it (directly or as a relative's name). */
function entriesFor(field: ComparedField, docs: DocumentInput[], ordered: AnalysedDocument[], ctx: EngineContext): Entry[] {
  const out: Entry[] = [];
  for (const doc of ordered) {
    const input = docs.find((d) => d.id === doc.id)!;
    const printed = catalogueEntry(ctx.kb, doc.kind).fields;
    const direct = printed.find((f) => f.field === field);
    if (direct) {
      const v = input.fields[field as keyof typeof input.fields] as FieldValue | undefined;
      out.push({ doc, printedAs: field, value: present(v) ? v : null, optional: direct.optional });
      continue;
    }
    const relative = printed.find((f) => f.field === 'relative_name');
    if (relative && input.fields.relative_type && RELATIVE_FIELD[input.fields.relative_type] === field) {
      const v = input.fields.relative_name;
      out.push({ doc, printedAs: 'relative_name', value: present(v) ? v : null, optional: relative.optional });
    }
  }
  return out;
}

const formattingEqual = (field: ComparedField, a: FieldValue, b: FieldValue, ctx: EngineContext) =>
  STATUS_RANK[compareValues(field, a, b, ctx).status] <= STATUS_RANK.formatting_variation;

/** Groups of formatting-equivalent values, each listed in document order. */
function groupValues(field: ComparedField, entries: Entry[], ctx: EngineContext): Entry[][] {
  const groups: Entry[][] = [];
  for (const e of entries) {
    const g = groups.find((grp) => formattingEqual(field, grp[0]!.value!, e.value!, ctx));
    if (g) g.push(e);
    else groups.push([e]);
  }
  return groups;
}

/** M16-FR-03 / FR-04 */
function suggest(field: ComparedField, entries: Entry[], ctx: EngineContext, profileAddress?: AddressValue): Suggestion | null {
  if (field === 'address' && profileAddress && hasAddress(profileAddress)) {
    return {
      value: profileAddress,
      display: displayValue(profileAddress),
      supportedBy: entries.filter((e) => formattingEqual(field, profileAddress, e.value!, ctx)).map((e) => e.doc.id),
      reason: 'profile',
    };
  }
  if (entries.length === 0) return null;
  const groups = groupValues(field, entries, ctx);
  // Entries are already in tier/catalogue order, so each group's first entry is its most foundational.
  const ranked = [...groups].sort((a, b) => b.length - a.length || a[0]!.doc.tier - b[0]!.doc.tier || a[0]!.doc.order - b[0]!.doc.order);
  const best = ranked[0]!;
  const reason: Suggestion['reason'] = groups.length === 1 ? 'only_value' : best.length > ranked[1]!.length ? 'majority' : 'tie_foundational';
  return { value: best[0]!.value!, display: displayValue(best[0]!.value!), supportedBy: best.map((e) => e.doc.id), reason };
}

export function suggestTarget(
  field: ComparedField,
  values: { id: string; kind: DocumentInput['kind']; value: FieldValue }[],
  ctx: EngineContext,
  profileAddress?: AddressValue,
): Suggestion | null {
  const docs = values.map((v) => ({ id: v.id, kind: v.kind, fields: { [field]: v.value } as DocumentInput['fields'] }));
  const ordered = orderDocuments(docs, ctx);
  return suggest(field, entriesFor(field, docs, ordered, ctx).filter((e) => e.value !== null), ctx, profileAddress);
}

function applyOverride(status: ValueStatus, override: Override | undefined): { status: ValueStatus; overridden: boolean; reason?: 'accepted_by_override' | 'flagged_by_override' } {
  if (!override) return { status, overridden: false };
  if (override.decision === 'accepted_equivalent') {
    return STATUS_RANK[status] > STATUS_RANK.likely_equivalent
      ? { status: 'likely_equivalent', overridden: true, reason: 'accepted_by_override' }
      : { status, overridden: true };
  }
  return STATUS_RANK[status] < STATUS_RANK.potential_discrepancy
    ? { status: 'potential_discrepancy', overridden: true, reason: 'flagged_by_override' }
    : { status, overridden: true };
}

export interface AnalyseInput {
  documents: DocumentInput[];
  targets?: Partial<Record<ComparedField, Target>>;
  overrides?: Override[];
  profileAddress?: AddressValue;
}

/** M02 Part B · Pure: same input, same output; inputs are not modified (M02-AC-12.1). */
export function analyse(input: AnalyseInput, ctx: EngineContext): Analysis {
  const ordered = orderDocuments(input.documents, ctx);
  const fields: FieldAnalysis[] = [];
  const issues: Issue[] = [];

  for (const field of COMPARED_FIELDS) {
    const entries = entriesFor(field, input.documents, ordered, ctx);
    if (entries.length === 0) continue;
    const withValue = entries.filter((e) => e.value !== null);
    const missingEntries = entries.filter((e) => e.value === null && !e.optional);
    const suggestion = suggest(field, withValue, ctx, input.profileAddress);
    const confirmed = input.targets?.[field];
    const target: FieldAnalysis['target'] = confirmed
      ? { ...confirmed, display: displayValue(confirmed.value) }
      : suggestion
        ? { value: suggestion.value, status: 'suggested', display: suggestion.display }
        : null;
    const suggestionDiffers = !!confirmed && !!suggestion && !formattingEqual(field, confirmed.value, suggestion.value, ctx);

    const results: DocumentResult[] = [];
    for (const e of entries) {
      if (e.value === null) {
        if (!e.optional) results.push({ document: e.doc.id, kind: e.doc.kind, printedAs: e.printedAs, value: null, display: '', status: 'missing', reason: 'not_entered', overridden: false });
        continue;
      }
      const cmp = target ? compareValues(field, target.value, e.value, ctx) : { status: 'exact_match' as const };
      const override = input.overrides?.find((o) => o.document === e.doc.id && o.field === field);
      const applied = applyOverride(cmp.status, override);
      const reason = applied.reason ?? cmp.reason;
      results.push({
        document: e.doc.id,
        kind: e.doc.kind,
        printedAs: e.printedAs,
        value: e.value,
        display: displayValue(e.value),
        status: applied.status,
        ...(reason ? { reason } : {}),
        overridden: applied.overridden,
      });
    }

    const valueStatuses = results.filter((r) => r.status !== 'missing').map((r) => r.status as ValueStatus);
    const worst = valueStatuses.reduce<ValueStatus | null>((w, s) => (w === null || STATUS_RANK[s] > STATUS_RANK[w] ? s : w), null);
    const variations = new Set(withValue.map((e) => displayValue(e.value!))).size;
    const groups = withValue.length ? groupValues(field, withValue, ctx).length : 0;
    const review = results.filter((r) => ISSUE_STATUSES.includes(r.status)).map((r) => r.document);

    fields.push({
      field,
      target,
      suggestion,
      suggestionDiffers,
      results,
      colour: worst ? STATUS_COLOUR[worst] : 'grey',
      variations,
      formattingOnly: variations - groups,
      documents: withValue.length,
      missing: missingEntries.length,
      review,
    });

    for (const r of results) {
      if (r.status === 'potential_discrepancy' || r.status === 'major_discrepancy') {
        issues.push({
          document: r.document,
          kind: r.kind,
          field,
          printedAs: r.printedAs,
          status: r.status,
          ...(r.reason ? { reason: r.reason } : {}),
          display: r.display,
          targetDisplay: target?.display ?? '',
        });
      }
    }
  }

  const reviewSet = new Set(issues.map((i) => i.document));
  const notCompared = input.documents
    .filter((d) => d.fields.relative_type === 'other' && catalogueEntry(ctx.kb, d.kind).fields.some((f) => f.field === 'relative_name'))
    .map((d) => d.id);

  return {
    documents: ordered,
    fields,
    issues,
    issueCount: issues.length,
    documentsRequiringReview: ordered.filter((d) => reviewSet.has(d.id)).map((d) => d.id),
    notCompared,
  };
}

export type { Status };
