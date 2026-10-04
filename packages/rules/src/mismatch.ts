/** M02 · Mismatch Detector — a pure function of the citizen's answers and the content bundle. */
import { DOC_KINDS, type ContentBundle, type DocKind, type Field } from '@identity/content';
import { buildNameDictionary, compareNames, sameLocality } from './names';
import type {
  Dob,
  DocumentDetails,
  DocumentStatus,
  FieldResult,
  HealthCheckInput,
  Issue,
  IssueKind,
  MismatchReport,
  PlannedAction,
  ReasonCode,
  TipCode,
} from './types';

/** M02-FR-03 — reference order (Q-02 default). */
export const REFERENCE_ORDER: readonly DocKind[] = ['aadhaar', 'pan', 'voter_id'];

const COMPARED_FIELDS = ['name', 'dob', 'gender', 'address'] as const;
type ComparedField = (typeof COMPARED_FIELDS)[number];

function isYearOnly(dob: Dob): boolean {
  return dob.month === undefined || dob.day === undefined;
}

function hasValue(details: DocumentDetails, field: ComparedField): boolean {
  switch (field) {
    case 'name':
      return !!details.name?.trim();
    case 'dob':
      return !!details.dob;
    case 'gender':
      return !!details.gender;
    case 'address':
      return !!details.locality?.trim();
  }
}

export function detectMismatches(input: HealthCheckInput, bundle: ContentBundle): MismatchReport {
  const held = REFERENCE_ORDER.filter((k) => input.documents[k] !== undefined);
  const reference = held[0] ?? null;
  const answers = { mobileLinked: 'yes', documentsUpdatedWithin10Years: 'yes', livesAtDocumentAddress: 'yes', ...input.answers } as const;
  const dict = buildNameDictionary(bundle.nameVariants.groups);
  const printed = (doc: DocKind, field: Field) =>
    bundle.documents.find((d) => d.kind === doc)?.fieldsPrinted.includes(field) ?? false;
  const details = (doc: DocKind): DocumentDetails => input.documents[doc] ?? {};

  const issues: Issue[] = [];
  const tips = new Set<TipCode>();
  const addIssue = (document: DocKind, field: Field, kind: IssueKind, reason: ReasonCode, comparedWith?: DocKind) => {
    const id = `${document}:${field}`;
    const existing = issues.find((i) => i.id === id);
    if (existing) {
      if (existing.kind === 'update_due' && kind === 'mismatch') Object.assign(existing, { kind, reason, comparedWith });
      return;
    }
    issues.push({ id, document, field, kind, reason, ...(comparedWith ? { comparedWith } : {}) });
  };

  /** M02-FR-03 — per field, compare against the first held document (in reference order) that has a value. */
  const fieldReference = (field: ComparedField): DocKind | undefined =>
    held.find((d) => printed(d, field) && hasValue(details(d), field));

  // Names (M02-FR-05)
  const nameRef = fieldReference('name');
  if (nameRef) {
    for (const doc of held) {
      if (doc === nameRef || !printed(doc, 'name') || !hasValue(details(doc), 'name')) continue;
      const c = compareNames(details(nameRef).name!, details(doc).name!, dict);
      if (c.result !== 'match') addIssue(doc, 'name', 'mismatch', c.reason, nameRef);
    }
  }

  // Dates of birth (M02-FR-07)
  for (const doc of held) {
    const dob = details(doc).dob;
    if (dob && printed(doc, 'dob') && isYearOnly(dob)) addIssue(doc, 'dob', 'update_due', 'year_only');
  }
  const dobRef = fieldReference('dob');
  if (dobRef) {
    const ref = details(dobRef).dob!;
    for (const doc of held) {
      if (doc === dobRef || !printed(doc, 'dob') || !hasValue(details(doc), 'dob')) continue;
      const other = details(doc).dob!;
      if (!isYearOnly(ref) && !isYearOnly(other)) {
        if (ref.year !== other.year || ref.month !== other.month || ref.day !== other.day) {
          addIssue(doc, 'dob', 'mismatch', 'date_differs', dobRef);
        }
      } else if (ref.year !== other.year) {
        addIssue(doc, 'dob', 'mismatch', 'year_differs', dobRef);
      }
    }
  }

  // Gender (M02-FR-08)
  const genderRef = fieldReference('gender');
  if (genderRef) {
    for (const doc of held) {
      if (doc === genderRef || !printed(doc, 'gender') || !hasValue(details(doc), 'gender')) continue;
      if (details(doc).gender !== details(genderRef).gender) addIssue(doc, 'gender', 'mismatch', 'gender_differs', genderRef);
    }
  }

  // Address (M02-FR-09)
  const addressDocs = held.filter((d) => printed(d, 'address'));
  if (answers.livesAtDocumentAddress === 'no') {
    for (const doc of addressDocs) addIssue(doc, 'address', 'update_due', 'moved');
  } else {
    if (answers.livesAtDocumentAddress === 'unsure' && addressDocs.length) tips.add('check_address');
    const addressRef = fieldReference('address');
    if (addressRef) {
      for (const doc of addressDocs) {
        if (doc === addressRef || !hasValue(details(doc), 'address')) continue;
        if (!sameLocality(details(addressRef).locality!, details(doc).locality!)) {
          addIssue(doc, 'address', 'update_due', 'address_differs', addressRef);
        }
      }
    }
  }

  // Aadhaar-only answers (M02-FR-10)
  if (held.includes('aadhaar')) {
    if (answers.mobileLinked === 'no') addIssue('aadhaar', 'mobile_link', 'update_due', 'mobile_not_linked');
    if (answers.mobileLinked === 'unsure') tips.add('check_mobile_link');
    if (answers.documentsUpdatedWithin10Years === 'no') addIssue('aadhaar', 'documents', 'update_due', 'documents_not_updated_10y');
    if (answers.documentsUpdatedWithin10Years === 'unsure') tips.add('check_document_update');
  }

  return {
    held,
    reference,
    fieldResults: fieldResults(held, issues, input, printed, answers.mobileLinked, answers.documentsUpdatedWithin10Years),
    issues,
    tips: [...tips],
    documentStatus: documentStatus(held, issues),
    actions: planActions(issues, bundle),
  };
}

