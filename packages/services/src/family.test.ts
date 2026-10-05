import { randomInt } from 'node:crypto';
import { seedKnowledgeBase } from '@identity/content';
import { EncryptedStore, loadKnowledgeBase, MemoryRawStore, seedKnowledgeBaseIfEmpty, tables as t, type Database } from '@identity/db';
import { freshDatabase, testKeyring } from '@identity/db/testing';
import { createContext, type DocumentInput } from '@identity/engine';
import type { OcrProvider } from '@identity/ocr';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import {
  addFamilyMember,
  addTypedDocument,
  closeAccount,
  confirmTarget,
  getMyCase,
  grantConsent,
  listDocuments,
  listFamily,
  listMyCases,
  MAX_FAMILY,
  relationshipDifferences,
  relationshipNotes,
  removeFamilyMember,
  requestHelp,
  requireProfile,
  runFullCheck,
  ServiceError,
  uploadDocument,
  withdrawFullCheck,
  type Services,
} from './index';

let database: Database;
let s: Services;
let raw: MemoryRawStore;

beforeAll(async () => {
  database = await freshDatabase();
  await seedKnowledgeBaseIfEmpty(database.db, seedKnowledgeBase);
  const keyring = testKeyring();
  raw = new MemoryRawStore();
  const none: OcrProvider = {
    name: 'fake',
    recognise: async (bytes) => {
      const text = Buffer.from(bytes.subarray(8)).toString('utf8');
      return { text, words: text.split(/\s+/).filter(Boolean).map((w) => ({ text: w, confidence: 0.9 })), meanConfidence: 0.9, provider: 'fake', engineVersion: '1' };
    },
  };
  s = {
    db: database.db,
    keyring,
    store: new EncryptedStore(raw, keyring),
    ocr: { image: none, pdf: none },
    knowledge: async () => {
      const { kb, version } = await loadKnowledgeBase(database.db);
      return { kb, version, ctx: createContext(kb) };
    },
  };
});
afterAll(async () => {
  await database.close();
});

const code = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    if (e instanceof ServiceError) return e.code;
    throw e;
  }
};

async function holder() {
  const [user] = await s.db.insert(t.users).values({ mobile: `+917${String(randomInt(1e9)).padStart(9, '0')}` }).returning();
  const userId = user!.id;
  await grantConsent(s, userId, 'full_check', 'en');
  await grantConsent(s, userId, 'uploads', 'en');
  await grantConsent(s, userId, 'assistance', 'en');
  return userId;
}

/** Test OCR: a PNG signature followed by the text the "image" shows. */
const PNG = new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.from('INCOME TAX DEPARTMENT\nPermanent Account Number Card\nName\nFATHIMA BI\n', 'utf8')]));

