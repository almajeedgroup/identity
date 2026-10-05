/** M09 · Staff work on cases: queue, least-privilege access, lifecycle, checklist, notes, filing, completion. */
import { allowedTransitions, CLOSURE_REASONS, istDate, orderQueue, shortName, transition, type CaseState, type ClosureReason, type PriorityFlag, type Sla } from '@identity/domain';
import { can, decryptValue, maskAadhaar, maskNumber, tables, writeAudit } from '@identity/db';
import { and, asc, desc, eq, inArray, isNull, lte } from 'drizzle-orm';
import { activeConsents } from '../consents';
import { nowOf, ServiceError, type Services, type StaffActor } from '../services';
import { requirePermission } from '../staff/guard';
import { caseIdOf, CASE_FILE_RETENTION_DAYS, cleanBody, isOpen, isUuid, loadCase, slaOf, storeCaseFile, type CaseRow } from './common';

const { caseEvents, caseFiles, caseNotes, caseTasks, cases, documentFields, documents, staffUsers, uploads } = tables;
const DAY = 86_400_000;

// ---------------------------------------------------------------- access (M09-AC-2.x)

const canSeeAll = (actor: StaffActor) => can(actor.roles, 'cases.manage');

/** The case, if this staff member may work on it; otherwise "not found" and an `access.denied` event. */
async function workableCase(s: Services, actor: StaffActor, caseId: string): Promise<CaseRow> {
  await requirePermission(s, actor, 'cases.work');
  const row = await loadCase(s.db, caseId);
  if (row && (canSeeAll(actor) || row.assignedToId === actor.id)) return row;
  await writeAudit(s.db, { actorKind: 'staff', actorId: actor.id, action: 'access.denied', subjectKind: 'case', subjectId: isUuid(caseId) ? caseId : null, details: { permission: 'cases.work' } }, nowOf(s));
  throw new ServiceError('not_found');
}

async function event(s: Services, row: CaseRow, actor: StaffActor, e: { kind: 'state' | 'assigned' | 'filed' | 'note'; from?: string | null; to?: string | null; reason?: string | null; citizenVisible?: boolean }, now: Date) {
  await s.db.insert(caseEvents).values({ caseId: row.id, kind: e.kind, fromState: e.from ?? null, toState: e.to ?? null, actorKind: 'staff', actorId: actor.id, reason: e.reason ?? null, citizenVisible: e.citizenVisible ?? true, at: now });
}

const audit = (s: Services, actor: StaffActor, action: string, row: CaseRow, details: Record<string, unknown>, now: Date) =>
  writeAudit(s.db, { actorKind: 'staff', actorId: actor.id, action, subjectKind: 'case', subjectId: row.id, details }, now);

// ---------------------------------------------------------------- queue (M09 US1)

export type QueueFilter = 'open' | 'unassigned' | 'mine' | 'overdue' | 'ended';

export interface QueueRow {
  id: string;
  caseId: string;
  /** M09-EX-mask */
  name: string;
  documentKind: string;
  helpMode: string;
  priority: PriorityFlag[];
  deadline: string | null;
  state: string;
  assignee: string | null;
  assignedToMe: boolean;
  sla: Sla;
  nextAction: string | null;
  nextActionDue: string | null;
  nextActionOverdue: boolean;
  createdAt: Date;
}

