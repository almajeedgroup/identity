/** M17 · Documents: typed or uploaded, read by OCR, confirmed by the citizen, versioned, deleted for real. */
import { randomUUID } from 'node:crypto';
import { authorityFor, catalogueEntry, DOCUMENT_KINDS, type DocumentKind, type KnowledgeBase } from '@identity/content';
import {
  canonicalJson,
  decryptValue,
  encryptValue,
  maskAadhaar,
  maskNumber,
  MAX_UPLOAD_BYTES,
  sha256Hex,
  sniffType,
  tables,
  UPLOAD_RETENTION_DAYS_AFTER_VERIFICATION,
  writeAudit,
  type Db,
} from '@identity/db';
import type { AddressValue } from '@identity/engine';
import { extractFields, readDocument, type Extraction } from '@identity/ocr';
import { and, asc, desc, eq, inArray, isNull } from 'drizzle-orm';
import { requireConsent } from './consents';
import { notify } from './notifications';
import { requireProfile, type Profile } from './profile';
import { nowOf, ServiceError, type Services } from './services';
import { cleanNumber, cleanValues, normalisedOf, valueEntries, type CleanNumber, type DocumentValues } from './values';

const { citizenProfiles, documentFields, documentVersions, documents, ocrExtractions, uploads } = tables;

type DocumentRow = typeof documents.$inferSelect;
type FieldRow = typeof documentFields.$inferSelect;
type StoredValue = string | AddressValue;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const DAY = 86_400_000;

export function checkKind(kb: KnowledgeBase, kind: string): DocumentKind {
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind) || !kb.catalogue.some((c) => c.kind === kind)) throw new ServiceError('invalid_kind');
  return kind as DocumentKind;
}

/** A document the user owns, or "not found" — never a hint that it exists (M17-AC-5.3). */
async function ownedDocument(db: Db, userId: string, documentId: string): Promise<{ doc: DocumentRow; profile: Profile }> {
  if (!UUID.test(documentId)) throw new ServiceError('not_found');
  const [row] = await db
    .select({ doc: documents, profile: citizenProfiles })
    .from(documents)
    .innerJoin(citizenProfiles, eq(documents.profileId, citizenProfiles.id))
    .where(and(eq(documents.id, documentId), eq(citizenProfiles.userId, userId)))
    .limit(1);
  if (!row) throw new ServiceError('not_found');
  return row;
}

const numberColumns = (n: CleanNumber | null | undefined) => (n === undefined ? {} : { numberEncrypted: n?.encrypted ?? null, numberLast4: n?.last4 ?? null });

// ---------------------------------------------------------------- typed (M17 US1)

/** M17-AC-1.2 · Typed values are original and confirmed at once; the document counts immediately. */
export async function addTypedDocument(s: Services, userId: string, input: { kind: string; values: DocumentValues; number?: string }): Promise<string> {
  await requireConsent(s.db, userId, 'full_check');
  const profile = await requireProfile(s.db, userId);
  const { kb } = await s.knowledge();
  const kind = checkKind(kb, input.kind);
  const values = cleanValues(kb, kind, input.values);
  const number = input.number ? cleanNumber(kb, kind, input.number, s.keyring) : null;
  const now = nowOf(s);
  const documentId = await s.db.transaction(async (tx) => {
    const [doc] = await tx
      .insert(documents)
      .values({
        profileId: profile.id,
        kind,
        jurisdiction: profile.jurisdiction,
        issuingAuthority: authorityFor(kb, kind, profile.jurisdiction)?.id ?? null,
        ...numberColumns(number),
        source: 'manual',
        status: 'verified',
        createdAt: now,
        updatedAt: now,
        verifiedAt: now,
      })
      .returning({ id: documents.id });
    await tx.insert(documentVersions).values({ documentId: doc!.id, version: 1, reason: 'created', createdByKind: 'citizen', createdAt: now });
    const entries = valueEntries(values);
    if (entries.length) {
      await tx.insert(documentFields).values(
        entries.map(([field, value]) => ({ documentId: doc!.id, version: 1, field, original: value, normalised: normalisedOf(field, value), confirmed: value, source: 'manual' as const, createdAt: now, updatedAt: now })),
      );
    }
    return doc!.id;
  });
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'document.created', subjectKind: 'document', subjectId: documentId, details: { kind, source: 'manual', fields: valueEntries(values).length } }, now);
  return documentId;
}

