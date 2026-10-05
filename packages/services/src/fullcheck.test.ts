import { randomInt } from 'node:crypto';
import { seedKnowledgeBase } from '@identity/content';
import { EncryptedStore, MemoryRawStore, tables as t, verifyAuditChain, type Database } from '@identity/db';
import { freshDatabase, testKeyring } from '@identity/db/testing';
import { createContext } from '@identity/engine';
import type { OcrProvider, OcrResult } from '@identity/ocr';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import {
  activeConsents,
  addTypedDocument,
  changeKind,
  closeAccount,
  confirmDocument,
  confirmTarget,
  deleteDocument,
  editDocument,
  getDocument,
  grantConsent,
  listDocuments,
  NOTICE_VERSION,
  openUpload,
  requireProfile,
  runFullCheck,
  ServiceError,
  setOverride,
  targetHistory,
  uploadDocument,
  withdrawFullCheck,
  withdrawUploads,
  type Services,
} from './index';

/** Test OCR: the "image" is a PNG signature followed by the text it shows. */
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const image = (text: string) => new Uint8Array(Buffer.concat([PNG, Buffer.from(text, 'utf8')]));
class FakeOcr implements OcrProvider {
  readonly name = 'fake';
  async recognise(bytes: Uint8Array): Promise<OcrResult> {
    const text = Buffer.from(bytes.subarray(8)).toString('utf8');
    const words = text.split(/\s+/).filter(Boolean).map((w) => ({ text: w, confidence: w.startsWith('~') ? 0.5 : 0.9 }));
    return { text: text.replace(/~/g, ''), words: words.map((w) => ({ ...w, text: w.text.replace(/~/g, '') })), meanConfidence: 0.9, provider: 'fake', engineVersion: 'fake 1' };
  }
}

const panText = (name = 'MOHAMMED IBRAHIM') => `INCOME TAX DEPARTMENT GOVT. OF INDIA\nPermanent Account Number Card\nABCPE1234F\nName\n${name}\nFather's Name\nABDUL RAHEEM\nDate of Birth\n12/04/2002\n`;

let database: Database;
let s: Services;
let raw: MemoryRawStore;

beforeAll(async () => {
  database = await freshDatabase();
  raw = new MemoryRawStore();
  const keyring = testKeyring();
  const ctx = createContext(seedKnowledgeBase);
  const ocr = new FakeOcr();
  s = { db: database.db, keyring, store: new EncryptedStore(raw, keyring), ocr: { image: ocr, pdf: ocr }, knowledge: async () => ({ kb: seedKnowledgeBase, version: 'kb-test', ctx }) };
});
afterAll(async () => {
  await database.close();
});

async function citizen(consent: ('full_check' | 'uploads')[] = ['full_check']) {
  const [user] = await s.db.insert(t.users).values({ mobile: `+919${String(randomInt(0, 1e9)).padStart(9, '0')}` }).returning();
  for (const purpose of consent) await grantConsent(s, user!.id, purpose, 'kn');
  return user!.id;
}

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    if (e instanceof ServiceError) return e.code;
    throw e;
  }
};

const auditActions = async (subjectId: string) => (await s.db.select().from(t.auditLogs).where(eq(t.auditLogs.subjectId, subjectId))).map((a) => a.action);

