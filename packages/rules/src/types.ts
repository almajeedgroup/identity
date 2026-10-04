import type { DocKind, Field } from '@identity/content';
import type { NameReason } from './names';

export type Answer = 'yes' | 'no' | 'unsure';
export type Gender = 'male' | 'female' | 'transgender';

/** A date of birth; year-only when month and day are absent. */
export interface Dob {
  year: number;
  month?: number;
  day?: number;
}

export interface DocumentDetails {
  name?: string;
  dob?: Dob;
  gender?: Gender;
  locality?: string;
}

export interface HealthCheckInput {
  /** A key being present means the citizen holds that document. */
  documents: Partial<Record<DocKind, DocumentDetails>>;
  answers?: {
    mobileLinked?: Answer;
    documentsUpdatedWithin10Years?: Answer;
    livesAtDocumentAddress?: Answer;
  };
}

export type FieldResult = 'ok' | 'mismatch' | 'update_due' | 'na';
export type IssueKind = 'mismatch' | 'update_due';
export type DocumentStatus = 'valid' | 'update_due' | 'mismatch';

export type ReasonCode =
  | NameReason
  | 'date_differs'
  | 'year_only'
  | 'year_differs'
  | 'gender_differs'
  | 'address_differs'
  | 'moved'
  | 'mobile_not_linked'
  | 'documents_not_updated_10y';

export const REASON_CODES: readonly ReasonCode[] = [
  'spacing',
  'initials',
  'abbreviation',
  'transliteration',
  'word_order',
  'different_name',
  'missing_or_extra_part',
  'date_differs',
  'year_only',
  'year_differs',
  'gender_differs',
  'address_differs',
  'moved',
  'mobile_not_linked',
  'documents_not_updated_10y',
];

export type TipCode = 'check_mobile_link' | 'check_document_update' | 'check_address';
export const TIP_CODES: readonly TipCode[] = ['check_mobile_link', 'check_document_update', 'check_address'];

export interface Issue {
  id: string;
  document: DocKind;
  field: Field;
  kind: IssueKind;
  reason: ReasonCode;
  /** The document this one was compared against, when the issue comes from a comparison. */
  comparedWith?: DocKind;
}

export interface PlannedAction {
  actionId: string;
  document: DocKind;
  fields: Field[];
  issueIds: string[];
  priority: number;
}

export interface MismatchReport {
  held: DocKind[];
  reference: DocKind | null;
  fieldResults: Partial<Record<Field, Partial<Record<DocKind, FieldResult>>>>;
  issues: Issue[];
  tips: TipCode[];
  documentStatus: Partial<Record<DocKind, DocumentStatus>>;
  actions: PlannedAction[];
}
