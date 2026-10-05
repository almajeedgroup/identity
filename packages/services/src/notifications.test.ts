import { randomInt } from 'node:crypto';
import { seedKnowledgeBase } from '@identity/content';
import { createStaff, EncryptedStore, loadKnowledgeBase, MemoryRawStore, seedKnowledgeBaseIfEmpty, tables as t, type Database, type OtpSender } from '@identity/db';
import { freshDatabase, testKeyring } from '@identity/db/testing';
import { createContext } from '@identity/engine';
import type { OcrProvider } from '@identity/ocr';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import {
  activeConsents,
  addTypedDocument,
  claimCase,
  confirmTarget,
  deliverSms,
  grantConsent,
  inQuietHours,
  listNotifications,
  markAllRead,
  moveCase,
  notify,
  recordFiling,
  requestHelp,
  requireProfile,
  setSmsUpdates,
  SMS_TEMPLATES,
  smsText,
  unreadCount,
  type Services,
} from './index';

class Outbox implements OtpSender {
  readonly name = 'test';
  readonly sent: { to: string; body: string }[] = [];
  failing = false;
  async send(to: string, body: string) {
    if (this.failing) throw new Error('provider down');
    this.sent.push({ to, body });
  }
}

const DAYTIME = new Date('2026-10-06T06:00:00Z'); // 11:30 in India
const NIGHT = new Date('2026-10-06T17:00:00Z'); // 22:30 in India

let database: Database;
let base: Services;
let outbox: Outbox;
const at = (now: Date): Services => ({ ...base, now: () => now });

beforeAll(async () => {
  database = await freshDatabase();
  await seedKnowledgeBaseIfEmpty(database.db, seedKnowledgeBase);
  const keyring = testKeyring();
  outbox = new Outbox();
  const none: OcrProvider = { name: 'none', recognise: async () => ({ text: '', words: [], meanConfidence: 0, provider: 'none', engineVersion: '0' }) };
  base = {
    db: database.db,
    keyring,
    store: new EncryptedStore(new MemoryRawStore(), keyring),
    ocr: { image: none, pdf: none },
    knowledge: async () => {
      const { kb, version } = await loadKnowledgeBase(database.db);
      return { kb, version, ctx: createContext(kb) };
    },
    messaging: { sender: outbox, appUrl: 'https://1dentity.example' },
  };
});
afterAll(async () => {
  await database.close();
});

async function citizenWithCase(s: Services, opts: { sms: boolean; locale?: string }) {
  const mobile = `+917${String(randomInt(1e9)).padStart(9, '0')}`;
  const [user] = await s.db.insert(t.users).values({ mobile, locale: opts.locale ?? 'en' }).returning();
  const userId = user!.id;
  await grantConsent(s, userId, 'full_check', 'en');
  await grantConsent(s, userId, 'assistance', 'en');
  if (opts.sms) await setSmsUpdates(s, userId, true, 'en');
  await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Mohammed Ibrahim' } });
  await addTypedDocument(s, userId, { kind: 'sslc', values: { name: 'Mohammed Ibrahim' } });
  const pan = await addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Ibrahim Mujeeb' }, number: 'ABCPE1234F' });
  await confirmTarget(s, { kind: 'citizen', id: userId }, (await requireProfile(s.db, userId)).id, 'name', 'Mohammed Ibrahim');
  const { caseId } = await requestHelp(s, userId, { documentId: pan, helpMode: 'desk' });
  const [row] = await s.db.select().from(t.cases).where(eq(t.cases.id, caseId));
  return { userId, mobile, caseId, label: `ID-${String(row!.number).padStart(5, '0')}` };
}

