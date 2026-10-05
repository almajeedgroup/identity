import type { DocumentKind } from '@identity/content';

export interface OcrWord {
  text: string;
  /** 0–1 */
  confidence: number;
}

export interface OcrResult {
  text: string;
  words: OcrWord[];
  /** 0–1; 1 for text-layer PDFs. */
  meanConfidence: number;
  provider: string;
  engineVersion: string;
}

/** ADR-012 · replaceable OCR providers. */
export interface OcrProvider {
  readonly name: string;
  recognise(bytes: Uint8Array): Promise<OcrResult>;
  close?(): Promise<void>;
}

export type RelativeType = 'father' | 'mother' | 'husband' | 'wife' | 'other';

export interface ExtractedField {
  value: string;
  confidence: number;
}

export interface Extraction {
  kind: DocumentKind | null;
  fields: Partial<Record<'name' | 'dob' | 'gender' | 'father_name' | 'mother_name' | 'spouse_name' | 'relative_name' | 'place_of_birth' | 'address_line' | 'address_pin', ExtractedField>>;
  relativeType?: RelativeType;
  number?: string;
  /** Aadhaar only: the last four digits of a masked number (C-03). */
  last4?: string;
}