// ---------------------------------------------------------------- upload and OCR (M17 US2, US3)

const ADDRESS_KEYS = { address_line: 'line', address_pin: 'pin' } as const;

/** Extracted fields → document values, keeping only what this document prints. */
function extractionValues(kb: KnowledgeBase, kind: DocumentKind, e: Extraction): { values: DocumentValues; confidence: Record<string, number> } {
  const printed = new Set<string>(catalogueEntry(kb, kind).fields.map((f) => f.field));
  const values: Record<string, StoredValue> = {};
  const confidence: Record<string, number> = {};
  const address: AddressValue = {};
  const addressConfidence: number[] = [];
  for (const [key, f] of Object.entries(e.fields)) {
    if (!f) continue;
    if (key in ADDRESS_KEYS) {
      address[ADDRESS_KEYS[key as keyof typeof ADDRESS_KEYS]] = f.value;
      addressConfidence.push(f.confidence);
    } else if (printed.has(key)) {
      values[key] = f.value;
      confidence[key] = f.confidence;
    }
  }
  if (printed.has('address') && Object.keys(address).length) {
    values.address = address;
    confidence.address = Math.min(...addressConfidence);
  }
  if (values.relative_name && e.relativeType) {
    values.relative_type = e.relativeType;
    confidence.relative_type = confidence.relative_name!;
  }
  return { values: values as DocumentValues, confidence };
}

function extractedNumber(kb: KnowledgeBase, kind: DocumentKind, e: Extraction, s: Services): CleanNumber | null {
  try {
    if (catalogueEntry(kb, kind).numberStorage === 'last4_only') return e.last4 ? { encrypted: null, last4: e.last4 } : null;
    return e.number ? cleanNumber(kb, kind, e.number, s.keyring) : null;
  } catch {
    return null; // an unreadable number is left for the citizen to type
  }
}

const fieldRows = (documentId: string, version: number, values: DocumentValues, confidence: Record<string, number>, now: Date) =>
  valueEntries(values).map(([field, value]) => ({
    documentId,
    version,
    field,
    original: value,
    normalised: normalisedOf(field, value),
    confirmed: null,
    source: 'ocr' as const,
    confidence: confidence[field] ?? null,
    createdAt: now,
    updatedAt: now,
  }));

export interface UploadOutcome {
  documentId: string;
  detectedKind: DocumentKind | null;
  kindMismatch: boolean;
}

/**
 * M17-FR-03 · Read first, store after: an upload showing a full Aadhaar number is discarded before anything is
 * written (M17-AC-2.3), and a file without text is not kept (M17-AC-4.1).
 */