export async function caseQueue(s: Services, actor: StaffActor, filter: QueueFilter = 'open'): Promise<QueueRow[]> {
  await requirePermission(s, actor, 'cases.work');
  const now = nowOf(s);
  const today = istDate(now);
  const rows = await s.db.select().from(cases).orderBy(asc(cases.createdAt));
  const staffIds = [...new Set(rows.map((r) => r.assignedToId).filter((x): x is string => !!x))];
  const people = staffIds.length ? await s.db.select({ id: staffUsers.id, name: staffUsers.name }).from(staffUsers).where(inArray(staffUsers.id, staffIds)) : [];
  const out: QueueRow[] = [];
  for (const r of rows) {
    const open = isOpen(r.state);
    if (filter === 'ended' ? open : !open) continue;
    const sla = await slaOf(s, r);
    const nextActionOverdue = !!r.nextActionDue && r.nextActionDue < today && open;
    const row: QueueRow = {
      id: r.id,
      caseId: caseIdOf(r),
      name: shortName(r.applicantName),
      documentKind: r.documentKind,
      helpMode: r.helpMode,
      priority: r.priority as PriorityFlag[],
      deadline: r.deadline,
      state: r.state,
      assignee: r.assignedToId ? shortName(people.find((p) => p.id === r.assignedToId)?.name ?? '', 'Former staff') : null,
      assignedToMe: r.assignedToId === actor.id,
      sla,
      nextAction: r.nextAction,
      nextActionDue: r.nextActionDue,
      nextActionOverdue,
      createdAt: r.createdAt,
    };
    if (filter === 'unassigned' && r.assignedToId) continue;
    if (filter === 'mine' && r.assignedToId !== actor.id) continue;
    if (filter === 'overdue' && sla.status !== 'overdue' && !nextActionOverdue) continue;
    out.push(row);
  }
  return filter === 'ended' ? out.reverse() : orderQueue(out.map((r) => ({ ...r, due: r.sla.due })), today);
}

// ---------------------------------------------------------------- assignment (M09-AC-2.1)

export async function claimCase(s: Services, actor: StaffActor, caseId: string): Promise<void> {
  await requirePermission(s, actor, 'cases.work');
  const row = await loadCase(s.db, caseId);
  if (!row) throw new ServiceError('not_found');
  if (!isOpen(row.state)) throw new ServiceError('case_closed');
  if (row.assignedToId) throw new ServiceError('already_assigned');
  const now = nowOf(s);
  await s.db.update(cases).set({ assignedToId: actor.id, updatedAt: now }).where(and(eq(cases.id, row.id), isNull(cases.assignedToId)));
  await event(s, row, actor, { kind: 'assigned' }, now);
  await audit(s, actor, 'case.claimed', row, {}, now);
}

export async function assignCase(s: Services, actor: StaffActor, caseId: string, staffId: string): Promise<void> {
  await requirePermission(s, actor, 'cases.manage', { kind: 'case', id: caseId });
  const row = await loadCase(s.db, caseId);
  if (!row) throw new ServiceError('not_found');
  if (!isOpen(row.state)) throw new ServiceError('case_closed');
  if (!isUuid(staffId)) throw new ServiceError('invalid_value');
  const [person] = await s.db.select().from(staffUsers).where(eq(staffUsers.id, staffId)).limit(1);
  const roles = person ? (await s.db.select({ role: tables.staffRoles.role }).from(tables.staffRoles).where(eq(tables.staffRoles.staffId, staffId))).map((r) => r.role) : [];
  if (!person || person.status !== 'active' || !can(roles, 'cases.work')) throw new ServiceError('invalid_value');
  const now = nowOf(s);
  await s.db.update(cases).set({ assignedToId: staffId, updatedAt: now }).where(eq(cases.id, row.id));
  await event(s, row, actor, { kind: 'assigned' }, now);
  await audit(s, actor, 'case.assigned', row, { to: staffId }, now);
}

/** Staff who can take cases, for the assign menu. */
export async function caseWorkers(s: Services, actor: StaffActor): Promise<{ id: string; name: string }[]> {
  await requirePermission(s, actor, 'cases.manage');
  const people = await s.db.select().from(staffUsers).where(eq(staffUsers.status, 'active'));
  const roles = await s.db.select().from(tables.staffRoles);
  return people.filter((p) => can(roles.filter((r) => r.staffId === p.id).map((r) => r.role), 'cases.work')).map((p) => ({ id: p.id, name: p.name }));
}

// ---------------------------------------------------------------- the case (M09 US3)

export interface StaffCaseView {
  id: string;
  caseId: string;
  name: string;
  row: CaseRow;
  sla: Sla;
  assignee: string | null;
  transitions: CaseState[];
  timeline: { kind: string; from: string | null; to: string | null; at: Date; actor: string; reason: string | null; citizenVisible: boolean }[];
  tasks: { id: string; label: string; done: boolean; doneAt: Date | null; doneBy: string | null }[];
  notes: { id: string; visibility: string; body: string; author: string; at: Date }[];
  files: { id: string; label: string | null; kind: string; mime: string; at: Date; purged: boolean }[];
  consent: boolean;
}