describe('F08 notifications', () => {
  it('@F08-AC-1.1 events create in-app notifications; the list shows unread ones and opening marks them read', async () => {
    const s = at(DAYTIME);
    const { userId, caseId, label } = await citizenWithCase(s, { sms: false });
    const staff = { id: await createStaff(s.db, { email: `${randomInt(1e9)}@x.test`, name: 'Sana Mirza', password: 'a long enough password', roles: ['volunteer'] }, { kind: 'system', id: null }), name: 'Sana Mirza', roles: ['volunteer'] };
    await claimCase(s, staff, caseId);
    await moveCase(s, staff, caseId, 'in_progress');
    await moveCase(s, staff, caseId, 'awaiting_citizen');
    await moveCase(s, staff, caseId, 'in_progress');
    await recordFiling(s, staff, caseId, { reference: 'ACK-1', date: '2026-10-06' });
    const list = await listNotifications(s, userId);
    expect(list.map((n) => n.kind).sort()).toEqual(['case_filed', 'case_received', 'documents_needed']);
    expect(list.every((n) => n.caseId === caseId && n.caseLabel === label && !n.read)).toBe(true);
    expect(await unreadCount(s, userId)).toBe(3);
    await markAllRead(s, userId);
    expect(await unreadCount(s, userId)).toBe(0);
  });

  it('@F08-AC-2.1 an opted-in citizen gets the minimal SMS in their language, linking to 1dentity only', async () => {
    const ex = loadExample<{ appUrl: string; case: { id: string; caseId: string }; messages: { kind: 'case_received' | 'case_filed'; text: string }[] }>('F08', 'F08-EX-sms');
    for (const m of ex.messages) expect(smsText(m.kind, 'en', { caseId: ex.case.caseId, link: `${ex.appUrl}/en/me/cases/${ex.case.id}` })).toBe(m.text);
    const s = at(DAYTIME);
    const before = outbox.sent.length;
    const { mobile, caseId, label } = await citizenWithCase(s, { sms: true, locale: 'kn' });
    const [sms] = outbox.sent.slice(before);
    expect(sms!.to).toBe(mobile);
    expect(sms!.body).toBe(smsText('case_received', 'kn', { caseId: label, link: `https://1dentity.example/kn/me/cases/${caseId}` }));
    expect(sms!.body).not.toMatch(/Ibrahim|ABCPE|gov\.in/);
  });

  it('@F08-AC-2.2 without opt-in, no SMS; the in-app notification still appears', async () => {
    const s = at(DAYTIME);
    const before = outbox.sent.length;
    const { userId } = await citizenWithCase(s, { sms: false });
    expect(outbox.sent.length).toBe(before);
    expect((await listNotifications(s, userId)).map((n) => n.kind)).toContain('case_received');
  });

  it('@F08-AC-2.3 quiet hours hold SMS until morning', async () => {
    expect(inQuietHours(NIGHT)).toBe(true);
    expect(inQuietHours(DAYTIME)).toBe(false);
    const before = outbox.sent.length;
    const { userId } = await citizenWithCase(at(NIGHT), { sms: true });
    expect(outbox.sent.length).toBe(before);
    const [row] = await base.db.select().from(t.notifications).where(and(eq(t.notifications.userId, userId), eq(t.notifications.kind, 'case_received')));
    expect(row!.sms).toBe('pending');
    await deliverSms(at(DAYTIME), DAYTIME);
    const [after] = await base.db.select().from(t.notifications).where(eq(t.notifications.id, row!.id));
    expect(after!.sms).toBe('sent');
    expect(outbox.sent.length).toBe(before + 1);
  });

  it('@F08-AC-2.4 a failing send is retried up to three attempts, then marked failed', async () => {
    outbox.failing = true;
    const s = at(DAYTIME);
    const { userId } = await citizenWithCase(s, { sms: true });
    const id = (await base.db.select().from(t.notifications).where(eq(t.notifications.userId, userId)))[0]!.id;
    await deliverSms(s, DAYTIME, [id]);
    await deliverSms(s, DAYTIME, [id]);
    const [row] = await base.db.select().from(t.notifications).where(eq(t.notifications.id, id));
    expect(row).toMatchObject({ sms: 'failed', smsAttempts: 3 });
    outbox.failing = false;
    const [event] = await base.db.select().from(t.auditLogs).where(and(eq(t.auditLogs.subjectId, id), eq(t.auditLogs.action, 'notification.sms_failed')));
    expect(event!.details).toEqual({ kind: 'case_received', attempts: 3 });
  });

  it('@F08-AC-3.1 SMS updates are an opt-in consent that can be turned off', async () => {
    const s = at(DAYTIME);
    const [user] = await s.db.insert(t.users).values({ mobile: `+917${String(randomInt(1e9)).padStart(9, '0')}` }).returning();
    await grantConsent(s, user!.id, 'full_check', 'hi');
    await setSmsUpdates(s, user!.id, true, 'hi');
    expect((await activeConsents(s.db, user!.id)).has('sms')).toBe(true);
    await setSmsUpdates(s, user!.id, false, 'hi');
    expect((await activeConsents(s.db, user!.id)).has('sms')).toBe(false);
    await notify(s, { userId: user!.id, kind: 'case_closed', caseLabel: 'ID-99999' });
    const [row] = await s.db.select().from(t.notifications).where(eq(t.notifications.userId, user!.id));
    expect(row!.sms).toBe('none');
  });

  it('@F08-AC-2.1 every SMS template exists in all four languages and stays short', () => {
    for (const [kind, texts] of Object.entries(SMS_TEMPLATES)) {
      expect(Object.keys(texts).sort(), kind).toEqual(['en', 'hi', 'kn', 'ur']);
      for (const text of Object.values(texts)) expect(text, kind).toMatch(/\{caseId\}.*\{link\}/s);
      expect(texts.en.replace('{link}', '').replace('{caseId}', 'ID-00000').length, kind).toBeLessThanOrEqual(160);
    }
    const events = loadExample<{ events: { kind: string; sms: boolean }[] }>('F08', 'F08-EX-events').events;
    expect(events.filter((e) => e.sms).map((e) => e.kind).sort()).toEqual(Object.keys(SMS_TEMPLATES).sort());
  });
});
