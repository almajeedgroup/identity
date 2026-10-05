import { randomInt } from 'node:crypto';
import { seedKnowledgeBase } from '@identity/content';
import { isCaseId } from '@identity/domain';
import { createStaff, EncryptedStore, loadKnowledgeBase, MemoryRawStore, seedKnowledgeBaseIfEmpty, tables as t, type Database } from '@identity/db';
import { freshDatabase, testKeyring } from '@identity/db/testing';
import { createContext } from '@identity/engine';
import type { OcrProvider, OcrResult } from '@identity/ocr';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  addCaseNote,
  addTypedDocument,
  assignCase,
  caseDashboard,
  caseDocuments,
  caseQueue,
  citizenReply,
  claimCase,
  completeCase,
  confirmTarget,
  getMyCase,
  getStaffCase,
  grantConsent,
  listMyCases,
  moveCase,
  purgeEndedCaseFiles,
  recordFiling,
  requestHelp,
  requireProfile,
  ServiceError,
  setTaskDone,
  STANDARD_CHECKLIST,
  unmaskName,
  withdrawAssistance,
  withdrawMyCase,
  type Services,
  type StaffActor,
} from './index';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const image = (text: string) => new Uint8Array(Buffer.concat([PNG, Buffer.from(text)]));
const ocr: OcrProvider = {
  name: 'fake',
  recognise: async (bytes): Promise<OcrResult> => {
    const text = Buffer.from(bytes.subarray(8)).toString();
    return { text, words: [], meanConfidence: 0.9, provider: 'fake', engineVersion: '1' };
  },
};

let database: Database;
let s: Services;
let raw: MemoryRawStore;