export async function uploadDocument(s: Services, userId: string, input: { kind: string; bytes: Uint8Array }): Promise<UploadOutcome> {
  await requireConsent(s.db, userId, 'full_check');
  await requireConsent(s.db, userId, 'uploads');
  const profile = await requireProfile(s.db, userId);
  const { kb } = await s.knowledge();
  const kind = checkKind(kb, input.kind);
  if (input.bytes.byteLength > MAX_UPLOAD_BYTES) throw new ServiceError('too_large');
  const mime = sniffType(input.bytes);
  if (!mime) throw new ServiceError('bad_type');
  const now = nowOf(s);

  const read = await readDocument(input.bytes, mime, kind, s.ocr, kb);
  if (read.status === 'rejected_aadhaar') {
    await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'document.upload_rejected_aadhaar', details: { kind, mime } }, now);
    throw new ServiceError('rejected_aadhaar');
  }
  if (read.status === 'no_text') throw new ServiceError('no_text');

  const { values, confidence } = extractionValues(kb, kind, read.extraction);
  const number = extractedNumber(kb, kind, read.extraction, s);
  const storageKey = randomUUID();
  await s.store.put(storageKey, input.bytes);
  let ids: { documentId: string; uploadId: string };
  try {
    ids = await s.db.transaction(async (tx) => {
      const [doc] = await tx
        .insert(documents)
        .values({
          profileId: profile.id,
          kind,
          jurisdiction: profile.jurisdiction,
          issuingAuthority: authorityFor(kb, kind, profile.jurisdiction)?.id ?? null,
          ...numberColumns(number),
          source: 'upload',
          status: 'needs_verification',
          createdAt: now,
          updatedAt: now,
        })
        .returning({ id: documents.id });
      const documentId = doc!.id;
      await tx.insert(documentVersions).values({ documentId, version: 1, reason: 'uploaded', createdByKind: 'citizen', createdAt: now });
      const [upload] = await tx
        .insert(uploads)
        .values({ documentId, storageKey, mime, sizeBytes: input.bytes.byteLength, sha256: sha256Hex(input.bytes), createdAt: now })
        .returning({ id: uploads.id });
      await tx.insert(ocrExtractions).values({
        documentId,
        uploadId: upload!.id,
        provider: read.ocr.provider,
        engineVersion: read.ocr.engineVersion,
        rawText: encryptValue(read.ocr.text, s.keyring),
        meanConfidence: read.ocr.meanConfidence,
        // The number is kept only encrypted on the document (F07-FR-05).
        fields: { fields: read.extraction.fields, relativeType: read.extraction.relativeType ?? null },
        detectedKind: read.detectedKind,
        createdAt: now,
      });
      const rows = fieldRows(documentId, 1, values, confidence, now);
      if (rows.length) await tx.insert(documentFields).values(rows);
      return { documentId, uploadId: upload!.id };
    });
  } catch (error) {
    await s.store.delete(storageKey);
    throw error;
  }
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'document.uploaded', subjectKind: 'document', subjectId: ids.documentId, details: { kind, mime, sizeBytes: input.bytes.byteLength, uploadId: ids.uploadId } }, now);
  await writeAudit(
    s.db,
    {
      actorKind: 'system',
      action: 'document.extracted',
      subjectKind: 'document',
      subjectId: ids.documentId,
      details: { provider: read.ocr.provider, fields: Object.keys(values).length, meanConfidence: Math.round(read.ocr.meanConfidence * 100) / 100, detectedKind: read.detectedKind },
    },
    now,
  );
  await notify(s, { userId, kind: 'verify_upload', documentId: ids.documentId });
  return { documentId: ids.documentId, detectedKind: read.detectedKind, kindMismatch: read.kindMismatch };
}

/** M17-AC-3.5 · Switch an unconfirmed upload to the type it looks like, re-reading the stored text. */
export async function changeKind(s: Services, userId: string, documentId: string, kindInput: string): Promise<void> {
  await requireConsent(s.db, userId, 'full_check');
  const { doc } = await ownedDocument(s.db, userId, documentId);
  if (doc.status === 'verified') throw new ServiceError('already_verified');
  const { kb } = await s.knowledge();
  const kind = checkKind(kb, kindInput);
  if (kind === doc.kind) return;
  const [extraction] = await s.db.select().from(ocrExtractions).where(eq(ocrExtractions.documentId, documentId)).orderBy(desc(ocrExtractions.createdAt)).limit(1);
  const now = nowOf(s);
  const reread = extraction ? extractFields(decryptValue(extraction.rawText, s.keyring), { kind, defaultConfidence: extraction.meanConfidence ?? 1, kb }) : null;
  const { values, confidence } = reread ? extractionValues(kb, kind, reread) : { values: {}, confidence: {} };
  const number = reread ? extractedNumber(kb, kind, reread, s) : null;
  await s.db.transaction(async (tx) => {
    // Unconfirmed rows read under the wrong type; the raw text — the true original — stays (C-16).
    await tx.delete(documentFields).where(and(eq(documentFields.documentId, documentId), isNull(documentFields.confirmed)));
    const rows = fieldRows(documentId, doc.currentVersion, values, confidence, now);
    if (rows.length) await tx.insert(documentFields).values(rows);
    await tx
      .update(documents)
      .set({ kind, issuingAuthority: authorityFor(kb, kind, doc.jurisdiction)?.id ?? null, ...numberColumns(number), updatedAt: now })
      .where(eq(documents.id, documentId));
  });
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'document.kind_changed', subjectKind: 'document', subjectId: documentId, details: { from: doc.kind, to: kind } }, now);
}

