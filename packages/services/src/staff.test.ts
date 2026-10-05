import { randomInt } from 'node:crypto';
import { seedKnowledgeBase } from '@identity/content';
import { createSession, createStaff, EncryptedStore, loadKnowledgeBase, MemoryRawStore, resolveSession, seedKnowledgeBaseIfEmpty, tables as t, type Database } from '@identity/db';
import { freshDatabase, testKeyring } from '@identity/db/testing';
import { analyse, buildRoadmap, createContext } from '@identity/engine';
import type { OcrProvider } from '@identity/ocr';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import {
  addStaff,
  addTypedDocument,
  changeStaffStatus,
  dashboard,
  diffJson,
  getCustomer,
  getKbItem,
  grantConsent,
  listAuditEvents,
  listCustomers,
  listKbItems,
  listStaff,
  needsSecondPerson,
  publishVersion,
  recordVerification,
  rollbackTo,
  runFullCheck,
  saveDraft,
  ServiceError,
  setRoles,
  withdrawItem,
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

async function staff(...roles: string[]): Promise<StaffActor> {
  const name = `Staff ${randomInt(1e6)}`;
  const id = await createStaff(s.db, { email: `${name.replace(' ', '.').toLowerCase()}@example.test`, name, password: 'a long enough password', roles: roles as never }, { kind: 'system', id: null });
  return { id, name, roles };
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

const ruleData = async (id: string) => structuredClone((await s.knowledge()).kb.rules.find((r) => r.id === id)!) as unknown as Record<string, unknown>;

describe('M15 permissions in the staff services', () => {
  it('@M15-AC-1.1 each role can do exactly what the matrix allows; refusals are audited', async () => {
    const volunteer = await staff('volunteer');
    const editor = await staff('content_editor');
    expect(await code(listKbItems(s, volunteer))).toBe('forbidden');
    expect(await code(listAuditEvents(s, volunteer))).toBe('forbidden');
    expect(await code(listCustomers(s, volunteer))).toBe('ok');
    expect(await code(listKbItems(s, editor))).toBe('ok');
    expect(await code(listCustomers(s, editor))).toBe('forbidden');
    const denied = await s.db.select().from(t.auditLogs).where(and(eq(t.auditLogs.actorId, volunteer.id), eq(t.auditLogs.action, 'access.denied')));
    expect(denied.map((d) => (d.details as { permission: string }).permission).sort()).toEqual(['audit.read', 'rules.read']);
  });
});

describe('M13 rules admin', () => {
  it('@M13-AC-1.1 lists every item with its effective version, status, owner and freshness', async () => {
    const items = await listKbItems(s, await staff('content_editor'));
    const rule = items.find((i) => i.kind === 'rule' && i.key === 'pan-name-dob-correction')!;
    expect(rule).toMatchObject({ effective: { version: 1, status: 'in_review' }, latest: { version: 1 }, drafts: 0, lastVerified: null, freshness: 'unverified' });
    expect(rule.owner).toBeTruthy();
    expect(items.find((i) => i.kind === 'catalogue' && i.key === 'pan')).toMatchObject({ label: 'PAN', freshness: null });
    expect(items.filter((i) => i.kind === 'rule')).toHaveLength(seedKnowledgeBase.rules.length);
  });

  it('@M13-AC-2.1 @M13-AC-2.4 a change is a new draft; nothing effective changes; rollback makes another draft', async () => {
    const editor = await staff('content_editor');
    const before = await s.knowledge();
    const data = await ruleData('voter-form-8-correction');
    (data.steps as { en: string }[])[0]!.en = 'Open the voters portal and choose Form 8.';
    const { version } = await saveDraft(s, editor, { kind: 'rule', key: 'voter-form-8-correction', data: JSON.stringify(data), note: 'Clearer first step' });
    expect(version).toBe(2);
    const after = await s.knowledge();
    expect(after.version).toBe(before.version);
    expect(after.kb.rules.find((r) => r.id === 'voter-form-8-correction')!.steps[0]!.en).not.toBe('Open the voters portal and choose Form 8.');
    const item = (await getKbItem(s, editor, 'rule', 'voter-form-8-correction'))!;
    expect(item.versions.map((v) => [v.version, v.status, v.createdBy])).toEqual([
      [2, 'draft', editor.name],
      [1, 'in_review', 'Seed'],
    ]);
    const draft = item.versions[0]!.data as { meta: { version: number }; history: { version: number; change: string; by: string }[] };
    expect(draft.meta.version).toBe(2);
    expect(draft.history.at(-1)).toMatchObject({ version: 2, change: 'Clearer first step', by: editor.name });
    expect((await rollbackTo(s, editor, 'rule', 'voter-form-8-correction', 1)).version).toBe(3);
  });

  it('@M13-AC-2.2 a draft that would break the knowledge base is refused with the reasons', async () => {
    const editor = await staff('content_editor');
    expect(await code(saveDraft(s, editor, { kind: 'rule', key: 'x', data: '{ not json', note: '' }))).toBe('invalid_json');
    const source = structuredClone((await s.knowledge()).kb.sources[0]!) as unknown as Record<string, unknown>;
    source.url = 'https://uidai-help.example.com/';
    try {
      await saveDraft(s, editor, { kind: 'source', data: source, note: 'Wrong site' });
      expect.unreachable();
    } catch (e) {
      expect((e as ServiceError).code).toBe('invalid_kb');
      expect((e as ServiceError).details.join(' ')).toMatch(/link rejected/);
    }
    const rule = await ruleData('pan-name-dob-correction');
    rule.authority = 'no-such-authority';
    expect(await code(saveDraft(s, editor, { kind: 'rule', data: rule, note: '' }))).toBe('invalid_kb');
  });

  it('@M13-AC-2.3 differences are listed path by path', () => {
    const example = loadExample<{ before: unknown; after: unknown; expect: unknown[] }>('M13', 'M13-EX-diff');
    expect(diffJson(example.before, example.after)).toEqual(example.expect);
  });

  it('@M13-AC-3.1 @M13-AC-4.2 a published draft becomes effective, recorded and audited, and is not yet verified', async () => {
    const editor = await staff('content_editor');
    const publisher = await staff('publisher');
    const data = await ruleData('aadhaar-demographic-update');
    (data.steps as { en: string }[])[0]!.en = 'Book an appointment at an Aadhaar Seva Kendra.';
    const { version } = await saveDraft(s, editor, { kind: 'rule', data, note: 'Appointment first' });
    expect(await code(publishVersion(s, editor, 'rule', 'aadhaar-demographic-update', version))).toBe('forbidden');
    await publishVersion(s, publisher, 'rule', 'aadhaar-demographic-update', version);
    const rule = (await s.knowledge()).kb.rules.find((r) => r.id === 'aadhaar-demographic-update')!;
    expect(rule.steps[0]!.en).toBe('Book an appointment at an Aadhaar Seva Kendra.');
    expect(rule.meta).toMatchObject({ status: 'published', version, lastVerified: null });
    const item = (await getKbItem(s, publisher, 'rule', 'aadhaar-demographic-update'))!;
    expect(item.effectiveVersion).toBe(version);
    expect(item.versions[0]).toMatchObject({ status: 'published', publishedBy: publisher.name });
    const [event] = await s.db.select().from(t.auditLogs).where(and(eq(t.auditLogs.actorId, publisher.id), eq(t.auditLogs.action, 'kb.rule.published')));
    expect(event!.details).toEqual({ version, changes: expect.any(Number) });
  });

  it('@M13-AC-3.2 the author of a fee or link change cannot publish it; another publisher can', async () => {
    for (const c of loadExample<{ cases: { change: string; needsSecondPerson: boolean }[] }>('M13', 'M13-EX-second-person').cases) {
      expect(needsSecondPerson([{ path: c.change, before: 1, after: 2 }]), c.change).toBe(c.needsSecondPerson);
    }
    const author = await staff('publisher');
    const other = await staff('publisher');
    const data = await ruleData('pan-name-dob-correction');
    const fees = data.fees as { amountInr?: number }[];
    fees[0]!.amountInr = (fees[0]!.amountInr ?? 0) + 6;
    const { version } = await saveDraft(s, author, { kind: 'rule', data, note: 'Fee revised' });
    expect(await code(publishVersion(s, author, 'rule', 'pan-name-dob-correction', version))).toBe('second_person_required');
    await publishVersion(s, other, 'rule', 'pan-name-dob-correction', version);
    expect((await s.knowledge()).kb.rules.find((r) => r.id === 'pan-name-dob-correction')!.fees[0]!.amountInr).toBe(fees[0]!.amountInr);
  });

  it('@M13-AC-3.3 withdrawing removes an item; withdrawing one others depend on is refused', async () => {
    const publisher = await staff('publisher');
    expect(await code(withdrawItem(s, publisher, 'authority', 'uidai', 'Test'))).toBe('invalid_kb');
    expect(await code(withdrawItem(s, publisher, 'rule', 'voter-form-8-shifting', ''))).toBe('reason_required');
    await withdrawItem(s, publisher, 'rule', 'voter-form-8-shifting', 'Replaced by a district rule');
    expect((await s.knowledge()).kb.rules.map((r) => r.id)).not.toContain('voter-form-8-shifting');
  });

  it('@M13-AC-4.1 a recorded verification shows as "last verified" in roadmaps once the rule is published', async () => {
    const editor = await staff('content_editor');
    const publisher = await staff('publisher');
    const data = await ruleData('voter-form-8-correction');
    const { version } = await saveDraft(s, editor, { kind: 'rule', data, note: 'Publish as reviewed' });
    await publishVersion(s, publisher, 'rule', 'voter-form-8-correction', version);
    expect(await code(recordVerification(s, editor, 'rule', 'voter-form-8-correction', { date: '2999-01-01', sourceId: 'voters-portal' }))).toBe('invalid_date');
    const sourceId = (await s.knowledge()).kb.sources.find((src) => src.authority === 'eci')?.id ?? (await s.knowledge()).kb.sources[0]!.id;
    await recordVerification(s, editor, 'rule', 'voter-form-8-correction', { date: '2026-10-01', sourceId });
    const { kb, ctx } = await s.knowledge();
    expect(kb.rules.find((r) => r.id === 'voter-form-8-correction')!.meta.lastVerified).toBe('2026-10-01');
    const analysis = analyse(
      {
        documents: [
          { id: 'a', kind: 'aadhaar', fields: { name: 'Mohammed Ibrahim' } },
          { id: 'v', kind: 'voter_id', fields: { name: 'Ibrahim Mujeeb' } },
        ],
        targets: { name: { value: 'Mohammed Ibrahim', status: 'confirmed' } },
      },
      ctx,
    );
    const step = buildRoadmap(analysis, ctx, { jurisdiction: 'IN-KA', asOf: '2026-10-05' }).steps.find((x) => x.kind === 'correction' && x.document === 'v');
    expect(step).toMatchObject({ verified: true, lastVerified: '2026-10-01' });
  });

  it('@M13-AC-5.1 a service price follows the same workflow and appears as the 1dentity service fee', async () => {
    const admin = await staff('admin');
    const other = await staff('publisher');
    const { version } = await saveDraft(s, admin, {
      kind: 'service_price',
      data: { id: 'assistance-pan', service: 'assistance', document: 'pan', amountInr: 199, meta: { owner: 'Product owner', source: 'Pricing decision', version: 1, status: 'draft' } },
      note: 'Pilot price',
    });
    expect(await code(publishVersion(s, admin, 'service_price', 'assistance-pan', version))).toBe('second_person_required');
    await publishVersion(s, other, 'service_price', 'assistance-pan', version);
    const userId = (await s.db.insert(t.users).values({ mobile: '+917000000001' }).returning())[0]!.id;
    await grantConsent(s, userId, 'full_check', 'en');
    await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Mohammed Ibrahim' } });
    await addTypedDocument(s, userId, { kind: 'sslc', values: { name: 'Mohammed Ibrahim' } });
    await addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Ibrahim Mujeeb' } });
    const step = (await runFullCheck(s, userId)).roadmap.steps.find((x) => x.kind === 'correction' && x.documentKind === 'pan');
    expect(step).toMatchObject({ serviceFee: { amountInr: 199, service: 'assistance' } });
  });
});

describe('M15 staff console', () => {
  it('@M15-AC-5.1 the dashboard shows counts only', async () => {
    const d = await dashboard(s, await staff('volunteer'));
    expect(d.customers).toBeGreaterThan(0);
    expect(d.kb.items).toBeGreaterThan(10);
    expect(d.kb.unverified).toBeGreaterThan(0);
    expect(Object.values(d).every((v) => typeof v === 'number' || typeof v === 'object')).toBe(true);
  });

  it('@M15-AC-5.2 customers show a reference, masked number and counts — never names or values — and views are audited', async () => {
    const userId = (await s.db.insert(t.users).values({ mobile: '+919876543210' }).returning())[0]!.id;
    await grantConsent(s, userId, 'full_check', 'en');
    await addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Fatima Shaikh' }, number: 'ABCPE1234F' });
    const volunteer = await staff('volunteer');
    const [row] = await listCustomers(s, volunteer, { mobile: '98765 43210' });
    expect(row).toMatchObject({ id: userId, mobileMasked: '+91 ••••••3210', fullCheck: true, uploads: false, documents: 1 });
    const detail = await getCustomer(s, volunteer, userId);
    expect(detail!.documentKinds).toEqual([{ kind: 'pan', status: 'verified' }]);
    expect(JSON.stringify([row, detail])).not.toMatch(/Fatima|ABCPE|9876543210/);
    const actions = (await s.db.select().from(t.auditLogs).where(eq(t.auditLogs.actorId, volunteer.id))).map((e) => e.action);
    expect(actions).toEqual(['customers.listed', 'customer.viewed']);
  });

  it('@M15-AC-3.4 privacy officers and admins read the audit log with filters and the chain result; others cannot', async () => {
    const officer = await staff('privacy_officer');
    const page = await listAuditEvents(s, officer, { action: 'kb.rule.' });
    expect(page.events.length).toBeGreaterThan(0);
    expect(page.events.every((e) => e.action.startsWith('kb.rule.'))).toBe(true);
    expect(page.chain.ok).toBe(true);
    expect((await listAuditEvents(s, officer, { actorKind: 'staff', from: '2000-01-01', to: '2999-12-31' })).events.length).toBeGreaterThan(0);
    expect(await code(listAuditEvents(s, officer, { from: '1 Jan' }))).toBe('invalid_date');
    expect(await code(listAuditEvents(s, await staff('publisher')))).toBe('forbidden');
    const [viewed] = await s.db.select().from(t.auditLogs).where(and(eq(t.auditLogs.actorId, officer.id), eq(t.auditLogs.action, 'audit.viewed')));
    expect(viewed).toBeTruthy();
  });

  it('@M15-AC-6.1 admins add staff with roles and change them; suspension ends sessions at once', async () => {
    const admin = await staff('admin');
    expect(await code(addStaff(s, admin, { email: 'new@example.test', name: 'New Person', password: 'short', roles: ['volunteer'] }))).toBe('weak_password');
    expect(await code(addStaff(s, admin, { email: 'new@example.test', name: 'New Person', password: 'a long enough password', roles: [] }))).toBe('no_roles');
    const id = await addStaff(s, admin, { email: 'New@Example.test', name: 'New Person', password: 'a long enough password', roles: ['volunteer'] });
    expect(await code(addStaff(s, admin, { email: 'new@example.test', name: 'Again', password: 'a long enough password', roles: ['volunteer'] }))).toBe('email_taken');
    await setRoles(s, admin, id, ['supervisor', 'volunteer']);
    expect((await listStaff(s, admin)).find((m) => m.id === id)).toMatchObject({ email: 'new@example.test', roles: ['supervisor', 'volunteer'], status: 'active', twoFactor: false });
    const token = await createSession(s.db, { kind: 'staff', staffId: id, mfaVerified: true });
    await changeStaffStatus(s, admin, id, 'suspended');
    expect(await resolveSession(s.db, token)).toBeNull();
    expect(await code(listStaff(s, await staff('supervisor')))).toBe('forbidden');
  });

  it('@M15-AC-6.2 an admin cannot lock themselves out', async () => {
    const admin = await staff('admin');
    expect(await code(setRoles(s, admin, admin.id, ['publisher']))).toBe('self_lockout');
    expect(await code(changeStaffStatus(s, admin, admin.id, 'suspended'))).toBe('self_lockout');
    expect(await code(setRoles(s, admin, admin.id, ['admin', 'publisher']))).toBe('ok');
  });
});