export async function getStaffCase(s: Services, actor: StaffActor, caseId: string): Promise<StaffCaseView> {
  const row = await workableCase(s, actor, caseId);
  const [events, tasks, notes, files, consents] = await Promise.all([
    s.db.select().from(caseEvents).where(eq(caseEvents.caseId, row.id)).orderBy(asc(caseEvents.at)),
    s.db.select().from(caseTasks).where(eq(caseTasks.caseId, row.id)).orderBy(asc(caseTasks.position)),
    s.db.select().from(caseNotes).where(eq(caseNotes.caseId, row.id)).orderBy(asc(caseNotes.createdAt)),
    s.db.select().from(caseFiles).where(eq(caseFiles.caseId, row.id)).orderBy(asc(caseFiles.createdAt)),
    activeConsents(s.db, row.userId),
  ]);
  const ids = [...new Set([row.assignedToId, ...events.map((e) => e.actorId), ...tasks.map((t) => t.doneById), ...notes.map((n) => n.authorId)].filter((x): x is string => !!x))];
  const people = ids.length ? await s.db.select({ id: staffUsers.id, name: staffUsers.name }).from(staffUsers).where(inArray(staffUsers.id, ids)) : [];
  const who = (kind: string, id: string | null) => (kind === 'citizen' ? 'Citizen' : kind === 'system' ? 'System' : (people.find((p) => p.id === id)?.name ?? 'Former staff'));
  return {
    id: row.id,
    caseId: caseIdOf(row),
    name: shortName(row.applicantName),
    row,
    sla: await slaOf(s, row),
    assignee: row.assignedToId ? who('staff', row.assignedToId) : null,
    transitions: allowedTransitions(row.state as CaseState),
    timeline: events.map((e) => ({ kind: e.kind, from: e.fromState, to: e.toState, at: e.at, actor: who(e.actorKind, e.actorId), reason: e.reason, citizenVisible: e.citizenVisible })),
    tasks: tasks.map((t) => ({ id: t.id, label: t.label, done: !!t.doneAt, doneAt: t.doneAt, doneBy: t.doneById ? who('staff', t.doneById) : null })),
    notes: notes.map((n) => ({ id: n.id, visibility: n.visibility, body: n.body, author: who(n.authorKind, n.authorId), at: n.createdAt })),
    files: files.map((f) => ({ id: f.id, label: f.label, kind: f.kind, mime: f.mime, at: f.createdAt, purged: !!f.purgedAt })),
    consent: consents.has('assistance'),
  };
}

/** M09-AC-2.3 · The full name needs a reason, and the view is audited. */
export async function unmaskName(s: Services, actor: StaffActor, caseId: string, reason: string): Promise<string | null> {
  const row = await workableCase(s, actor, caseId);
  const why = reason.replace(/\s+/g, ' ').trim().slice(0, 300);
  if (!why) throw new ServiceError('reason_required');
  await audit(s, actor, 'case.name_unmasked', row, { reason: why }, nowOf(s));
  return row.applicantName;
}

/** M09-AC-3.1 · F01 transitions only; closing needs a reason. */
export async function moveCase(s: Services, actor: StaffActor, caseId: string, to: string, reason?: string): Promise<void> {
  const row = await workableCase(s, actor, caseId);
  if (to === 'filed' || to === 'completed') throw new ServiceError('not_allowed'); // through recordFiling / completeCase
  const closure = reason && (CLOSURE_REASONS as readonly string[]).includes(reason) ? (reason as ClosureReason) : undefined;
  const result = transition(row.state as CaseState, to as CaseState, closure);
  if (!result.ok) throw new ServiceError(result.error === 'reason_required' ? 'reason_required' : 'not_allowed');
  const now = nowOf(s);
  const ended = !isOpen(to);
  await s.db
    .update(cases)
    .set({ state: to, updatedAt: now, ...(ended ? { endedAt: now } : {}), ...(to === 'closed_not_proceeding' ? { closureReason: closure } : {}) })
    .where(eq(cases.id, row.id));
  await event(s, row, actor, { kind: 'state', from: row.state, to, reason: closure ?? null }, now);
  await audit(s, actor, 'case.state_changed', row, { from: row.state, to }, now);
}