/** M17-FR-06 / M17-AC-3.4 · Confirmed values are set beside the originals, which never change. */
export async function confirmDocument(s: Services, userId: string, documentId: string, input: { values: DocumentValues; number?: string }): Promise<void> {
  await requireConsent(s.db, userId, 'full_check');
  const { doc } = await ownedDocument(s.db, userId, documentId);
  if (doc.status === 'verified') throw new ServiceError('already_verified');
  const { kb } = await s.knowledge();
  const kind = doc.kind as DocumentKind;
  const values = cleanValues(kb, kind, input.values);
  const number = input.number?.trim() ? cleanNumber(kb, kind, input.number, s.keyring) : undefined;
  const now = nowOf(s);
  const existing = await s.db
    .select()
    .from(documentFields)
    .where(and(eq(documentFields.documentId, documentId), eq(documentFields.version, doc.currentVersion)));
  const confirmed = new Map(valueEntries(values));
  let changed = 0;
  await s.db.transaction(async (tx) => {
    for (const row of existing) {
      const value = confirmed.get(row.field as never) ?? null;
      if (canonicalJson(value) !== canonicalJson(row.original)) changed++;
      await tx
        .update(documentFields)
        .set({ confirmed: value, normalised: value === null ? row.normalised : normalisedOf(row.field, value), updatedAt: now })
        .where(eq(documentFields.id, row.id));
    }
    const added = [...confirmed].filter(([field]) => !existing.some((r) => r.field === field));
    changed += added.length;
    if (added.length) {
      await tx.insert(documentFields).values(
        added.map(([field, value]) => ({ documentId, version: doc.currentVersion, field, original: value, normalised: normalisedOf(field, value), confirmed: value, source: 'manual' as const, createdAt: now, updatedAt: now })),
      );
    }
    await tx
      .update(documents)
      .set({ status: 'verified', verifiedAt: now, updatedAt: now, ...numberColumns(number) })
      .where(eq(documents.id, documentId));
    // M17-FR-07 / Q-26
    await tx
      .update(uploads)
      .set({ purgeAfter: new Date(now.getTime() + UPLOAD_RETENTION_DAYS_AFTER_VERIFICATION * DAY) })
      .where(and(eq(uploads.documentId, documentId), isNull(uploads.purgedAt)));
  });
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'document.verified', subjectKind: 'document', subjectId: documentId, details: { changed } }, now);
}

