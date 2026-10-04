/** Form state for the Health Check and its conversion to engine input (M01-FR-01, FR-02). */
import type { DocKind } from '@identity/content';
import { makeDob, type Answer, type DocumentDetails, type Gender, type HealthCheckInput } from '@identity/rules';

export interface DocForm {
  name: string;
  day: string;
  month: string;
  year: string;
  yearOnly: boolean;
  gender: Gender | 'unknown' | '';
  locality: string;
}

export const emptyDocForm = (): DocForm => ({ name: '', day: '', month: '', year: '', yearOnly: false, gender: '', locality: '' });

export interface SituationForm {
  livesAtDocumentAddress: Answer | '';
  mobileLinked: Answer | '';
  documentsUpdatedWithin10Years: Answer | '';
}

export type DobResult = { ok: true; dob?: DocumentDetails['dob'] } | { ok: false };

/** Blank → no date; partial or impossible → error; year-only when ticked. */
export function readDob(form: DocForm): DobResult {
  const [day, month, year] = [form.day.trim(), form.month.trim(), form.year.trim()];
  if (form.yearOnly) {
    if (!year) return { ok: true };
    const dob = /^\d{4}$/.test(year) ? makeDob(+year) : undefined;
    return dob ? { ok: true, dob } : { ok: false };
  }
  if (!day && !month && !year) return { ok: true };
  if (!/^\d{1,2}$/.test(day) || !/^\d{1,2}$/.test(month) || !/^\d{4}$/.test(year)) return { ok: false };
  const dob = makeDob(+year, +month, +day);
  return dob ? { ok: true, dob } : { ok: false };
}

export function toHealthCheckInput(held: DocKind[], forms: Record<DocKind, DocForm>, situation: SituationForm): HealthCheckInput {
  const documents: HealthCheckInput['documents'] = {};
  for (const kind of held) {
    const form = forms[kind];
    const details: DocumentDetails = {};
    if (form.name.trim()) details.name = form.name.trim();
    const dob = readDob(form);
    if (dob.ok && dob.dob) details.dob = dob.dob;
    if (form.gender === 'male' || form.gender === 'female' || form.gender === 'transgender') details.gender = form.gender;
    if (form.locality.trim()) details.locality = form.locality.trim();
    documents[kind] = details;
  }
  // Unanswered questions are treated as "Not sure": we never assume an answer the citizen didn't give.
  const answer = (a: Answer | '') => (a === '' ? 'unsure' : a);
  return {
    documents,
    answers: {
      livesAtDocumentAddress: answer(situation.livesAtDocumentAddress),
      mobileLinked: answer(situation.mobileLinked),
      documentsUpdatedWithin10Years: answer(situation.documentsUpdatedWithin10Years),
    },
  };
}
