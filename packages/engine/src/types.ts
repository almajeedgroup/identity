/** M02 Part B · Full Check engine types (PRD §11–§14). */
import type { ComparedField, DocumentKind, PrintedField } from '@identity/content';

/** M02-FR-14, best to worst; `missing` is informational and reported separately. */
export type Status = 'exact_match' | 'formatting_variation' | 'likely_equivalent' | 'potential_discrepancy' | 'major_discrepancy' | 'missing';
export type ValueStatus = Exclude<Status, 'missing'>;
export type Colour = 'green' | 'yellow' | 'orange' | 'red' | 'grey';

export const STATUS_RANK: Record<ValueStatus, number> = {
  exact_match: 0,
  formatting_variation: 1,
  likely_equivalent: 2,
  potential_discrepancy: 3,
  major_discrepancy: 4,
};

/** M02-FR-15 */
export const STATUS_COLOUR: Record<Status, Colour> = {
  exact_match: 'green',
  formatting_variation: 'green',
  likely_equivalent: 'yellow',
  potential_discrepancy: 'orange',
  major_discrepancy: 'red',
  missing: 'grey',
};

export const ISSUE_STATUSES: readonly Status[] = ['potential_discrepancy', 'major_discrepancy'];

export type ReasonCode =
  // names
  | 'case_or_punctuation'
  | 'honorific'
  | 'spacing'
  | 'initials'
  | 'abbreviation'
  | 'transliteration'
  | 'word_order'
  | 'missing_or_extra_part'
  | 'different_name'
  // dates
  | 'format_only'
  | 'year_only'
  | 'day_month_swapped'
  | 'placeholder_date'
  | 'unreadable_date'
  | 'date_differs'
  // gender
  | 'gender_format'
  | 'gender_differs'
  // places
  | 'place_renamed'
  | 'place_partial'
  | 'place_differs'
  // address
  | 'address_abbreviation'
  | 'address_less_detail'
  | 'address_line_differs'
  | 'address_city_or_pin_differs'
  // other
  | 'not_entered'
  | 'accepted_by_override'
  | 'flagged_by_override';

export interface Comparison {
  status: ValueStatus;
  reason?: ReasonCode;
}

export interface AddressValue {
  line?: string;
  city?: string;
  district?: string;
  state?: string;
  pin?: string;
}

export type RelativeType = 'father' | 'mother' | 'husband' | 'wife' | 'other';

export interface DocumentFields {
  name?: string;
  dob?: string;
  gender?: string;
  father_name?: string;
  mother_name?: string;
  spouse_name?: string;
  place_of_birth?: string;
  address?: AddressValue;
  relative_name?: string;
  relative_type?: RelativeType;
}

/** One document's confirmed values (C-17: only confirmed values are compared). */
export interface DocumentInput {
  id: string;
  kind: DocumentKind;
  fields: DocumentFields;
}

export type FieldValue = string | AddressValue;

export interface Target {
  value: FieldValue;
  status: 'suggested' | 'confirmed';
}

/** M02-FR-23 / M16-FR-06 */
export interface Override {
  document: string;
  field: ComparedField;
  decision: 'accepted_equivalent' | 'requires_correction';
  reason?: string;
}

export interface Suggestion {
  value: FieldValue;
  display: string;
  supportedBy: string[];
  reason: 'only_value' | 'majority' | 'tie_foundational' | 'profile';
}

export interface DocumentResult {
  document: string;
  kind: DocumentKind;
  /** The field as printed on this document (`relative_name` when mapped from a relative). */
  printedAs: PrintedField;
  value: FieldValue | null;
  display: string;
  status: Status;
  reason?: ReasonCode;
  overridden: boolean;
}

export interface FieldAnalysis {
  field: ComparedField;
  target: (Target & { display: string }) | null;
  suggestion: Suggestion | null;
  /** A confirmed target that no longer matches what the documents suggest (M16-AC-3.2). */
  suggestionDiffers: boolean;
  results: DocumentResult[];
  colour: Colour;
  variations: number;
  formattingOnly: number;
  documents: number;
  missing: number;
  review: string[];
}

export interface Issue {
  document: string;
  kind: DocumentKind;
  field: ComparedField;
  printedAs: PrintedField;
  status: 'potential_discrepancy' | 'major_discrepancy';
  reason?: ReasonCode;
  display: string;
  targetDisplay: string;
}

export interface AnalysedDocument {
  id: string;
  kind: DocumentKind;
  tier: number;
  order: number;
}

export interface Analysis {
  documents: AnalysedDocument[];
  fields: FieldAnalysis[];
  issues: Issue[];
  issueCount: number;
  documentsRequiringReview: string[];
  /** Relatives with relation "other": shown, not compared (M02-FR-21). */
  notCompared: string[];
}