/** M17-AC-5.1 · Editing a verified document creates a new version; earlier versions remain. */
export async function editDocument(s: Services, userId: string, documentId: string, input: { values: DocumentValues; number?: string }): Promise<number> {
  await requireConsent(s.db, userId, 'full_check');
  const { doc } = await ownedDocument(s.db, userId, documentId);
  if (doc.status !== 'verified') throw new ServiceError('not_verified');
  const { kb } = await s.knowledge();
  const kind = doc.kind as DocumentKind;
  const values = cleanValues(kb, kind, input.values);
  const number = input.number?.trim() ? cleanNumber(kb, kind, input.number, s.keyring) : undefined;
  const now = nowOf(s);
  const previous = await s.db
    .select()
    .from(documentFields)
    .where(and(eq(documentFields.documentId, documentId), eq(documentFields.version, doc.currentVersion)));
  const version = doc.currentVersion + 1;
  await s.db.transaction(async (tx) => {
    await tx.insert(documentVersions).values({ documentId, version, reason: 'edited', createdByKind: 'citizen', createdAt: now });
    const rows = valueEntries(values).map(([field, value]) => {
      // An unchanged value keeps its provenance (what the document said, how it was read).
      const same = previous.find((p) => p.field === field && canonicalJson(p.confirmed) === canonicalJson(value));
      return {
        documentId,
        version,
        field,
        original: same ? same.original : value,
        normalised: normalisedOf(field, value),
        confirmed: value,
        source: same ? same.source : ('manual' as const),
        confidence: same ? same.confidence : null,
        createdAt: now,
        updatedAt: now,
      };
    });
    if (rows.length) await tx.insert(documentFields).values(rows);
    await tx
      .update(documents)
      .set({ currentVersion: version, updatedAt: now, ...numberColumns(number) })
      .where(eq(documents.id, documentId));
  });
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'document.edited', subjectKind: 'document', subjectId: documentId, details: { version } }, now);
  return version;
}

/** M17-AC-5.2 · Files first, then rows (F06-FR-03); the audit event carries ids and counts only. */
export async function deleteDocument(s: Services, userId: string, documentId: string): Promise<void> {
  const { doc } = await ownedDocument(s.db, userId, documentId);
  const files = await s.db.select({ storageKey: uploads.storageKey, purgedAt: uploads.purgedAt }).from(uploads).where(eq(uploads.documentId, documentId));
  for (const f of files) if (!f.purgedAt) await s.store.delete(f.storageKey);
  await s.db.delete(documents).where(eq(documents.id, documentId));
  const now = nowOf(s);
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'document.deleted', subjectKind: 'document', subjectId: documentId, details: { kind: doc.kind, uploads: files.length } }, now);
}

// ---------------------------------------------------------------- reading

export interface FieldView {
  field: string;
  original: StoredValue;
  confirmed: StoredValue | null;
  source: 'manual' | 'ocr';
  confidence: number | null;
}

export interface DocumentView {
  id: string;
  kind: DocumentKind;
  status: DocumentRow['status'];
  source: DocumentRow['source'];
  version: number;
  /** M15-AC-2.1 · masked; Aadhaar shows only the last four digits (C-03). */
  numberMasked: string | null;
  createdAt: Date;
  verifiedAt: Date | null;
  fields: FieldView[];
  uploads: { id: string; mime: string; sizeBytes: number; purgeAfter: Date | null }[];
  detectedKind: DocumentKind | null;
}

function maskedNumber(s: Services, kb: KnowledgeBase, doc: DocumentRow): string | null {
  if (!doc.numberLast4) return null;
  const entry = kb.catalogue.find((c) => c.kind === doc.kind);
  if (entry?.numberStorage === 'last4_only') return maskAadhaar(doc.numberLast4);
  if (!doc.numberEncrypted) return maskNumber(`0000${doc.numberLast4}`);
  return maskNumber(decryptValue(doc.numberEncrypted, s.keyring));
}