/** M09-AC-3.3 · Notes are internal or for the citizen; Aadhaar numbers are masked before storing. */
export async function addCaseNote(s: Services, actor: StaffActor, caseId: string, input: { visibility: 'internal' | 'citizen'; body: string }): Promise<void> {
  const row = await workableCase(s, actor, caseId);
  if (!['internal', 'citizen'].includes(input.visibility)) throw new ServiceError('invalid_value');
  const now = nowOf(s);
  await s.db.insert(caseNotes).values({ caseId: row.id, visibility: input.visibility, body: cleanBody(input.body), authorKind: 'staff', authorId: actor.id, createdAt: now });
  if (input.visibility === 'citizen') await event(s, row, actor, { kind: 'note' }, now);
  await s.db.update(cases).set({ updatedAt: now }).where(eq(cases.id, row.id));
  await audit(s, actor, 'case.note_added', row, { visibility: input.visibility }, now);
}

/** M09-AC-3.2 */
export async function setTaskDone(s: Services, actor: StaffActor, caseId: string, taskId: string, done: boolean): Promise<void> {
  const row = await workableCase(s, actor, caseId);
  if (!isUuid(taskId)) throw new ServiceError('not_found');
  const now = nowOf(s);
  const updated = await s.db
    .update(caseTasks)
    .set(done ? { doneAt: now, doneById: actor.id } : { doneAt: null, doneById: null })
    .where(and(eq(caseTasks.id, taskId), eq(caseTasks.caseId, row.id)))
    .returning({ id: caseTasks.id });
  if (updated.length === 0) throw new ServiceError('not_found');
  await audit(s, actor, 'case.task_done', row, { taskId, done }, now);
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;

/** M09-AC-3.4 · Appointment and next action. */
export async function setCaseSchedule(s: Services, actor: StaffActor, caseId: string, input: { appointmentAt?: string; nextAction?: string; nextActionDue?: string }): Promise<void> {
  const row = await workableCase(s, actor, caseId);
  if (!isOpen(row.state)) throw new ServiceError('case_closed');
  if (input.nextActionDue && !DATE.test(input.nextActionDue)) throw new ServiceError('invalid_date');
  const appointment = input.appointmentAt ? new Date(input.appointmentAt) : null;
  if (appointment && Number.isNaN(appointment.getTime())) throw new ServiceError('invalid_date');
  const now = nowOf(s);
  await s.db
    .update(cases)
    .set({ appointmentAt: appointment, nextAction: input.nextAction?.trim().slice(0, 200) || null, nextActionDue: input.nextActionDue || null, updatedAt: now })
    .where(eq(cases.id, row.id));
  await audit(s, actor, 'case.scheduled', row, { appointment: !!appointment, nextAction: !!input.nextAction }, now);
}

/** M09-AC-3.4 / M10 · The authority's reference marks the case filed. */
export async function recordFiling(s: Services, actor: StaffActor, caseId: string, input: { reference: string; date: string }): Promise<void> {
  const row = await workableCase(s, actor, caseId);
  const reference = input.reference.replace(/\s+/g, ' ').trim();
  if (!reference || reference.length > 80) throw new ServiceError('invalid_value');
  if (!DATE.test(input.date) || input.date > istDate(nowOf(s))) throw new ServiceError('invalid_date');
  if (!transition(row.state as CaseState, 'filed').ok) throw new ServiceError('not_allowed');
  const now = nowOf(s);
  await s.db.update(cases).set({ state: 'filed', applicationRef: cleanBody(reference, 80), applicationDate: input.date, updatedAt: now }).where(eq(cases.id, row.id));
  await event(s, row, actor, { kind: 'state', from: row.state, to: 'filed' }, now);
  await audit(s, actor, 'case.filed', row, {}, now);
}

/** M09-AC-3.5 · Completion needs a date and proof (a file, or a note when nothing is issued). */
export async function completeCase(s: Services, actor: StaffActor, caseId: string, input: { completedOn: string; note?: string; proof?: { bytes: Uint8Array; label?: string } }): Promise<void> {
  const row = await workableCase(s, actor, caseId);
  if (!transition(row.state as CaseState, 'completed').ok) throw new ServiceError('not_allowed');
  if (!DATE.test(input.completedOn) || input.completedOn > istDate(nowOf(s))) throw new ServiceError('invalid_date');
  const note = input.note?.trim() ? cleanBody(input.note, 500) : null;
  if (!input.proof && !note) throw new ServiceError('proof_required');
  if (input.proof) await storeCaseFile(s, row.id, { bytes: input.proof.bytes, kind: 'proof', label: input.proof.label ?? 'Proof of completion', by: { kind: 'staff', id: actor.id } });
  const now = nowOf(s);
  await s.db
    .update(cases)
    .set({ state: 'completed', completedAt: new Date(`${input.completedOn}T12:00:00+05:30`), completionNote: note, endedAt: now, updatedAt: now })
    .where(eq(cases.id, row.id));
  await event(s, row, actor, { kind: 'state', from: row.state, to: 'completed' }, now);
  await audit(s, actor, 'case.completed', row, { proof: !!input.proof }, now);
}

export async function addStaffCaseFile(s: Services, actor: StaffActor, caseId: string, input: { bytes: Uint8Array; label?: string }): Promise<string> {
  const row = await workableCase(s, actor, caseId);
  if (!isOpen(row.state)) throw new ServiceError('case_closed');
  const id = await storeCaseFile(s, row.id, { bytes: input.bytes, kind: 'staff', label: input.label, by: { kind: 'staff', id: actor.id } });
  await audit(s, actor, 'case.file_added', row, { fileId: id }, nowOf(s));
  return id;
}

export async function openStaffCaseFile(s: Services, actor: StaffActor, caseId: string, fileId: string): Promise<{ bytes: Buffer; mime: string }> {
  const row = await workableCase(s, actor, caseId);
  const [file] = isUuid(fileId) ? await s.db.select().from(caseFiles).where(and(eq(caseFiles.id, fileId), eq(caseFiles.caseId, row.id))) : [];
  const bytes = file && !file.purgedAt ? await s.store.get(file.storageKey) : null;
  if (!file || !bytes) throw new ServiceError('not_found');
  await audit(s, actor, 'case.file_viewed', row, { fileId }, nowOf(s));
  return { bytes, mime: file.mime };
}

// ---------------------------------------------------------------- the citizen's documents (M09-AC-2.4)

async function documentAccess(s: Services, actor: StaffActor, caseId: string): Promise<CaseRow> {
  const row = await workableCase(s, actor, caseId);
  const consent = (await activeConsents(s.db, row.userId)).has('assistance');
  if (!consent || !isOpen(row.state)) {
    await writeAudit(s.db, { actorKind: 'staff', actorId: actor.id, action: 'access.denied', subjectKind: 'case', subjectId: row.id, details: { reason: consent ? 'case_ended' : 'no_consent' } }, nowOf(s));
    throw new ServiceError('not_found');
  }
  return row;
}

export interface CaseDocumentView {
  id: string;
  kind: string;
  status: string;
  numberMasked: string | null;
  fields: { field: string; value: unknown }[];
  uploads: { id: string; mime: string }[];
}

export async function caseDocuments(s: Services, actor: StaffActor, caseId: string): Promise<CaseDocumentView[]> {
  const row = await documentAccess(s, actor, caseId);
  const { kb } = await s.knowledge();
  const docs = await s.db.select().from(documents).where(eq(documents.profileId, row.profileId));
  const ids = docs.map((d) => d.id);
  const [fields, files] = ids.length
    ? await Promise.all([
        s.db.select().from(documentFields).where(inArray(documentFields.documentId, ids)),
        s.db.select().from(uploads).where(and(inArray(uploads.documentId, ids), isNull(uploads.purgedAt))),
      ])
    : [[], []];
  await audit(s, actor, 'case.documents_viewed', row, { documents: docs.length }, nowOf(s));
  return docs.map((d) => {
    const last4 = kb.catalogue.find((c) => c.kind === d.kind)?.numberStorage === 'last4_only';
    return {
      id: d.id,
      kind: d.kind,
      status: d.status,
      numberMasked: d.numberLast4 ? (last4 ? maskAadhaar(d.numberLast4) : d.numberEncrypted ? maskNumber(decryptValue(d.numberEncrypted, s.keyring)) : null) : null,
      fields: fields.filter((f) => f.documentId === d.id && f.version === d.currentVersion).map((f) => ({ field: f.field, value: f.confirmed ?? f.original })),
      uploads: files.filter((u) => u.documentId === d.id).map((u) => ({ id: u.id, mime: u.mime })),
    };
  });
}

export async function openCaseDocumentFile(s: Services, actor: StaffActor, caseId: string, uploadId: string): Promise<{ bytes: Buffer; mime: string }> {
  const row = await documentAccess(s, actor, caseId);
  const [file] = isUuid(uploadId)
    ? await s.db
        .select({ upload: uploads })
        .from(uploads)
        .innerJoin(documents, eq(uploads.documentId, documents.id))
        .where(and(eq(uploads.id, uploadId), eq(documents.profileId, row.profileId), isNull(uploads.purgedAt)))
    : [];
  const bytes = file ? await s.store.get(file.upload.storageKey) : null;
  if (!file || !bytes) throw new ServiceError('not_found');
  await audit(s, actor, 'case.document_file_viewed', row, { uploadId }, nowOf(s));
  return { bytes, mime: file.upload.mime };
}

// ---------------------------------------------------------------- dashboard (M09-AC-4.1) and retention (M09-AC-5.1)

export interface CaseDashboard {
  new: number;
  unassigned: number;
  awaitingCitizen: number;
  withAuthority: number;
  overdue: number;
  completed30d: number;
  workload: { name: string; open: number }[];
}

export async function caseDashboard(s: Services, actor: StaffActor): Promise<CaseDashboard> {
  await requirePermission(s, actor, 'cases.work');
  const now = nowOf(s);
  const all = await s.db.select().from(cases).orderBy(desc(cases.createdAt));
  const open = all.filter((c) => isOpen(c.state));
  const queue = await caseQueue(s, actor, 'overdue');
  const people = await s.db.select({ id: staffUsers.id, name: staffUsers.name }).from(staffUsers);
  const load = new Map<string, number>();
  for (const c of open) if (c.assignedToId) load.set(c.assignedToId, (load.get(c.assignedToId) ?? 0) + 1);
  return {
    new: open.filter((c) => c.state === 'new').length,
    unassigned: open.filter((c) => !c.assignedToId).length,
    awaitingCitizen: open.filter((c) => c.state === 'awaiting_citizen').length,
    withAuthority: open.filter((c) => c.state === 'with_authority' || c.state === 'filed').length,
    overdue: queue.length,
    completed30d: all.filter((c) => c.state === 'completed' && c.endedAt && now.getTime() - c.endedAt.getTime() <= 30 * DAY).length,
    workload: [...load].map(([id, n]) => ({ name: people.find((p) => p.id === id)?.name ?? 'Former staff', open: n })).sort((a, b) => b.open - a.open),
  };
}

/** C-05 · Files of cases that ended more than 30 days ago are deleted. */
export async function purgeEndedCaseFiles(s: Services, now: Date = nowOf(s)): Promise<number> {
  const cutoff = new Date(now.getTime() - CASE_FILE_RETENTION_DAYS * DAY);
  const ended = await s.db.select({ id: cases.id }).from(cases).where(lte(cases.endedAt, cutoff));
  if (ended.length === 0) return 0;
  const files = await s.db.select().from(caseFiles).where(and(inArray(caseFiles.caseId, ended.map((c) => c.id)), isNull(caseFiles.purgedAt)));
  for (const f of files) {
    await s.store.delete(f.storageKey);
    await s.db.update(caseFiles).set({ purgedAt: now }).where(eq(caseFiles.id, f.id));
    await writeAudit(s.db, { actorKind: 'system', action: 'retention.case_file_purged', subjectKind: 'case', subjectId: f.caseId, details: { fileId: f.id } }, now);
  }
  return files.length;
}
