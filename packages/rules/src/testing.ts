/** Test helper: turn the YAML example shape used in M01/M02 specs into engine input. */
import type { DocKind } from '@identity/content';
import { parseDob } from './dob';
import type { Answer, DocumentDetails, Gender, HealthCheckInput } from './types';

export interface ExampleDocument {
  name?: string;
  dob?: string;
  gender?: Gender;
  locality?: string;
}

export interface ExampleInput {
  documents: Partial<Record<DocKind, ExampleDocument | null>>;
  answers?: Partial<Record<'mobileLinked' | 'documentsUpdatedWithin10Years' | 'livesAtDocumentAddress', Answer>>;
}

export function toInput(example: ExampleInput): HealthCheckInput {
  const documents: HealthCheckInput['documents'] = {};
  for (const [kind, doc] of Object.entries(example.documents) as [DocKind, ExampleDocument | null][]) {
    const details: DocumentDetails = {};
    if (doc?.name) details.name = doc.name;
    if (doc?.gender) details.gender = doc.gender;
    if (doc?.locality) details.locality = doc.locality;
    if (doc?.dob) {
      const dob = parseDob(doc.dob);
      if (!dob) throw new Error(`Bad example date: ${doc.dob}`);
      details.dob = dob;
    }
    documents[kind] = details;
  }
  return { documents, ...(example.answers ? { answers: example.answers } : {}) };
}
