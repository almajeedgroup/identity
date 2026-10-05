/** M04 · A citizen asks 1dentity for help with a correction step, follows the case, replies, withdraws. */
import { shortName, type PriorityFlag } from '@identity/domain';
import { tables, writeAudit } from '@identity/db';
import type { CorrectionStep } from '@identity/engine';
import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import { markWithdrawn, requireConsent } from '../consents';
import { notify } from '../notifications';
import { loadTargets, requireProfile } from '../profile';
import { runFullCheck } from '../report';
import { nowOf, ServiceError, type Services } from '../services';
import { caseLedger, type LedgerEntry } from './payments';
import { caseIdOf, cleanBody, isOpen, isUuid, loadCase, STANDARD_CHECKLIST, storeCaseFile, type CaseRow } from './common';

const { caseEvents, caseFiles, caseNotes, caseTasks, cases, documentFields, documents, staffUsers } = tables;

export const HELP_MODES = ['desk', 'whatsapp_video', 'doorstep'] as const;
export type HelpMode = (typeof HELP_MODES)[number];

export interface HelpRequest {
  documentId: string;
  helpMode: HelpMode;
  priority?: PriorityFlag[];
  deadline?: string;
  deadlineNote?: string;
}

/** The correction step the citizen is asking help with, from their current roadmap. */
export async function correctionStepFor(s: Services, userId: string, documentId: string): Promise<CorrectionStep | null> {
  const check = await runFullCheck(s, userId);
  const step = check.roadmap.steps.find((x): x is CorrectionStep => x.kind === 'correction' && x.document === documentId);
  return step ?? null;
}

async function applicantName(s: Services, profileId: string, documentId: string, displayName: string | null): Promise<string | null> {
  const target = (await loadTargets(s.db, profileId)).name;
  if (target && typeof target.value === 'string') return target.value;
  if (displayName) return displayName;
  const [field] = await s.db
    .select({ confirmed: documentFields.confirmed })
    .from(documentFields)
    .innerJoin(documents, eq(documents.id, documentFields.documentId))
    .where(and(eq(documentFields.documentId, documentId), eq(documentFields.field, 'name'), eq(documentFields.version, documents.currentVersion)))
    .limit(1);
  return typeof field?.confirmed === 'string' ? field.confirmed : null;
}

/** M04-AC-1.2 … 1.4 · Creates the case (or returns the open one for the same document). */
export async function requestHelp(s: Services, userId: string, input: HelpRequest): Promise<{ caseId: string; existing: boolean }> {
  await requireConsent(s.db, userId, 'full_check');
  await requireConsent(s.db, userId, 'assistance');
  const profile = await requireProfile(s.db, userId);
  if (!HELP_MODES.includes(input.helpMode)) throw new ServiceError('invalid_value');
  const priority = [...new Set(input.priority ?? [])].filter((p) => ['age60', 'disability', 'deadline'].includes(p));
  let deadline: string | null = null;
  if (priority.includes('deadline')) {
    if (!input.deadline || !/^\d{4}-\d{2}-\d{2}$/.test(input.deadline)) throw new ServiceError('invalid_date');
    deadline = input.deadline;
  }
  const open = (await s.db.select().from(cases).where(and(eq(cases.userId, userId), eq(cases.documentId, input.documentId)))).find((c) => isOpen(c.state));
  if (open) return { caseId: open.id, existing: true };
  const step = await correctionStepFor(s, userId, input.documentId);
  if (!step) throw new ServiceError('no_correction_step');
  const { kb } = await s.knowledge();
  const rule = step.rule ? kb.rules.find((r) => r.id === step.rule!.id) : null;
  const now = nowOf(s);
  const name = await applicantName(s, profile.id, input.documentId, profile.displayName);
  const created = await s.db.transaction(async (tx) => {
    const [row] = await tx
      .insert(cases)
      .values({
        userId,
        profileId: profile.id,
        documentId: input.documentId,
        documentKind: step.documentKind,
        applicantName: name,
        issues: step.issues.map((i) => ({ field: i.field, printedAs: i.printedAs, current: i.display, target: i.targetDisplay, status: i.status })),
        rule: step.rule ? { ...step.rule, authority: step.authority } : null,
        governmentFees: step.governmentFees,
        serviceFee: step.serviceFee ? { id: step.serviceFee.id, amountInr: step.serviceFee.amountInr } : null,
        // M19-AC-1.1 · a price shown on the request page is agreed by asking; otherwise it is set later.
        feeStatus: step.serviceFee ? (step.serviceFee.amountInr > 0 ? 'due' : 'waived') : 'not_set',
        feeAmountInr: step.serviceFee?.amountInr ?? null,
        helpMode: input.helpMode,
        priority,
        deadline,
        deadlineNote: input.deadlineNote?.trim().slice(0, 120) || null,
        createdAt: now,
        updatedAt: now,
      })
      .returning();
    const labels = [...(rule?.requiredDocuments.map((d) => `Have: ${d.en}`) ?? []), ...STANDARD_CHECKLIST];
    await tx.insert(caseTasks).values(labels.map((label, position) => ({ caseId: row!.id, position, label })));
    await tx.insert(caseEvents).values({ caseId: row!.id, kind: 'state', fromState: null, toState: 'new', actorKind: 'citizen', actorId: userId, at: now });
    return row!;
  });
  await notify(s, { userId, kind: 'case_received', caseId: created.id, caseLabel: caseIdOf(created) });
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'case.requested', subjectKind: 'case', subjectId: created.id, details: { documentKind: step.documentKind, helpMode: input.helpMode, priority } }, now);
  return { caseId: created.id, existing: false };
}