beforeAll(async () => {
  database = await freshDatabase();
  await seedKnowledgeBaseIfEmpty(database.db, seedKnowledgeBase);
  raw = new MemoryRawStore();
  const keyring = testKeyring();
  s = {
    db: database.db,
    keyring,
    store: new EncryptedStore(raw, keyring),
    ocr: { image: ocr, pdf: ocr },
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

async function staff(name: string, ...roles: string[]): Promise<StaffActor> {
  const id = await createStaff(s.db, { email: `${randomInt(1e9)}@example.test`, name, password: 'a long enough password', roles: roles as never }, { kind: 'system', id: null });
  return { id, name, roles };
}

/** A citizen whose PAN name differs from their confirmed target (PRD §17). */
async function citizenWithPanIssue(assistance = true) {
  const [user] = await s.db.insert(t.users).values({ mobile: `+917${String(randomInt(1e9)).padStart(9, '0')}` }).returning();
  const userId = user!.id;
  await grantConsent(s, userId, 'full_check', 'en');
  if (assistance) await grantConsent(s, userId, 'assistance', 'en');
  await addTypedDocument(s, userId, { kind: 'aadhaar', values: { name: 'Mohammed Ibrahim' } });
  await addTypedDocument(s, userId, { kind: 'sslc', values: { name: 'Mohammed Ibrahim' } });
  const pan = await addTypedDocument(s, userId, { kind: 'pan', values: { name: 'Ibrahim Mujeeb' }, number: 'ABCPE1234F' });
  const profile = await requireProfile(s.db, userId);
  await confirmTarget(s, { kind: 'citizen', id: userId }, profile.id, 'name', 'Mohammed Ibrahim');
  return { userId, pan };
}

describe('M04 asking for help', () => {
  it('@M04-AC-1.2 @F06-AC-1.3 no case without the assistance consent', async () => {
    const { userId, pan } = await citizenWithPanIssue(false);
    expect(await code(requestHelp(s, userId, { documentId: pan, helpMode: 'desk' }))).toBe('assistance_consent_required');
    expect(await listMyCases(s, userId)).toEqual([]);
  });

  it('@M04-AC-1.1 @M04-AC-1.3 @M04-AC-1.4 a case keeps a snapshot of the step, starts a checklist, and is not duplicated', async () => {
    const { userId, pan } = await citizenWithPanIssue();
    const { caseId, existing } = await requestHelp(s, userId, { documentId: pan, helpMode: 'whatsapp_video', priority: ['age60'] });
    expect(existing).toBe(false);
    const [row] = await s.db.select().from(t.cases).where(eq(t.cases.id, caseId));
    expect(row).toMatchObject({ state: 'new', documentKind: 'pan', helpMode: 'whatsapp_video', priority: ['age60'], applicantName: 'Mohammed Ibrahim' });
    expect(row!.issues).toEqual([expect.objectContaining({ field: 'name', current: 'Ibrahim Mujeeb', target: 'Mohammed Ibrahim' })]);
    expect(row!.rule).toMatchObject({ id: 'pan-name-dob-correction' });
    const tasks = await s.db.select().from(t.caseTasks).where(eq(t.caseTasks.caseId, caseId));
    expect(tasks.map((x) => x.label).slice(-STANDARD_CHECKLIST.length)).toEqual([...STANDARD_CHECKLIST]);
    expect(isCaseId((await listMyCases(s, userId))[0]!.caseId)).toBe(true);
    expect(await requestHelp(s, userId, { documentId: pan, helpMode: 'desk' })).toEqual({ caseId, existing: true });
  });
});

describe('M09 staff work on cases', () => {
  it('@M09-AC-1.1 @M09-AC-2.1 @M09-AC-2.2 @M09-AC-2.3 masked queue; claim and assign; others get nothing; unmasking needs a reason', async () => {
    const { userId, pan } = await citizenWithPanIssue();
    const { caseId } = await requestHelp(s, userId, { documentId: pan, helpMode: 'desk', priority: ['disability'] });
    const sana = await staff('Sana Mirza', 'volunteer');
    const ravi = await staff('Ravi Kumar', 'volunteer');
    const lead = await staff('Lata Supervisor', 'supervisor');
    const row = (await caseQueue(s, sana, 'unassigned')).find((r) => r.id === caseId)!;
    expect(row).toMatchObject({ name: 'Mohammed I.', documentKind: 'pan', assignee: null, priority: ['disability'] });
    expect(row.sla.status).toBe('on_track');
    expect(await code(getStaffCase(s, sana, caseId))).toBe('not_found');
    await claimCase(s, sana, caseId);
    expect(await code(claimCase(s, ravi, caseId))).toBe('already_assigned');
    expect((await getStaffCase(s, sana, caseId)).assignee).toBe('Sana Mirza');
    expect(await code(getStaffCase(s, ravi, caseId))).toBe('not_found');
    const denied = await s.db.select().from(t.auditLogs).where(and(eq(t.auditLogs.actorId, ravi.id), eq(t.auditLogs.action, 'access.denied')));
    expect(denied.length).toBeGreaterThan(0);
    expect(await code(assignCase(s, sana, caseId, ravi.id))).toBe('forbidden');
    await assignCase(s, lead, caseId, ravi.id);
    expect((await getStaffCase(s, lead, caseId)).assignee).toBe('Ravi Kumar');
    expect(await code(unmaskName(s, ravi, caseId, ' '))).toBe('reason_required');
    expect(await unmaskName(s, ravi, caseId, 'Filing the application')).toBe('Mohammed Ibrahim');
    const [unmasked] = await s.db.select().from(t.auditLogs).where(and(eq(t.auditLogs.actorId, ravi.id), eq(t.auditLogs.action, 'case.name_unmasked')));
    expect(unmasked!.details).toEqual({ reason: 'Filing the application' });
  });

  it('@M09-AC-2.4 @M04-AC-3.1 @F06-AC-3.4 assigned staff see masked documents only while the citizen consents', async () => {
    const { userId, pan } = await citizenWithPanIssue();
    const { caseId } = await requestHelp(s, userId, { documentId: pan, helpMode: 'desk' });
    const sana = await staff('Sana Mirza', 'volunteer');
    await claimCase(s, sana, caseId);
    const docs = await caseDocuments(s, sana, caseId);
    expect(docs.find((d) => d.kind === 'pan')).toMatchObject({ numberMasked: '••••••234F' });
    expect(JSON.stringify(docs)).not.toContain('ABCPE1234F');
    expect(await withdrawAssistance(s, userId)).toEqual({ cases: 1 });
    expect(await code(caseDocuments(s, sana, caseId))).toBe('not_found');
    expect((await getMyCase(s, userId, caseId))!.state).toBe('withdrawn');
  });

  it('@M09-AC-3.1 @M09-AC-3.2 @M09-AC-3.3 @M09-AC-3.6 @M04-AC-2.2 @M04-AC-2.1 lifecycle, checklist, masked notes, a citizen reply', async () => {
    const { userId, pan } = await citizenWithPanIssue();
    const { caseId } = await requestHelp(s, userId, { documentId: pan, helpMode: 'desk' });
    const sana = await staff('Sana Mirza', 'volunteer');
    await claimCase(s, sana, caseId);
    expect(await code(moveCase(s, sana, caseId, 'completed'))).toBe('not_allowed');
    expect(await code(moveCase(s, sana, caseId, 'closed_not_proceeding'))).toBe('reason_required');
    await moveCase(s, sana, caseId, 'in_progress');
    const view = await getStaffCase(s, sana, caseId);
    await setTaskDone(s, sana, caseId, view.tasks[0]!.id, true);
    expect((await getStaffCase(s, sana, caseId)).tasks[0]).toMatchObject({ done: true, doneBy: 'Sana Mirza' });
    await addCaseNote(s, sana, caseId, { visibility: 'internal', body: 'Citizen gave 2341 2341 2346 by mistake' });
    await addCaseNote(s, sana, caseId, { visibility: 'citizen', body: 'Please upload your SSLC marks card.' });
    expect((await getStaffCase(s, sana, caseId)).notes.map((n) => n.body)).toEqual(['Citizen gave XXXX XXXX 2346 by mistake', 'Please upload your SSLC marks card.']);
    expect(await code(citizenReply(s, userId, caseId, { message: 'Here it is' }))).toBe('not_awaiting');
    await moveCase(s, sana, caseId, 'awaiting_citizen');
    expect(await code(citizenReply(s, userId, caseId, { message: '', file: { bytes: image('Aadhaar 2341 2341 2346') } }))).toBe('rejected_aadhaar');
    await citizenReply(s, userId, caseId, { message: 'Uploaded the marks card', file: { bytes: image('SSLC marks card'), label: 'SSLC' } });
    const mine = (await getMyCase(s, userId, caseId))!;
    expect(mine.volunteer).toBe('Sana M.');
    expect(mine.notes.map((n) => n.body)).toEqual(['Please upload your SSLC marks card.', 'Uploaded the marks card']);
    expect(mine.files).toHaveLength(1);
    expect(mine.timeline.map((e) => e.toState ?? e.kind)).toEqual(expect.arrayContaining(['new', 'in_progress', 'awaiting_citizen', 'citizen_reply']));
    expect(JSON.stringify(mine)).not.toContain('by mistake');
  });

  it('@M09-AC-3.4 @M09-AC-3.5 @M04-AC-2.3 filing with a reference, completion with proof, and withdrawal by the citizen', async () => {
    const { userId, pan } = await citizenWithPanIssue();
    const { caseId } = await requestHelp(s, userId, { documentId: pan, helpMode: 'desk' });
    const sana = await staff('Sana Mirza', 'volunteer');
    await claimCase(s, sana, caseId);
    await moveCase(s, sana, caseId, 'in_progress');
    expect(await code(recordFiling(s, sana, caseId, { reference: 'ACK-1', date: '2999-01-01' }))).toBe('invalid_date');
    await recordFiling(s, sana, caseId, { reference: 'PAN-CR-881234', date: '2026-10-05' });
    expect((await getMyCase(s, userId, caseId))).toMatchObject({ state: 'filed', applicationRef: 'PAN-CR-881234' });
    expect(await code(completeCase(s, sana, caseId, { completedOn: '2026-10-05' }))).toBe('proof_required');
    await completeCase(s, sana, caseId, { completedOn: '2026-10-05', note: 'New PAN card received by the citizen' });
    expect((await getMyCase(s, userId, caseId))!.state).toBe('completed');
    expect(await code(withdrawMyCase(s, userId, caseId))).toBe('case_closed');

    const other = await citizenWithPanIssue();
    const second = await requestHelp(s, other.userId, { documentId: other.pan, helpMode: 'doorstep' });
    await withdrawMyCase(s, other.userId, second.caseId);
    expect((await getMyCase(s, other.userId, second.caseId))!.state).toBe('withdrawn');
    expect(await getMyCase(s, userId, second.caseId)).toBeNull();
  });

  it('@M09-AC-4.1 the case dashboard counts and workload', async () => {
    const lead = await staff('Lata Supervisor', 'supervisor');
    const d = await caseDashboard(s, lead);
    expect(d.new + d.unassigned).toBeGreaterThan(0);
    expect(d.completed30d).toBeGreaterThanOrEqual(1);
    expect(d.workload.length).toBeGreaterThan(0);
  });

  it('@M09-AC-5.1 files of cases that ended over 30 days ago are purged', async () => {
    const { userId, pan } = await citizenWithPanIssue();
    const { caseId } = await requestHelp(s, userId, { documentId: pan, helpMode: 'desk' });
    const sana = await staff('Sana Mirza', 'volunteer');
    await claimCase(s, sana, caseId);
    await moveCase(s, sana, caseId, 'awaiting_citizen');
    await citizenReply(s, userId, caseId, { message: 'doc', file: { bytes: image('a document') } });
    await withdrawMyCase(s, userId, caseId);
    const [file] = await s.db.select().from(t.caseFiles).where(eq(t.caseFiles.caseId, caseId));
    expect(await purgeEndedCaseFiles(s, new Date(Date.now() + 10 * 86_400_000))).toBe(0);
    expect(await purgeEndedCaseFiles(s, new Date(Date.now() + 31 * 86_400_000))).toBeGreaterThanOrEqual(1);
    expect(raw.objects.has(file!.storageKey)).toBe(false);
  });
});