describe('M07 family profiles', () => {
  it('@M07-AC-1.1 a member needs a name, a relationship and the declaration; at most eight; the declaration is recorded and audited', async () => {
    const userId = await holder();
    expect(await code(addFamilyMember(s, userId, { name: 'Ayesha', relationship: 'child', parentRole: 'father', declared: false }))).toBe('declaration_required');
    expect(await code(addFamilyMember(s, userId, { name: 'Ayesha', relationship: 'child', declared: true }))).toBe('invalid_value');
    expect(await code(addFamilyMember(s, userId, { name: ' ', relationship: 'mother', declared: true }))).toBe('invalid_value');
    expect(await code(addFamilyMember(s, userId, { name: 'Rafiq', relationship: 'cousin', declared: true }))).toBe('invalid_value');
    const child = await addFamilyMember(s, userId, { name: 'Ayesha Ibrahim', relationship: 'child', parentRole: 'father', declared: true });
    const mother = await addFamilyMember(s, userId, { name: 'Fatima Begum', relationship: 'mother', declared: true });
    const family = await listFamily(s, userId);
    expect(family.map((m) => [m.id, m.relationship, m.parentRole, m.consentBasis])).toEqual([
      [child, 'child', 'father', 'guardian'],
      [mother, 'mother', null, 'their_permission'],
    ]);
    expect(family.every((m) => m.declaredAt instanceof Date)).toBe(true);
    const [event] = await s.db.select().from(t.auditLogs).where(and(eq(t.auditLogs.subjectId, child), eq(t.auditLogs.action, 'family.member_added')));
    expect(event!.details).toEqual({ relationship: 'child', consentBasis: 'guardian' });
    for (let i = family.length; i < MAX_FAMILY; i++) await addFamilyMember(s, userId, { name: `Member ${i}`, relationship: 'other', declared: true });
    expect(await code(addFamilyMember(s, userId, { name: 'One too many', relationship: 'other', declared: true }))).toBe('family_full');
    const stranger = await holder();
    expect(await code(addFamilyMember(s, (await s.db.insert(t.users).values({ mobile: '+917111111111' }).returning())[0]!.id, { name: 'X', relationship: 'other', declared: true }))).toBe('consent_required');
    expect(await code(requireProfile(s.db, stranger, child))).toBe('not_found');
  });

  it('@M07-AC-1.2 each person has their own documents and report; another account cannot reach them', async () => {
    const userId = await holder();
    const member = await addFamilyMember(s, userId, { name: 'Fatima Begum', relationship: 'mother', declared: true });
    await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Mohammed Ibrahim' } });
    await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Fatima Begum' }, profileId: member });
    await addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Fathima Bi' }, profileId: member });
    expect((await listDocuments(s, userId)).map((d) => d.kind)).toEqual(['aadhaar']);
    expect((await listDocuments(s, userId, member)).map((d) => d.kind).sort()).toEqual(['aadhaar', 'pan']);
    expect((await runFullCheck(s, userId)).analysis.issueCount).toBe(0);
    expect((await runFullCheck(s, userId, member)).analysis.issueCount).toBeGreaterThan(0);
    const other = await holder();
    expect(await code(listDocuments(s, other, member))).toBe('not_found');
    expect(await code(addTypedDocument(s, other, { kind: 'pan', values: { name: 'X' }, profileId: member }))).toBe('not_found');
    expect(await code(runFullCheck(s, other, member))).toBe('not_found');
  });

  it('@M07-AC-1.3 help for a member is a case for their document, with their name as applicant', async () => {
    const userId = await holder();
    const member = await addFamilyMember(s, userId, { name: 'Fatima Begum', relationship: 'mother', declared: true });
    await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Fatima Begum' }, profileId: member });
    await addTypedDocument(s, userId, { kind: 'sslc', values: { name: 'Fatima Begum' }, profileId: member });
    const pan = await addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Fathima Bi' }, profileId: member });
    await confirmTarget(s, { kind: 'citizen', id: userId }, member, 'name', 'Fatima Begum');
    const { caseId } = await requestHelp(s, userId, { documentId: pan, helpMode: 'desk' });
    const [row] = await s.db.select().from(t.cases).where(eq(t.cases.id, caseId));
    expect(row).toMatchObject({ profileId: member, applicantName: 'Fatima Begum', userId });
    expect((await getMyCase(s, userId, caseId))!.person).toEqual({ relationship: 'mother', name: 'Fatima Begum' });
    expect((await listMyCases(s, userId)).map((c) => c.person.relationship)).toEqual(['mother']);
  });

  it('@M07-AC-2.1 relationship names are compared as information, using the engine comparison', async () => {
    const ex = loadExample<{ holder: { name: string }; cases: { document: string; field: 'father_name'; value: string; noted: boolean }[] }>('M07', 'M07-EX-relationship');
    const { ctx } = await s.knowledge();
    for (const c of ex.cases) {
      const docs: DocumentInput[] = [{ id: 'd', kind: c.document as never, fields: { [c.field]: c.value } as never }];
      expect(relationshipDifferences(docs, c.field, ex.holder.name, ctx).length > 0, c.value).toBe(c.noted);
    }
    const userId = await holder();
    await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: ex.holder.name } });
    await confirmTarget(s, { kind: 'citizen', id: userId }, (await requireProfile(s.db, userId)).id, 'name', ex.holder.name);
    const child = await addFamilyMember(s, userId, { name: 'Ayesha Ibrahim', relationship: 'child', parentRole: 'father', declared: true });
    await addTypedDocument(s, userId, { kind: 'sslc', values: { name: 'Ayesha Ibrahim', father_name: 'MOHAMMED IBRAHIM' }, profileId: child });
    const pan = await addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Ayesha Ibrahim', father_name: 'Ibrahim Khan' }, profileId: child });
    const notes = await relationshipNotes(s, userId, child);
    expect(notes.map((n) => [n.on, n.document, n.field, n.printed, n.expected])).toEqual([['member', pan, 'father_name', 'Ibrahim Khan', ex.holder.name]]);
  });

  it('@M07-AC-3.1 removing a member deletes their profile, documents, files and cases — files first', async () => {
    const userId = await holder();
    const member = await addFamilyMember(s, userId, { name: 'Fatima Begum', relationship: 'mother', declared: true });
    await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Fatima Begum' }, profileId: member });
    await uploadDocument(s, userId, { kind: 'pan', bytes: PNG, profileId: member });
    const keys = (await s.db.select({ key: t.uploads.storageKey }).from(t.uploads).innerJoin(t.documents, eq(t.uploads.documentId, t.documents.id)).where(eq(t.documents.profileId, member))).map((r) => r.key);
    expect(keys.length).toBe(1);
    const own = await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Mohammed Ibrahim' } });
    const counts = await removeFamilyMember(s, userId, member);
    expect(counts.documents).toBeGreaterThanOrEqual(1);
    for (const key of keys) expect(await raw.get(key)).toBeNull();
    expect(await s.db.select().from(t.citizenProfiles).where(eq(t.citizenProfiles.id, member))).toEqual([]);
    expect((await listDocuments(s, userId)).map((d) => d.id)).toEqual([own]);
    const [event] = await s.db.select().from(t.auditLogs).where(and(eq(t.auditLogs.subjectId, member), eq(t.auditLogs.action, 'family.member_removed')));
    expect(event!.details).toMatchObject({ relationship: 'mother', documents: counts.documents });
    expect(await code(removeFamilyMember(s, userId, (await requireProfile(s.db, userId)).id))).toBe('not_found');
  });

  it('@M07-AC-3.2 withdrawing the Full Check or closing the account deletes every family member too', async () => {
    const a = await holder();
    const am = await addFamilyMember(s, a, { name: 'Fatima Begum', relationship: 'mother', declared: true });
    await addTypedDocument(s, a, { kind: 'aadhaar', values: { name: 'Fatima Begum' }, profileId: am });
    expect((await withdrawFullCheck(s, a)).documents).toBe(1);
    expect(await s.db.select().from(t.citizenProfiles).where(eq(t.citizenProfiles.userId, a))).toEqual([]);

    const b = await holder();
    const bm = await addFamilyMember(s, b, { name: 'Ayesha', relationship: 'child', parentRole: 'mother', declared: true });
    await addTypedDocument(s, b, { kind: 'sslc', values: { name: 'Ayesha' }, profileId: bm });
    expect((await closeAccount(s, b)).documents).toBe(1);
    expect(await s.db.select().from(t.citizenProfiles).where(eq(t.citizenProfiles.id, bm))).toEqual([]);
  });
});