async function ownCase(s: Services, userId: string, caseId: string): Promise<CaseRow> {
  const row = await loadCase(s.db, caseId);
  if (!row || row.userId !== userId) throw new ServiceError('not_found');
  return row;
}

export interface CitizenCaseSummary {
  id: string;
  caseId: string;
  state: string;
  documentKind: string;
  createdAt: Date;
  updatedAt: Date;
}

export async function listMyCases(s: Services, userId: string): Promise<CitizenCaseSummary[]> {
  const rows = await s.db.select().from(cases).where(eq(cases.userId, userId)).orderBy(desc(cases.createdAt));
  return rows.map((r) => ({ id: r.id, caseId: caseIdOf(r), state: r.state, documentKind: r.documentKind, createdAt: r.createdAt, updatedAt: r.updatedAt }));
}

export interface CitizenCaseView extends CitizenCaseSummary {
  issues: { field: string; current: string; target: string }[];
  governmentFees: CorrectionStep['governmentFees'];
  serviceFee: { amountInr: number } | null;
  helpMode: string;
  /** M04-FR-04 · first name and initial only. */
  volunteer: string | null;
  applicationRef: string | null;
  applicationDate: string | null;
  appointmentAt: Date | null;
  completedAt: Date | null;
  timeline: { kind: string; toState: string | null; at: Date; byCitizen: boolean }[];
  notes: { body: string; byCitizen: boolean; at: Date; author: string | null }[];
  files: { id: string; label: string | null; kind: string; mime: string; at: Date; purged: boolean }[];
  fee: { status: CaseRow['feeStatus']; amountInr: number | null; note: string | null };
  receipts: LedgerEntry[];
}

/** M04-AC-2.1 · What the citizen sees — never internal notes or staff details beyond a first name and initial. */
export async function getMyCase(s: Services, userId: string, caseId: string): Promise<CitizenCaseView | null> {
  const row = await loadCase(s.db, caseId);
  if (!row || row.userId !== userId) return null;
  const [events, notes, files] = await Promise.all([
    s.db.select().from(caseEvents).where(eq(caseEvents.caseId, row.id)).orderBy(asc(caseEvents.at)),
    s.db.select().from(caseNotes).where(and(eq(caseNotes.caseId, row.id), eq(caseNotes.visibility, 'citizen'))).orderBy(asc(caseNotes.createdAt)),
    s.db.select().from(caseFiles).where(eq(caseFiles.caseId, row.id)).orderBy(asc(caseFiles.createdAt)),
  ]);
  const staffIds = [...new Set([row.assignedToId, ...notes.filter((n) => n.authorKind === 'staff').map((n) => n.authorId)].filter((x): x is string => !!x))];
  const people = staffIds.length ? await s.db.select({ id: staffUsers.id, name: staffUsers.name }).from(staffUsers).where(inArray(staffUsers.id, staffIds)) : [];
  const nameOf = (id: string | null) => (id ? shortName(people.find((p) => p.id === id)?.name ?? '', '1dentity') : null);
  return {
    id: row.id,
    caseId: caseIdOf(row),
    state: row.state,
    documentKind: row.documentKind,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    issues: (row.issues as { field: string; current: string; target: string }[]).map(({ field, current, target }) => ({ field, current, target })),
    governmentFees: row.governmentFees as CorrectionStep['governmentFees'],
    serviceFee: row.serviceFee as { amountInr: number } | null,
    helpMode: row.helpMode,
    volunteer: nameOf(row.assignedToId),
    applicationRef: row.applicationRef,
    applicationDate: row.applicationDate,
    appointmentAt: row.appointmentAt,
    completedAt: row.completedAt,
    timeline: events.filter((e) => e.citizenVisible).map((e) => ({ kind: e.kind, toState: e.toState, at: e.at, byCitizen: e.actorKind === 'citizen' })),
    notes: notes.map((n) => ({ body: n.body, byCitizen: n.authorKind === 'citizen', at: n.createdAt, author: n.authorKind === 'staff' ? nameOf(n.authorId) : null })),
    files: files.map((f) => ({ id: f.id, label: f.label, kind: f.kind, mime: f.mime, at: f.createdAt, purged: !!f.purgedAt })),
    fee: { status: row.feeStatus, amountInr: row.feeAmountInr, note: row.feeNote },
    receipts: await caseLedger(s, row.id),
  };
}