describe('F06 consent', () => {
  it('@F06-AC-1.1 nothing is stored before the Full Check notice is agreed; the consent records version, language and time', async () => {
    const userId = await citizen([]);
    expect(await code(addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Mohammed Ibrahim' } }))).toBe('consent_required');
    expect(await s.db.select().from(t.citizenProfiles).where(eq(t.citizenProfiles.userId, userId))).toHaveLength(0);
    await grantConsent(s, userId, 'full_check', 'ur');
    const [consent] = await s.db.select().from(t.consents).where(eq(t.consents.userId, userId));
    expect(consent).toMatchObject({ purpose: 'full_check', noticeVersion: NOTICE_VERSION, locale: 'ur', withdrawnAt: null });
    expect(consent!.grantedAt).toBeInstanceOf(Date);
    expect(await requireProfile(s.db, userId)).toBeTruthy();
  });

  it('@F06-AC-1.2 @M17-AC-2.1 uploading needs its own consent', async () => {
    const userId = await citizen(['full_check']);
    const before = raw.objects.size;
    expect(await code(uploadDocument(s, userId, { kind: 'pan', bytes: image(panText()) }))).toBe('uploads_consent_required');
    expect(raw.objects.size).toBe(before);
    await grantConsent(s, userId, 'uploads', 'en');
    expect(await code(uploadDocument(s, userId, { kind: 'pan', bytes: image(panText()) }))).toBe('ok');
  });
});

describe('M17 documents', () => {
  it('@M17-AC-1.1 typed forms accept only the fields the document prints, and only the last four Aadhaar digits', async () => {
    const userId = await citizen();
    expect(await code(addTypedDocument(s, userId, { kind: 'aadhaar', values: { father_name: 'Abdul Raheem' } }))).toBe('invalid_field');
    expect(await code(addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Mohammed Ibrahim' }, number: '2341 2341 2346' }))).toBe('aadhaar_full_number');
    expect(await code(addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Mohammed 234123412346' } }))).toBe('aadhaar_full_number');
    expect(await code(addTypedDocument(s, userId, { kind: 'voter_id', values: { relative_name: 'Abdul Raheem' } }))).toBe('relative_type_required');
    expect(await code(addTypedDocument(s, userId, { kind: 'pan', values: { name: 'X' }, number: 'ABC123' }))).toBe('invalid_number');
    expect(await code(addTypedDocument(s, userId, { kind: 'pan', values: { dob: '31/02/2002' } }))).toBe('invalid_date');
    const id = await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Mohammed Ibrahim' }, number: 'XXXX XXXX 2346' });
    const [doc] = await s.db.select().from(t.documents).where(eq(t.documents.id, id));
    expect(doc).toMatchObject({ numberEncrypted: null, numberLast4: '2346' });
  });

  it('@M17-AC-1.2 typed values are original and confirmed, the number is encrypted, and the document counts at once', async () => {
    const userId = await citizen();
    const id = await addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Mohammed Ibrahim', dob: '12/04/2002' }, number: 'abcpe1234f' });
    const [doc] = await s.db.select().from(t.documents).where(eq(t.documents.id, id));
    expect(doc!.status).toBe('verified');
    expect(doc!.numberEncrypted).toMatch(/^v1\./);
    expect(doc!.numberEncrypted).not.toContain('ABCPE1234F');
    const fields = await s.db.select().from(t.documentFields).where(eq(t.documentFields.documentId, id));
    expect(fields.map((f) => [f.field, f.original, f.confirmed, f.normalised])).toEqual(
      expect.arrayContaining([
        ['name', 'Mohammed Ibrahim', 'Mohammed Ibrahim', 'mohammed ibrahim'],
        ['dob', '12/04/2002', '12/04/2002', '2002-04-12'],
      ]),
    );
    const [view] = await listDocuments(s, userId);
    expect(view!.numberMasked).toBe('••••••234F');
    const check = await runFullCheck(s, userId);
    expect(check.analysis.documents.map((d) => d.id)).toEqual([id]);
  });

  it('@M17-AC-2.2 @F07-AC-3.1 uploads are stored encrypted and apart from the extracted data; other files are refused', async () => {
    const userId = await citizen(['full_check', 'uploads']);
    const bytes = image(panText());
    const before = raw.objects.size;
    const { documentId } = await uploadDocument(s, userId, { kind: 'pan', bytes });
    expect(raw.objects.size).toBe(before + 1);
    const [upload] = await s.db.select().from(t.uploads).where(eq(t.uploads.documentId, documentId));
    const stored = raw.objects.get(upload!.storageKey)!;
    expect(stored.includes(Buffer.from('MOHAMMED'))).toBe(false);
    expect(Buffer.compare((await s.store.get(upload!.storageKey))!, Buffer.from(bytes))).toBe(0);
    const [extraction] = await s.db.select().from(t.ocrExtractions).where(eq(t.ocrExtractions.documentId, documentId));
    expect(extraction!.rawText).toMatch(/^v1\./);
    expect(JSON.stringify(extraction!.fields)).not.toContain('ABCPE1234F');
    expect(await code(uploadDocument(s, userId, { kind: 'pan', bytes: new Uint8Array(Buffer.from('GIF89a....')) }))).toBe('bad_type');
    expect(await code(uploadDocument(s, userId, { kind: 'pan', bytes: new Uint8Array(10 * 1024 * 1024 + 1) }))).toBe('too_large');
  });

  it('@M17-AC-2.3 an upload showing a full Aadhaar number is discarded unstored, and audited', async () => {
    const userId = await citizen(['full_check', 'uploads']);
    const before = raw.objects.size;
    const text = 'Government of India\nUnique Identification Authority of India\nMohammed Ibrahim\nDOB: 12/04/2002\nMale\n2341 2341 2346\n';
    expect(await code(uploadDocument(s, userId, { kind: 'aadhaar', bytes: image(text) }))).toBe('rejected_aadhaar');
    expect(raw.objects.size).toBe(before);
    expect(await listDocuments(s, userId)).toEqual([]);
    const events = await s.db.select().from(t.auditLogs).where(and(eq(t.auditLogs.actorId, userId), eq(t.auditLogs.action, 'document.upload_rejected_aadhaar')));
    expect(events).toHaveLength(1);
    expect(JSON.stringify(events[0]!.details)).not.toMatch(/2341|Ibrahim/);
  });

  it('@M17-AC-3.1 @M17-AC-3.3 extracted fields carry confidences, and are not compared until confirmed', async () => {
    const userId = await citizen(['full_check', 'uploads']);
    const { documentId } = await uploadDocument(s, userId, { kind: 'pan', bytes: image(panText('~MOHAMMED ~IBRAHIM')) });
    const doc = await getDocument(s, userId, documentId);
    expect(doc!.status).toBe('needs_verification');
    expect(doc!.numberMasked).toBe('••••••234F');
    const name = doc!.fields.find((f) => f.field === 'name')!;
    expect(name).toMatchObject({ original: 'MOHAMMED IBRAHIM', confirmed: null, source: 'ocr' });
    expect(name.confidence).toBeLessThan(0.8);
    expect(doc!.fields.find((f) => f.field === 'father_name')!.confidence).toBeGreaterThanOrEqual(0.8);
    const check = await runFullCheck(s, userId);
    expect(check.analysis.documents).toEqual([]);
    expect(check.pending).toBe(1);
  });

  it('@M17-AC-3.4 @M17-FR-07 a changed value is confirmed beside the unchanged original; the file is kept 30 days', async () => {
    const userId = await citizen(['full_check', 'uploads']);
    const { documentId } = await uploadDocument(s, userId, { kind: 'pan', bytes: image(panText('MOHAMMED LBRAHIM')) });
    const fixed = new Date('2026-10-05T10:00:00Z');
    await confirmDocument({ ...s, now: () => fixed }, userId, documentId, { values: { name: 'MOHAMMED IBRAHIM', father_name: 'ABDUL RAHEEM', dob: '12/04/2002' } });
    const doc = await getDocument(s, userId, documentId);
    expect(doc!.status).toBe('verified');
    expect(doc!.fields.find((f) => f.field === 'name')).toMatchObject({ original: 'MOHAMMED LBRAHIM', confirmed: 'MOHAMMED IBRAHIM' });
    expect(doc!.uploads[0]!.purgeAfter!.toISOString()).toBe('2026-11-04T10:00:00.000Z');
    expect(await code(confirmDocument(s, userId, documentId, { values: {} }))).toBe('already_verified');
    expect(await auditActions(documentId)).toEqual(expect.arrayContaining(['document.uploaded', 'document.extracted', 'document.verified']));
  });

  it('@M17-AC-3.5 a document that looks like another type says so, and can be switched', async () => {
    const userId = await citizen(['full_check', 'uploads']);
    const outcome = await uploadDocument(s, userId, { kind: 'aadhaar', bytes: image(panText()) });
    expect(outcome).toMatchObject({ detectedKind: 'pan', kindMismatch: true });
    await changeKind(s, userId, outcome.documentId, 'pan');
    const doc = await getDocument(s, userId, outcome.documentId);
    expect(doc!.kind).toBe('pan');
    expect(doc!.fields.map((f) => f.field).sort()).toEqual(['dob', 'father_name', 'name']);
    expect(doc!.numberMasked).toBe('••••••234F');
  });

  it('@M17-AC-4.1 a scanned PDF without text is not kept', async () => {
    const userId = await citizen(['full_check', 'uploads']);
    const empty: OcrProvider = { name: 'pdf-text', recognise: async () => ({ text: '', words: [], meanConfidence: 0, provider: 'pdf-text', engineVersion: 'x' }) };
    const before = raw.objects.size;
    expect(await code(uploadDocument({ ...s, ocr: { image: s.ocr.image, pdf: empty } }, userId, { kind: 'pan', bytes: new Uint8Array(Buffer.from('%PDF-1.7\n...')) }))).toBe('no_text');
    expect(raw.objects.size).toBe(before);
  });

  it('@M17-AC-5.1 editing a verified document creates a new version and keeps the earlier one', async () => {
    const userId = await citizen();
    const id = await addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Ibrahim Mujeeb', dob: '12/04/2002' } });
    expect(await editDocument(s, userId, id, { values: { name: 'Mohammed Ibrahim', dob: '12/04/2002' } })).toBe(2);
    const rows = await s.db.select().from(t.documentFields).where(eq(t.documentFields.documentId, id));
    expect(rows.filter((r) => r.version === 1).map((r) => r.confirmed)).toEqual(expect.arrayContaining(['Ibrahim Mujeeb']));
    expect(rows.filter((r) => r.version === 2).map((r) => r.confirmed)).toEqual(expect.arrayContaining(['Mohammed Ibrahim']));
    const doc = await getDocument(s, userId, id);
    expect(doc!.versions.map((v) => v.version)).toEqual([2, 1]);
    expect(doc!.fields.find((f) => f.field === 'name')!.confirmed).toBe('Mohammed Ibrahim');
  });

  it('@M17-AC-5.2 deleting a document removes its rows and files and audits ids only', async () => {
    const userId = await citizen(['full_check', 'uploads']);
    const { documentId } = await uploadDocument(s, userId, { kind: 'pan', bytes: image(panText()) });
    const [upload] = await s.db.select().from(t.uploads).where(eq(t.uploads.documentId, documentId));
    await deleteDocument(s, userId, documentId);
    expect(raw.objects.has(upload!.storageKey)).toBe(false);
    for (const table of [t.documentFields, t.documentVersions, t.uploads, t.ocrExtractions]) {
      expect(await s.db.select().from(table).where(eq(table.documentId, documentId))).toHaveLength(0);
    }
    const [event] = await s.db.select().from(t.auditLogs).where(and(eq(t.auditLogs.subjectId, documentId), eq(t.auditLogs.action, 'document.deleted')));
    expect(event!.details).toEqual({ kind: 'pan', uploads: 1 });
  });

  it('@M17-AC-5.3 @F07-AC-2.1 only the owner can open a file; others get nothing and an access.denied event', async () => {
    const owner = await citizen(['full_check', 'uploads']);
    const other = await citizen();
    const { documentId } = await uploadDocument(s, owner, { kind: 'pan', bytes: image(panText()) });
    const [upload] = await s.db.select().from(t.uploads).where(eq(t.uploads.documentId, documentId));
    const file = await openUpload(s, owner, upload!.id);
    expect(file!.mime).toBe('image/png');
    expect(await openUpload(s, other, upload!.id)).toBeNull();
    expect(await openUpload(s, null, upload!.id)).toBeNull();
    expect(await openUpload(s, other, 'not-a-uuid')).toBeNull();
    const events = (await s.db.select().from(t.auditLogs).where(eq(t.auditLogs.subjectId, upload!.id)).orderBy(t.auditLogs.id)).map((e) => [e.action, e.actorKind]);
    expect(events).toEqual([
      ['access.denied', 'citizen'],
      ['access.denied', 'anonymous'],
    ]);
    expect(await auditActions(documentId)).toContain('document.file_viewed');
    expect(await getDocument(s, other, documentId)).toBeNull();
    expect(await code(deleteDocument(s, other, documentId))).toBe('not_found');
  });
});

describe('M16 profile, targets and overrides', () => {
  async function prdScenario() {
    const userId = await citizen();
    const ids = {
      birth: await addTypedDocument(s, userId, { kind: 'birth_certificate', values: { name: 'Mohamad Ibrahim' } }),
      sslc: await addTypedDocument(s, userId, { kind: 'sslc', values: { name: 'Mohammed Ibrahim' } }),
      aadhaar: await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'MOHAMMED IBRAHIM' } }),
      pan: await addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Ibrahim Mujeeb' } }),
    };
    return { userId, ids, profile: await requireProfile(s.db, userId) };
  }

  it('@M16-AC-2.1 @M16-AC-3.1 stored documents give the PRD §17 suggestion, and an unconfirmed target comes first in the roadmap', async () => {
    const example = loadExample<{ cases: { name: string; expect: { value: string; reason: string } }[] }>('M16', 'M16-EX-suggestions').cases[0]!;
    const { userId, ids } = await prdScenario();
    const check = await runFullCheck(s, userId);
    const name = check.analysis.fields.find((f) => f.field === 'name')!;
    expect(name.target).toMatchObject({ status: 'suggested', display: example.expect.value });
    expect(name.suggestion!.supportedBy).toEqual([ids.sslc, ids.aadhaar]);
    expect(check.roadmap.steps[0]).toEqual({ kind: 'confirm_targets', fields: ['name'] });
  });

  it('@M16-AC-1.1 @M16-AC-3.3 confirming and changing a target never touches documents, and keeps old and new values', async () => {
    const { userId, ids, profile } = await prdScenario();
    const before = await s.db.select().from(t.documentFields);
    await confirmTarget(s, { kind: 'citizen', id: userId }, profile.id, 'name', 'Mohamad Ibrahim');
    await confirmTarget(s, { kind: 'citizen', id: userId }, profile.id, 'name', 'Mohammed Ibrahim');
    expect(await s.db.select().from(t.documentFields)).toEqual(before);
    const history = await targetHistory(s.db, profile.id);
    expect(history.map((h) => [h.oldValue, h.newValue, h.actorKind])).toEqual([
      ['Mohamad Ibrahim', 'Mohammed Ibrahim', 'citizen'],
      [null, 'Mohamad Ibrahim', 'citizen'],
    ]);
    const events = await s.db.select().from(t.auditLogs).where(eq(t.auditLogs.subjectId, profile.id));
    expect(events.map((e) => e.action)).toEqual(['target.confirmed', 'target.changed']);
    expect(JSON.stringify(events.map((e) => e.details))).not.toMatch(/Ibrahim/);
    const check = await runFullCheck(s, userId);
    expect(check.analysis.fields.find((f) => f.field === 'name')!.target).toMatchObject({ status: 'confirmed', display: 'Mohammed Ibrahim' });
    expect(check.roadmap.steps[0]!.kind).not.toBe('confirm_targets');
    // PRD §17: the birth certificate and PAN need correcting to the chosen name.
    expect(check.analysis.issues.map((i) => i.document).sort()).toEqual([ids.birth, ids.pan].sort());
  });

  it('@M16-AC-3.2 a confirmed target stays when the documents now suggest another value', async () => {
    const example = loadExample<{ confirmed: { value: string }; expect: { suggestion: string } }>('M16', 'M16-EX-stability');
    const userId = await citizen();
    const profile = await requireProfile(s.db, userId);
    await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Fatima Shaikh' } });
    await confirmTarget(s, { kind: 'citizen', id: userId }, profile.id, 'name', example.confirmed.value);
    await addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Fatima Ansari' } });
    await addTypedDocument(s, userId, { kind: 'voter_id', values: { name: 'Fatima Ansari' } });
    const name = (await runFullCheck(s, userId)).analysis.fields.find((f) => f.field === 'name')!;
    expect(name.target).toMatchObject({ value: example.confirmed.value, status: 'confirmed' });
    expect(name.suggestionDiffers).toBe(true);
    expect(name.suggestion!.display).toBe(example.expect.suggestion);
  });

  it('@M16-AC-4.1 @M16-AC-4.2 an override needs a reason, is audited, and shows in the report; staff must give a reason', async () => {
    const { userId, ids, profile } = await prdScenario();
    const citizenActor = { kind: 'citizen' as const, id: userId };
    expect(await code(setOverride(s, citizenActor, profile.id, { documentId: ids.pan, field: 'name', decision: 'accepted_equivalent', reason: '  ' }))).toBe('reason_required');
    await setOverride(s, citizenActor, profile.id, { documentId: ids.pan, field: 'name', decision: 'accepted_equivalent', reason: 'Mujeeb is my family name' });
    const result = (await runFullCheck(s, userId)).analysis.fields.find((f) => f.field === 'name')!.results.find((r) => r.document === ids.pan)!;
    expect(result).toMatchObject({ overridden: true, status: 'likely_equivalent', reason: 'accepted_by_override' });
    expect(await auditActions(ids.pan)).toContain('comparison.overridden');
    const staff = { kind: 'staff' as const, id: userId };
    expect(await code(confirmTarget(s, staff, profile.id, 'name', 'Mohammed Ibrahim'))).toBe('reason_required');
    expect(await code(confirmTarget(s, staff, profile.id, 'name', 'Mohammed Ibrahim', 'Citizen asked at the help desk'))).toBe('ok');
  });

  it('@M16-AC-5.1 after a correction, the re-run shows which issues are resolved', async () => {
    const { userId, ids, profile } = await prdScenario();
    await confirmTarget(s, { kind: 'citizen', id: userId }, profile.id, 'name', 'Mohammed Ibrahim');
    const first = await runFullCheck(s, userId);
    expect(first.analysis.issues.map((i) => i.document).sort()).toEqual([ids.birth, ids.pan].sort());
    await editDocument(s, userId, ids.pan, { values: { name: 'Mohammed Ibrahim' } });
    const second = await runFullCheck(s, userId);
    expect(second.analysis.issues.map((i) => i.document)).toEqual([ids.birth]);
    expect(second.resolved).toEqual([expect.objectContaining({ document: ids.pan, field: 'name', display: 'Ibrahim Mujeeb' })]);
    // Viewing again without changes keeps the same comparison.
    expect((await runFullCheck(s, userId)).resolved).toHaveLength(1);
  });
});

describe('F06 withdrawal and deletion', () => {
  it('@F06-AC-3.1 withdrawing the Full Check deletes the profile, documents and files, and allows a fresh start', async () => {
    const userId = await citizen(['full_check', 'uploads']);
    const { documentId } = await uploadDocument(s, userId, { kind: 'pan', bytes: image(panText()) });
    const [upload] = await s.db.select().from(t.uploads).where(eq(t.uploads.documentId, documentId));
    await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Mohammed Ibrahim' } });
    expect(await withdrawFullCheck(s, userId)).toEqual({ documents: 2, uploads: 1 });
    expect(raw.objects.has(upload!.storageKey)).toBe(false);
    expect(await s.db.select().from(t.citizenProfiles).where(eq(t.citizenProfiles.userId, userId))).toHaveLength(0);
    expect(await s.db.select().from(t.documents).where(eq(t.documents.id, documentId))).toHaveLength(0);
    expect(await activeConsents(s.db, userId)).toEqual(new Set());
    await grantConsent(s, userId, 'full_check', 'en');
    expect(await listDocuments(s, userId)).toEqual([]);
  });

  it('@F06-AC-3.2 withdrawing uploads deletes files and OCR text; typed and confirmed values stay', async () => {
    const userId = await citizen(['full_check', 'uploads']);
    const confirmed = (await uploadDocument(s, userId, { kind: 'pan', bytes: image(panText()) })).documentId;
    await confirmDocument(s, userId, confirmed, { values: { name: 'MOHAMMED IBRAHIM' } });
    const unconfirmed = (await uploadDocument(s, userId, { kind: 'pan', bytes: image(panText('ANOTHER NAME')) })).documentId;
    const typed = await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Mohammed Ibrahim' } });
    const keys = (await s.db.select().from(t.uploads)).filter((u) => [confirmed, unconfirmed].includes(u.documentId)).map((u) => u.storageKey);
    expect(await withdrawUploads(s, userId)).toEqual({ documents: 1, uploads: 2 });
    expect(keys.every((k) => !raw.objects.has(k))).toBe(true);
    expect(await s.db.select().from(t.ocrExtractions).where(eq(t.ocrExtractions.documentId, confirmed))).toHaveLength(0);
    const left = await listDocuments(s, userId);
    expect(left.map((d) => d.id).sort()).toEqual([confirmed, typed].sort());
    expect(left.find((d) => d.id === confirmed)!.fields.find((f) => f.field === 'name')!.confirmed).toBe('MOHAMMED IBRAHIM');
    expect(await activeConsents(s.db, userId)).toEqual(new Set(['full_check']));
  });

  it('@F06-AC-3.3 closing the account deletes everything; only pseudonymous audit events remain', async () => {
    const userId = await citizen(['full_check', 'uploads']);
    const [user] = await s.db.select().from(t.users).where(eq(t.users.id, userId));
    await s.db.insert(t.sessions).values({ id: `test-${userId}`, kind: 'citizen', userId, expiresAt: new Date(Date.now() + 3_600_000) });
    const { documentId } = await uploadDocument(s, userId, { kind: 'pan', bytes: image(panText()) });
    const [upload] = await s.db.select().from(t.uploads).where(eq(t.uploads.documentId, documentId));
    expect(await closeAccount(s, userId)).toEqual({ documents: 1, uploads: 1 });
    expect(raw.objects.has(upload!.storageKey)).toBe(false);
    expect(await s.db.select().from(t.users).where(eq(t.users.id, userId))).toHaveLength(0);
    expect(await s.db.select().from(t.sessions).where(eq(t.sessions.userId, userId))).toHaveLength(0);
    expect(await s.db.select().from(t.consents).where(eq(t.consents.userId, userId))).toHaveLength(0);
    const events = await s.db.select().from(t.auditLogs).where(eq(t.auditLogs.actorId, userId));
    expect(events.map((e) => e.action)).toContain('account.closed');
    expect(JSON.stringify(events)).not.toContain(user!.mobile);
    expect((await verifyAuditChain(s.db)).ok).toBe(true);
  });
});