async function views(s: Services, docs: DocumentRow[]): Promise<DocumentView[]> {
  if (docs.length === 0) return [];
  const { kb } = await s.knowledge();
  const ids = docs.map((d) => d.id);
  const [fields, files, extractions] = await Promise.all([
    s.db.select().from(documentFields).where(inArray(documentFields.documentId, ids)).orderBy(asc(documentFields.createdAt)),
    s.db.select().from(uploads).where(and(inArray(uploads.documentId, ids), isNull(uploads.purgedAt))),
    s.db.select({ documentId: ocrExtractions.documentId, detectedKind: ocrExtractions.detectedKind, createdAt: ocrExtractions.createdAt }).from(ocrExtractions).where(inArray(ocrExtractions.documentId, ids)),
  ]);
  const order = (f: FieldRow) => {
    const printed = kb.catalogue.find((c) => c.kind === docs.find((d) => d.id === f.documentId)?.kind)?.fields.map((p) => p.field as string) ?? [];
    const i = f.field === 'relative_type' ? printed.indexOf('relative_name') : printed.indexOf(f.field);
    return i < 0 ? 99 : i;
  };
  return docs.map((doc) => {
    const latest = extractions.filter((e) => e.documentId === doc.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
    return {
      id: doc.id,
      kind: doc.kind as DocumentKind,
      status: doc.status,
      source: doc.source,
      version: doc.currentVersion,
      numberMasked: maskedNumber(s, kb, doc),
      createdAt: doc.createdAt,
      verifiedAt: doc.verifiedAt,
      fields: fields
        .filter((f) => f.documentId === doc.id && f.version === doc.currentVersion)
        .sort((a, b) => order(a) - order(b))
        .map((f) => ({ field: f.field, original: f.original as StoredValue, confirmed: (f.confirmed as StoredValue | null) ?? null, source: f.source, confidence: f.confidence })),
      uploads: files.filter((u) => u.documentId === doc.id).map((u) => ({ id: u.id, mime: u.mime, sizeBytes: u.sizeBytes, purgeAfter: u.purgeAfter })),
      detectedKind: (latest?.detectedKind as DocumentKind | null) ?? null,
    };
  });
}

export async function listDocuments(s: Services, userId: string): Promise<DocumentView[]> {
  const profile = await requireProfile(s.db, userId);
  const { kb } = await s.knowledge();
  const docs = await s.db.select().from(documents).where(eq(documents.profileId, profile.id)).orderBy(asc(documents.createdAt));
  const rank = (k: string) => kb.catalogue.findIndex((c) => c.kind === k);
  return views(s, docs.sort((a, b) => rank(a.kind) - rank(b.kind) || a.createdAt.getTime() - b.createdAt.getTime()));
}

export type DocumentDetail = DocumentView & { versions: { version: number; reason: string; createdAt: Date }[] };

export async function getDocument(s: Services, userId: string, documentId: string): Promise<DocumentDetail | null> {
  try {
    const { doc } = await ownedDocument(s.db, userId, documentId);
    const [view] = await views(s, [doc]);
    const versions = await s.db
      .select({ version: documentVersions.version, reason: documentVersions.reason, createdAt: documentVersions.createdAt })
      .from(documentVersions)
      .where(eq(documentVersions.documentId, documentId))
      .orderBy(desc(documentVersions.version));
    return { ...view!, versions };
  } catch (error) {
    if (error instanceof ServiceError && error.code === 'not_found') return null;
    throw error;
  }
}

/** F07-AC-2.1 · The owner gets the file (audited); anyone else gets nothing and an `access.denied` event. */
export async function openUpload(s: Services, userId: string | null, uploadId: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const now = nowOf(s);
  const [row] =
    userId && UUID.test(uploadId)
      ? await s.db
          .select({ upload: uploads })
          .from(uploads)
          .innerJoin(documents, eq(uploads.documentId, documents.id))
          .innerJoin(citizenProfiles, eq(documents.profileId, citizenProfiles.id))
          .where(and(eq(uploads.id, uploadId), eq(citizenProfiles.userId, userId), isNull(uploads.purgedAt)))
          .limit(1)
      : [];
  const bytes = row ? await s.store.get(row.upload.storageKey) : null;
  if (!row || !bytes) {
    await writeAudit(
      s.db,
      { actorKind: userId ? 'citizen' : 'anonymous', actorId: userId, action: 'access.denied', subjectKind: 'upload', subjectId: UUID.test(uploadId) ? uploadId : null },
      now,
    );
    return null;
  }
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'document.file_viewed', subjectKind: 'document', subjectId: row.upload.documentId, details: { uploadId } }, now);
  return { bytes, mime: row.upload.mime };
}
