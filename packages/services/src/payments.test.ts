import { randomInt } from 'node:crypto';
import { seedKnowledgeBase } from '@identity/content';
import { createStaff, EncryptedStore, loadKnowledgeBase, MemoryRawStore, seedKnowledgeBaseIfEmpty, tables as t, type Database } from '@identity/db';
import { freshDatabase, testKeyring } from '@identity/db/testing';
import { createContext } from '@identity/engine';
import type { OcrProvider } from '@identity/ocr';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import {
  acceptCaseFee,
  addTypedDocument,
  confirmTarget,
  getMyCase,
  grantConsent,
  myReceipt,
  publishVersion,
  recordPayment,
  refundFee,
  requestHelp,
  requireProfile,
  revenue,
  saveDraft,
  ServiceError,
  setCaseFee,
  summariseLedger,
  waiveFee,
  type PaymentMethod,
  type Services,
  type StaffActor,
} from './index';

let database: Database;
let s: Services;

beforeAll(async () => {
  database = await freshDatabase();
  await seedKnowledgeBaseIfEmpty(database.db, seedKnowledgeBase);
  const keyring = testKeyring();
  const none: OcrProvider = { name: 'none', recognise: async () => ({ text: '', words: [], meanConfidence: 0, provider: 'none', engineVersion: '0' }) };
  s = {
    db: database.db,
    keyring,
    store: new EncryptedStore(new MemoryRawStore(), keyring),
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

async function staff(...roles: string[]): Promise<StaffActor> {
  const name = `Staff ${randomInt(1e6)}`;
  const id = await createStaff(s.db, { email: `${randomInt(1e9)}@x.test`, name, password: 'a long enough password', roles: roles as never }, { kind: 'system', id: null });
  return { id, name, roles };
}

/** A citizen with a PAN correction case; `kind` chooses which document the help is for. */
async function caseFor(kind: 'pan' | 'voter_id') {
  const [user] = await s.db.insert(t.users).values({ mobile: `+917${String(randomInt(1e9)).padStart(9, '0')}` }).returning();
  const userId = user!.id;
  await grantConsent(s, userId, 'full_check', 'en');
  await grantConsent(s, userId, 'assistance', 'en');
  await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Mohammed Ibrahim' } });
  await addTypedDocument(s, userId, { kind: 'sslc', values: { name: 'Mohammed Ibrahim' } });
  const doc = await addTypedDocument(s, userId, { kind, values: { name: 'Ibrahim Mujeeb' } });
  await confirmTarget(s, { kind: 'citizen', id: userId }, (await requireProfile(s.db, userId)).id, 'name', 'Mohammed Ibrahim');
  const { caseId } = await requestHelp(s, userId, { documentId: doc, helpMode: 'desk' });
  return { userId, caseId };
}

describe('M19 service fees and payments', () => {
  it('@M19-AC-1.1 a published price is agreed when help is requested; otherwise the fee is not set', async () => {
    const admin = await staff('admin');
    const publisher = await staff('publisher');
    const { version } = await saveDraft(s, admin, {
      kind: 'service_price',
      data: { id: 'assistance-pan', service: 'assistance', document: 'pan', amountInr: 199, meta: { owner: 'Product owner', source: 'Pricing decision', version: 1, status: 'draft' } },
      note: 'Pilot price',
    });
    await publishVersion(s, publisher, 'service_price', 'assistance-pan', version);
    const withPrice = await caseFor('pan');
    expect((await getMyCase(s, withPrice.userId, withPrice.caseId))!.fee).toMatchObject({ status: 'due', amountInr: 199 });
    const withoutPrice = await caseFor('voter_id');
    expect((await getMyCase(s, withoutPrice.userId, withoutPrice.caseId))!.fee).toMatchObject({ status: 'not_set', amountInr: null });
  });

  it('@M19-AC-1.2 a fee set later must be accepted by the citizen before anything is charged', async () => {
    const { userId, caseId } = await caseFor('voter_id');
    const lead = await staff('supervisor');
    const volunteer = await staff('volunteer');
    expect(await code(setCaseFee(s, volunteer, caseId, { amountInr: 99 }))).toBe('forbidden');
    await setCaseFee(s, lead, caseId, { amountInr: 99, note: 'Form 8 help' });
    expect((await getMyCase(s, userId, caseId))!.fee).toMatchObject({ status: 'awaiting_acceptance', amountInr: 99 });
    expect(await code(recordPayment(s, volunteer, caseId, { method: 'cash' }))).toBe('not_allowed');
    await acceptCaseFee(s, userId, caseId);
    expect((await getMyCase(s, userId, caseId))!.fee.status).toBe('due');
  });

  it('@M19-AC-2.1 a desk payment issues a numbered receipt the citizen can open', async () => {
    const { userId, caseId } = await caseFor('voter_id');
    const lead = await staff('supervisor');
    const volunteer = await staff('volunteer');
    await setCaseFee(s, lead, caseId, { amountInr: 149 });
    await acceptCaseFee(s, userId, caseId);
    expect(await code(recordPayment(s, volunteer, caseId, { method: 'cheque' }))).toBe('invalid_value');
    const receipt = await recordPayment(s, volunteer, caseId, { method: 'upi', reference: 'UPI-778899' });
    expect(receipt).toMatch(/^R-\d{5}$/);
    const mine = (await getMyCase(s, userId, caseId))!;
    expect(mine.fee.status).toBe('paid');
    expect(mine.receipts).toEqual([expect.objectContaining({ number: receipt, kind: 'payment', amountInr: 149, method: 'upi', reference: 'UPI-778899' })]);
    expect(await myReceipt(s, userId, caseId, receipt)).toMatchObject({ amountInr: 149 });
    const other = await caseFor('voter_id');
    expect(await myReceipt(s, other.userId, caseId, receipt)).toBeNull();
    expect(await code(recordPayment(s, volunteer, caseId, { method: 'cash' }))).toBe('not_allowed');
  });

  it('@M19-AC-2.2 supervisors waive or refund with a reason; volunteers cannot', async () => {
    const lead = await staff('supervisor');
    const volunteer = await staff('volunteer');
    const a = await caseFor('voter_id');
    expect(await code(waiveFee(s, volunteer, a.caseId, 'Hardship'))).toBe('forbidden');
    expect(await code(waiveFee(s, lead, a.caseId, ' '))).toBe('reason_required');
    await waiveFee(s, lead, a.caseId, 'Hardship');
    expect((await getMyCase(s, a.userId, a.caseId))!.fee.status).toBe('waived');

    const b = await caseFor('voter_id');
    await setCaseFee(s, lead, b.caseId, { amountInr: 99 });
    await acceptCaseFee(s, b.userId, b.caseId);
    await recordPayment(s, volunteer, b.caseId, { method: 'cash' });
    expect(await code(refundFee(s, volunteer, b.caseId, { method: 'cash', reason: 'Duplicate' }))).toBe('forbidden');
    await refundFee(s, lead, b.caseId, { method: 'cash', reason: 'Case withdrawn before work started' });
    const mine = (await getMyCase(s, b.userId, b.caseId))!;
    expect(mine.fee.status).toBe('refunded');
    expect(mine.receipts.map((r) => [r.kind, r.amountInr])).toEqual([
      ['payment', 99],
      ['refund', 99],
    ]);
  });

  it('@M19-AC-3.1 revenue sums the ledger for a period; only supervisors and admins see it', () => {
    const ex = loadExample<{ ledger: { kind: 'payment' | 'refund'; amountInr: number; method: PaymentMethod; at: string }[]; period: { from: string; to: string }; expect: unknown }>('M19', 'M19-EX-revenue');
    expect(summariseLedger(ex.ledger.map((e) => ({ ...e, at: new Date(`${e.at}T12:00:00+05:30`) })), ex.period.from, ex.period.to)).toEqual(ex.expect);
  });

  it('@M19-AC-3.1 the revenue view adds waivers and the amount still due', async () => {
    const lead = await staff('supervisor');
    const r = await revenue(s, lead);
    expect(r.payments).toBeGreaterThanOrEqual(149 + 99);
    expect(r.refunds).toBeGreaterThanOrEqual(99);
    expect(r.waived).toBeGreaterThanOrEqual(1);
    expect(r.outstanding).toBeGreaterThanOrEqual(199);
    expect(await code(revenue(s, await staff('volunteer')))).toBe('forbidden');
    const [{ n }] = (await s.db.select({ n: t.payments.id }).from(t.payments).where(eq(t.payments.kind, 'refund')).limit(1)) as [{ n: string }];
    expect(n).toBeTruthy();
  });
});
