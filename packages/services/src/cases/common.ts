/** Shared pieces of the case services (M04, M09). */
import { randomUUID } from 'node:crypto';
import { computeSla, formatCaseId, type CaseState, type Sla } from '@identity/domain';
import { MAX_UPLOAD_BYTES, sha256Hex, sniffType, tables, type Db } from '@identity/db';
import { containsFullAadhaar } from '@identity/ocr';
import { asc, eq } from 'drizzle-orm';
import { nowOf, ServiceError, type Services } from '../services';

const { caseEvents, caseFiles, cases } = tables;

export type CaseRow = typeof cases.$inferSelect;
export const caseIdOf = (row: Pick<CaseRow, 'number'>) => formatCaseId(row.number);
export const isOpen = (state: string) => !['completed', 'closed_not_proceeding', 'withdrawn'].includes(state);

/** M09-EX-checklist · after the rule's required documents. */
export const STANDARD_CHECKLIST = [
  'Confirm the target details with the citizen',
  'Check the documents needed',
  'Book or confirm the visit, if needed',
  'File the application on the official portal (the citizen enters any OTP)',
  'Record the application reference',
  'Share progress with the citizen',
] as const;

export const CASE_FILE_RETENTION_DAYS = 30;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const isUuid = (v: string) => UUID.test(v);

/** C-03 / M09-AC-3.3 · 12-digit numbers that pass the Aadhaar checksum keep only their last four digits. */
export function maskAadhaarInText(text: string): string {
  return text.replace(/\b\d{4}[ -]?\d{4}[ -]?\d{4}\b/g, (m) => (containsFullAadhaar(m) ? `XXXX XXXX ${m.replace(/\D/g, '').slice(-4)}` : m));
}

export function cleanBody(text: string, max = 2000): string {
  const v = text.replace(/\r\n/g, '\n').trim();
  if (!v) throw new ServiceError('reason_required');
  if (v.length > max) throw new ServiceError('invalid_value');
  return maskAadhaarInText(v);
}

export async function loadCase(db: Db, caseId: string): Promise<CaseRow | null> {
  if (!isUuid(caseId)) return null;
  const [row] = await db.select().from(cases).where(eq(cases.id, caseId)).limit(1);
  return row ?? null;
}

export async function stateEvents(db: Db, caseId: string) {
  return db.select().from(caseEvents).where(eq(caseEvents.caseId, caseId)).orderBy(asc(caseEvents.at));
}

export async function slaOf(s: Services, row: CaseRow): Promise<Sla> {
  const events = (await stateEvents(s.db, row.id)).filter((e) => e.kind === 'state' && e.toState).map((e) => ({ to: e.toState as CaseState, at: e.at }));
  return computeSla({ createdAt: row.createdAt, events, holidays: s.holidays ?? [], now: nowOf(s) });
}

/**
 * Stores a case file encrypted after checking its type and size and that it does not show a full Aadhaar number
 * (C-03, F07-AC-3.1); nothing is stored when it is refused.
 */
export async function storeCaseFile(
  s: Services,
  caseId: string,
  input: { bytes: Uint8Array; kind: 'citizen' | 'staff' | 'proof'; label?: string; by: { kind: 'citizen' | 'staff'; id: string } },
): Promise<string> {
  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) throw new ServiceError('too_large');
  const mime = sniffType(input.bytes);
  if (!mime) throw new ServiceError('bad_type');
  const read = await (mime === 'application/pdf' ? s.ocr.pdf : s.ocr.image).recognise(input.bytes);
  if (containsFullAadhaar(read.text)) throw new ServiceError('rejected_aadhaar');
  const storageKey = randomUUID();
  await s.store.put(storageKey, input.bytes);
  try {
    const [row] = await s.db
      .insert(caseFiles)
      .values({
        caseId,
        storageKey,
        mime,
        sizeBytes: input.bytes.byteLength,
        sha256: sha256Hex(input.bytes),
        kind: input.kind,
        label: input.label?.trim().slice(0, 120) || null,
        uploadedByKind: input.by.kind,
        uploadedById: input.by.id,
        createdAt: nowOf(s),
      })
      .returning({ id: caseFiles.id });
    return row!.id;
  } catch (error) {
    await s.store.delete(storageKey);
    throw error;
  }
}