/** M04-AC-2.2 · A reply (and optionally a file) while the case waits for the citizen. */
export async function citizenReply(s: Services, userId: string, caseId: string, input: { message: string; file?: { bytes: Uint8Array; label?: string } }): Promise<void> {
  await requireConsent(s.db, userId, 'assistance');
  const row = await ownCase(s, userId, caseId);
  if (row.state !== 'awaiting_citizen') throw new ServiceError('not_awaiting');
  const now = nowOf(s);
  const body = input.message.trim() ? cleanBody(input.message) : null;
  if (!body && !input.file) throw new ServiceError('reason_required');
  if (input.file) {
    await storeCaseFile(s, row.id, { bytes: input.file.bytes, kind: 'citizen', label: input.file.label, by: { kind: 'citizen', id: userId } });
    await s.db.insert(caseEvents).values({ caseId: row.id, kind: 'file', actorKind: 'citizen', actorId: userId, at: now });
    await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'case.file_added', subjectKind: 'case', subjectId: row.id }, now);
  }
  if (body) {
    await s.db.insert(caseNotes).values({ caseId: row.id, visibility: 'citizen', body, authorKind: 'citizen', authorId: userId, createdAt: now });
    await s.db.insert(caseEvents).values({ caseId: row.id, kind: 'citizen_reply', actorKind: 'citizen', actorId: userId, at: now });
    await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'case.citizen_replied', subjectKind: 'case', subjectId: row.id }, now);
  }
  await s.db.update(cases).set({ updatedAt: now }).where(eq(cases.id, row.id));
}

async function withdrawRow(s: Services, row: CaseRow, userId: string, now: Date) {
  await s.db.update(cases).set({ state: 'withdrawn', endedAt: now, updatedAt: now }).where(eq(cases.id, row.id));
  await s.db.insert(caseEvents).values({ caseId: row.id, kind: 'state', fromState: row.state, toState: 'withdrawn', actorKind: 'citizen', actorId: userId, at: now });
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'case.withdrawn_by_citizen', subjectKind: 'case', subjectId: row.id }, now);
}

/** M04-AC-2.3 */
export async function withdrawMyCase(s: Services, userId: string, caseId: string): Promise<void> {
  const row = await ownCase(s, userId, caseId);
  if (!isOpen(row.state)) throw new ServiceError('case_closed');
  await withdrawRow(s, row, userId, nowOf(s));
}

/** M04-AC-3.1 / F06-AC-3.4 · Withdrawing the assistance consent withdraws every open case. */
export async function withdrawAssistance(s: Services, userId: string): Promise<{ cases: number }> {
  const now = nowOf(s);
  const open = (await s.db.select().from(cases).where(eq(cases.userId, userId))).filter((c) => isOpen(c.state));
  for (const row of open) await withdrawRow(s, row, userId, now);
  await markWithdrawn(s.db, userId, ['assistance'], now);
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'consent.withdrawn', details: { purposes: ['assistance'], cases: open.length } }, now);
  return { cases: open.length };
}

/** A case file for its owner (citizen side). */
export async function openMyCaseFile(s: Services, userId: string, caseId: string, fileId: string): Promise<{ bytes: Buffer; mime: string } | null> {
  const row = await loadCase(s.db, caseId);
  const now = nowOf(s);
  const [file] = row && row.userId === userId && isUuid(fileId) ? await s.db.select().from(caseFiles).where(and(eq(caseFiles.id, fileId), eq(caseFiles.caseId, row.id))) : [];
  const bytes = file && !file.purgedAt ? await s.store.get(file.storageKey) : null;
  if (!file || !bytes) {
    await writeAudit(s.db, { actorKind: userId ? 'citizen' : 'anonymous', actorId: userId, action: 'access.denied', subjectKind: 'case_file', subjectId: isUuid(fileId) ? fileId : null }, now);
    return null;
  }
  await writeAudit(s.db, { actorKind: 'citizen', actorId: userId, action: 'case.file_viewed', subjectKind: 'case', subjectId: row!.id, details: { fileId } }, now);
  return { bytes, mime: file.mime };
}