/** M02-FR-11 */
function fieldResults(
  held: DocKind[],
  issues: Issue[],
  input: HealthCheckInput,
  printed: (doc: DocKind, field: Field) => boolean,
  mobileLinked: string,
  documentsUpdated: string,
): MismatchReport['fieldResults'] {
  const results: MismatchReport['fieldResults'] = {};
  const issueKind = (doc: DocKind, field: Field) => issues.find((i) => i.document === doc && i.field === field)?.kind;
  for (const field of COMPARED_FIELDS) {
    const row: Partial<Record<DocKind, FieldResult>> = {};
    for (const doc of held) {
      const kind = issueKind(doc, field);
      if (kind) row[doc] = kind;
      else if (!printed(doc, field) || !hasValue(input.documents[doc] ?? {}, field)) row[doc] = 'na';
      else row[doc] = 'ok';
    }
    results[field] = row;
  }
  if (held.includes('aadhaar')) {
    const answerResult = (field: Field, answer: string): FieldResult =>
      issueKind('aadhaar', field) ?? (answer === 'yes' ? 'ok' : 'na');
    results.mobile_link = { aadhaar: answerResult('mobile_link', mobileLinked) };
    results.documents = { aadhaar: answerResult('documents', documentsUpdated) };
  }
  return results;
}

/** M02-FR-12 */
function documentStatus(held: DocKind[], issues: Issue[]): Partial<Record<DocKind, DocumentStatus>> {
  const status: Partial<Record<DocKind, DocumentStatus>> = {};
  for (const doc of held) {
    const kinds = issues.filter((i) => i.document === doc).map((i) => i.kind);
    status[doc] = kinds.includes('mismatch') ? 'mismatch' : kinds.includes('update_due') ? 'update_due' : 'valid';
  }
  return status;
}

/** M02-FR-13 — one action per correction path, ordered by content priority. */
export function planActions(issues: Issue[], bundle: ContentBundle): PlannedAction[] {
  const planned = new Map<string, PlannedAction>();
  for (const issue of issues) {
    const action = bundle.actions.find((a) => a.document === issue.document && a.fields.includes(issue.field));
    if (!action) continue;
    const entry = planned.get(action.id) ?? {
      actionId: action.id,
      document: action.document,
      fields: [],
      issueIds: [],
      priority: action.priority,
    };
    if (!entry.fields.includes(issue.field)) entry.fields.push(issue.field);
    entry.issueIds.push(issue.id);
    planned.set(action.id, entry);
  }
  return [...planned.values()].sort((a, b) => a.priority - b.priority || a.actionId.localeCompare(b.actionId));
}

/** Issues for which the content has no action — should always be empty; checked in tests. */
export function issuesWithoutAction(issues: Issue[], bundle: ContentBundle): Issue[] {
  return issues.filter((i) => !bundle.actions.some((a) => a.document === i.document && a.fields.includes(i.field)));
}

export { DOC_KINDS };
