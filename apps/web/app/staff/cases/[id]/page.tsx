import { CLOSURE_REASONS } from '@identity/domain';
import { caseLedger, caseWorkers, getStaffCase, PAYMENT_METHODS, ServiceError, unmaskName, type StaffCaseView } from '@identity/services';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Notice, StaffShell } from '@/components/staff/StaffShell';
import { query, type SearchParams } from '@/lib/server/page';
import {
  assignCaseAction,
  caseCompleteAction,
  caseFileAction,
  caseFilingAction,
  caseNoteAction,
  caseScheduleAction,
  caseTaskAction,
  claimCaseAction,
  moveCaseAction,
  recordPaymentAction,
  refundFeeAction,
  setFeeAction,
  unmaskNameAction,
  waiveFeeAction,
} from '@/lib/server/staff-actions';
import { requireStaff } from '@/lib/server/staff';
import { FEE_LABELS, formatDateTime, METHOD_LABELS, MODE_LABELS, PRIORITY_LABELS, SLA_LABELS, STAGE_LABELS, staffError } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Case' };

const SAVED: Record<string, string> = {
  claimed: 'You took this case.',
  assigned: 'Case assigned.',
  moved: 'Stage updated. The citizen sees it in their timeline.',
  note: 'Note saved.',
  task: 'Checklist updated.',
  schedule: 'Schedule saved.',
  filed: 'Filing recorded. The citizen sees the reference.',
  completed: 'Case completed.',
  file: 'File added.',
  fee: 'Fee set. The citizen must accept it before paying.',
  paid: 'Payment recorded.',
  waived: 'Fee waived.',
  refunded: 'Refund recorded.',
};

/** M09 US2–US3 · Work on one case. */
export default async function StaffCasePage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: SearchParams }) {
  const { id } = await params;
  const q = await query(searchParams);
  const { actor, s, can } = await requireStaff('cases.work');
  let c: StaffCaseView;
  try {
    c = await getStaffCase(s, actor, id);
  } catch (e) {
    if (e instanceof ServiceError && e.code === 'not_found') notFound();
    throw e;
  }
  const fullName = q.unmask ? await unmaskName(s, actor, id, q.unmask) : null;
  const [{ kb }, workers] = await Promise.all([s.knowledge(), can('cases.manage') ? caseWorkers(s, actor) : Promise.resolve([])]);
  const r = c.row;
  const open = !['completed', 'closed_not_proceeding', 'withdrawn'].includes(r.state);
  const issues = r.issues as { field: string; current: string; target: string }[];
  const error = staffError(q.error);
  const hidden = <input type="hidden" name="id" value={c.id} />;
  const today = new Date().toISOString().slice(0, 10);
  const ledger = await caseLedger(s, c.id);
  const methodSelect = (idPrefix: string) => (
    <div>
      <label className="field-label" htmlFor={`${idPrefix}-method`}>
        Method
      </label>
      <select id={`${idPrefix}-method`} name="method" className="field-input">
        {PAYMENT_METHODS.map((m) => (
          <option key={m} value={m}>
            {METHOD_LABELS[m]}
          </option>
        ))}
      </select>
    </div>
  );

  return (
    <StaffShell name={actor.name} roles={[...actor.roles]} can={can} title={`Case ${c.caseId}`}>
      {error && <Notice tone="error">{error}</Notice>}
      {q.saved && SAVED[q.saved] && <Notice tone="success">{SAVED[q.saved]}</Notice>}

      <section className="card grid gap-3 sm:grid-cols-2" data-testid="case-summary">
        <div>
          <p className="field-label">Applicant</p>
          <p className="text-lg font-bold" data-testid="applicant">
            {fullName ?? c.name}
          </p>
          {!fullName && (
            <details>
              <summary className="cursor-pointer text-[0.875rem] font-semibold text-sky-600">Show full name</summary>
              <form action={unmaskNameAction} className="mt-2 flex flex-wrap items-end gap-2">
                {hidden}
                <div className="grow">
                  <label className="field-label" htmlFor="reason-unmask">
                    Reason (recorded)
                  </label>
                  <input id="reason-unmask" name="reason" className="field-input" required maxLength={200} />
                </div>
                <button type="submit" className="btn-secondary">
                  Show
                </button>
              </form>
            </details>
          )}
        </div>
        <div>
          <p className="field-label">Document · help</p>
          <p>
            {kb.catalogue.find((d) => d.kind === r.documentKind)?.label.en} · {MODE_LABELS[r.helpMode]}
          </p>
          <p className="text-[0.875rem]">
            Priority: {(r.priority as string[]).map((p) => PRIORITY_LABELS[p]).join(', ') || 'normal'}
            {r.deadline ? ` · deadline ${r.deadline}${r.deadlineNote ? ` (${r.deadlineNote})` : ''}` : ''}
          </p>
        </div>
        <div>
          <p className="field-label">Stage · SLA</p>
          <p data-testid="stage">
            {STAGE_LABELS[r.state]} · {SLA_LABELS[c.sla.status]} (day {c.sla.day}, due {c.sla.due})
          </p>
        </div>
        <div>
          <p className="field-label">Assigned</p>
          <p data-testid="assignee">{c.assignee ?? 'Unassigned'}</p>
          {open && !r.assignedToId && (
            <form action={claimCaseAction}>
              {hidden}
              <button type="submit" className="btn-primary mt-1">
                Take this case
              </button>
            </form>
          )}
          {open && can('cases.manage') && (
            <form action={assignCaseAction} className="mt-2 flex flex-wrap items-end gap-2">
              {hidden}
              <div className="grow">
                <label className="field-label" htmlFor="assign">
                  Assign to
                </label>
                <select id="assign" name="staff" className="field-input" defaultValue={r.assignedToId ?? ''}>
                  {workers.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-secondary">
                Assign
              </button>
            </form>
          )}
        </div>
      </section>

      <section className="card space-y-2">
        <h2 className="text-xl font-bold">What to correct</h2>
        <ul className="list-disc ps-6">
          {issues.map((i) => (
            <li key={i.field}>
              {i.field}: “{i.current || 'not entered'}” → “{i.target}”
            </li>
          ))}
        </ul>
        <p className="text-[0.875rem] text-slate-500">
          Rule: {(r.rule as { id?: string; version?: number } | null)?.id ?? 'none in the knowledge base'}
          {(r.rule as { version?: number } | null)?.version ? ` v${(r.rule as { version: number }).version}` : ''} · Service fee:{' '}
          {(r.serviceFee as { amountInr: number } | null) ? `₹${(r.serviceFee as { amountInr: number }).amountInr}` : 'to be confirmed'}
        </p>
        {c.consent && open ? (
          <Link href={`/staff/cases/${c.id}/documents`} className="btn-secondary">
            Open the citizen’s documents
          </Link>
        ) : (
          <p className="font-semibold text-amber-700">The citizen’s documents are not available (case ended or consent withdrawn).</p>
        )}
        {r.applicationRef && <p data-testid="reference">Application reference: {r.applicationRef} ({r.applicationDate})</p>}
      </section>

      <section className="card space-y-3" aria-labelledby="fee-title" data-testid="fee">
        <h2 id="fee-title" className="text-xl font-bold">
          1dentity service fee
        </h2>
        <p data-testid="fee-status">
          {FEE_LABELS[r.feeStatus]}
          {r.feeAmountInr !== null ? ` · ₹${r.feeAmountInr}` : ''}
          {r.feeNote ? ` · ${r.feeNote}` : ''}
        </p>
        <p className="text-[0.875rem] text-slate-500">Government fees are never collected by 1dentity; the citizen pays them to the issuing office.</p>
        {q.receipt && <p className="font-semibold text-emerald-700">Receipt {q.receipt}</p>}
        {ledger.length > 0 && (
          <ul className="space-y-1" data-testid="ledger">
            {ledger.map((e) => (
              <li key={e.number}>
                {e.number} · {e.kind} · ₹{e.amountInr} · {METHOD_LABELS[e.method]} · {formatDateTime(e.at)}
              </li>
            ))}
          </ul>
        )}
        {can('payments.manage') && open && ['not_set', 'awaiting_acceptance'].includes(r.feeStatus) && (
          <form action={setFeeAction} className="flex flex-wrap items-end gap-2">
            {hidden}
            <div>
              <label className="field-label" htmlFor="fee-amount">
                Fee (₹)
              </label>
              <input id="fee-amount" name="amount" type="number" min={0} max={100000} step={1} className="field-input" required />
            </div>
            <div className="grow">
              <label className="field-label" htmlFor="fee-note">
                Note for the citizen
              </label>
              <input id="fee-note" name="note" className="field-input" maxLength={200} />
            </div>
            <button type="submit" className="btn-secondary">
              Set fee
            </button>
          </form>
        )}
        {can('payments.record') && r.feeStatus === 'due' && (
          <form action={recordPaymentAction} className="flex flex-wrap items-end gap-2">
            {hidden}
            {methodSelect('pay')}
            <div className="grow">
              <label className="field-label" htmlFor="pay-ref">
                Transaction reference (optional)
              </label>
              <input id="pay-ref" name="reference" className="field-input" maxLength={80} />
            </div>
            <button type="submit" className="btn-primary">
              Record payment of ₹{r.feeAmountInr}
            </button>
          </form>
        )}
        {can('payments.manage') && ['not_set', 'awaiting_acceptance', 'due'].includes(r.feeStatus) && (
          <form action={waiveFeeAction} className="flex flex-wrap items-end gap-2">
            {hidden}
            <div className="grow">
              <label className="field-label" htmlFor="waive-reason">
                Waive — reason
              </label>
              <input id="waive-reason" name="reason" className="field-input" maxLength={300} required />
            </div>
            <button type="submit" className="btn-quiet">
              Waive fee
            </button>
          </form>
        )}
        {can('payments.manage') && r.feeStatus === 'paid' && (
          <form action={refundFeeAction} className="flex flex-wrap items-end gap-2">
            {hidden}
            {methodSelect('refund')}
            <div className="grow">
              <label className="field-label" htmlFor="refund-reason">
                Refund — reason
              </label>
              <input id="refund-reason" name="reason" className="field-input" maxLength={300} required />
            </div>
            <button type="submit" className="btn-quiet">
              Refund
            </button>
          </form>
        )}
      </section>

      {open && (
        <section className="card space-y-4" aria-labelledby="move-title">
          <h2 id="move-title" className="text-xl font-bold">
            Move the case
          </h2>
          <div className="flex flex-wrap gap-2">
            {c.transitions
              .filter((to) => !['filed', 'completed', 'closed_not_proceeding'].includes(to))
              .map((to) => (
                <form key={to} action={moveCaseAction}>
                  {hidden}
                  <input type="hidden" name="to" value={to} />
                  <button type="submit" className="btn-secondary">
                    → {STAGE_LABELS[to]}
                  </button>
                </form>
              ))}
          </div>
          {c.transitions.includes('closed_not_proceeding') && (
            <form action={moveCaseAction} className="flex flex-wrap items-end gap-2">
              {hidden}
              <input type="hidden" name="to" value="closed_not_proceeding" />
              <div>
                <label className="field-label" htmlFor="close-reason">
                  Close, not proceeding — reason
                </label>
                <select id="close-reason" name="reason" className="field-input">
                  {CLOSURE_REASONS.map((x) => (
                    <option key={x} value={x}>
                      {x.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </div>
              <button type="submit" className="btn-quiet">
                Close case
              </button>
            </form>
          )}
          {c.transitions.includes('filed') && (
            <form action={caseFilingAction} className="grid gap-2 sm:grid-cols-3 sm:items-end" aria-label="Record filing">
              {hidden}
              <div>
                <label className="field-label" htmlFor="reference">
                  Application reference
                </label>
                <input id="reference" name="reference" className="field-input" required maxLength={80} />
              </div>
              <div>
                <label className="field-label" htmlFor="filed-date">
                  Filed on
                </label>
                <input id="filed-date" name="date" type="date" className="field-input" defaultValue={today} max={today} required />
              </div>
              <button type="submit" className="btn-primary">
                Record filing
              </button>
            </form>
          )}
          {c.transitions.includes('completed') && (
            <form action={caseCompleteAction} className="grid gap-2 sm:grid-cols-2" aria-label="Complete case">
              {hidden}
              <div>
                <label className="field-label" htmlFor="done-date">
                  Completed on
                </label>
                <input id="done-date" name="date" type="date" className="field-input" defaultValue={today} max={today} required />
              </div>
              <div>
                <label className="field-label" htmlFor="proof">
                  Proof of completion (file)
                </label>
                <input id="proof" name="proof" type="file" accept="image/jpeg,image/png,application/pdf" className="field-input py-3" />
              </div>
              <div className="sm:col-span-2">
                <label className="field-label" htmlFor="done-note">
                  Or a note, if the office issued nothing
                </label>
                <input id="done-note" name="note" className="field-input" maxLength={500} />
              </div>
              <button type="submit" className="btn-primary">
                Complete case
              </button>
            </form>
          )}
          <form action={caseScheduleAction} className="grid gap-2 sm:grid-cols-3 sm:items-end" aria-label="Schedule">
            {hidden}
            <div>
              <label className="field-label" htmlFor="appointment">
                Appointment
              </label>
              <input id="appointment" name="appointment" type="datetime-local" className="field-input" />
            </div>
            <div>
              <label className="field-label" htmlFor="next-action">
                Next action
              </label>
              <input id="next-action" name="next_action" className="field-input" defaultValue={r.nextAction ?? ''} maxLength={200} />
            </div>
            <div>
              <label className="field-label" htmlFor="next-due">
                Due
              </label>
              <input id="next-due" name="next_due" type="date" className="field-input" defaultValue={r.nextActionDue ?? ''} />
            </div>
            <button type="submit" className="btn-secondary">
              Save schedule
            </button>
          </form>
        </section>
      )}

      <section className="card space-y-2" aria-labelledby="tasks-title">
        <h2 id="tasks-title" className="text-xl font-bold">
          Checklist
        </h2>
        <ul className="space-y-1" data-testid="tasks">
          {c.tasks.map((t) => (
            <li key={t.id}>
              <form action={caseTaskAction} className="flex flex-wrap items-center gap-2">
                {hidden}
                <input type="hidden" name="task" value={t.id} />
                <input type="hidden" name="done" value={t.done ? '0' : '1'} />
                <button type="submit" className="min-h-12 rounded-lg px-2 text-start" aria-pressed={t.done}>
                  <span aria-hidden="true">{t.done ? '☑' : '☐'}</span> {t.label}
                </button>
                {t.done && (
                  <span className="text-[0.8125rem] text-slate-500">
                    {t.doneBy} · {t.doneAt ? formatDateTime(t.doneAt) : ''}
                  </span>
                )}
              </form>
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3" aria-labelledby="notes-title">
        <h2 id="notes-title" className="text-xl font-bold">
          Notes
        </h2>
        <ul className="space-y-2" data-testid="notes">
          {c.notes.map((n) => (
            <li key={n.id} className={`rounded-lg p-2 ${n.visibility === 'citizen' ? 'bg-emerald-50' : 'bg-mist-50'}`}>
              <p className="text-[0.8125rem] font-semibold text-slate-500">
                {n.author} · {n.visibility === 'citizen' ? 'visible to the citizen' : 'internal'} · {formatDateTime(n.at)}
              </p>
              <p className="whitespace-pre-line">{n.body}</p>
            </li>
          ))}
        </ul>
        {open && (
          <form action={caseNoteAction} className="space-y-2">
            {hidden}
            <label className="field-label" htmlFor="note-body">
              New note
            </label>
            <textarea id="note-body" name="body" className="field-input min-h-24" required maxLength={2000} />
            <div className="flex flex-wrap gap-2">
              <label className="choice">
                <input type="radio" name="visibility" value="internal" defaultChecked />
                <span>Internal</span>
              </label>
              <label className="choice">
                <input type="radio" name="visibility" value="citizen" />
                <span>For the citizen</span>
              </label>
            </div>
            <button type="submit" className="btn-secondary">
              Save note
            </button>
          </form>
        )}
      </section>

      <section className="card space-y-2" aria-labelledby="files-title">
        <h2 id="files-title" className="text-xl font-bold">
          Case files
        </h2>
        <ul className="space-y-1">
          {c.files.map((f) => (
            <li key={f.id}>
              {f.purged ? (
                <span className="text-slate-500">{f.label ?? f.kind} — deleted after retention</span>
              ) : (
                <a href={`/staff/cases/${c.id}/files/${f.id}`} target="_blank" rel="noopener">
                  {f.label ?? f.kind} ({f.kind}) · {formatDateTime(f.at)}
                </a>
              )}
            </li>
          ))}
          {c.files.length === 0 && <li>None yet.</li>}
        </ul>
        {open && (
          <form action={caseFileAction} className="flex flex-wrap items-end gap-2">
            {hidden}
            <div>
              <label className="field-label" htmlFor="case-file">
                Add a file
              </label>
              <input id="case-file" name="file" type="file" accept="image/jpeg,image/png,application/pdf" className="field-input py-3" required />
            </div>
            <div>
              <label className="field-label" htmlFor="file-label">
                Label
              </label>
              <input id="file-label" name="label" className="field-input" maxLength={80} />
            </div>
            <button type="submit" className="btn-secondary">
              Upload
            </button>
          </form>
        )}
      </section>

      <section className="space-y-2" aria-labelledby="timeline-title">
        <h2 id="timeline-title" className="text-xl font-bold">
          Timeline
        </h2>
        <ol className="space-y-1 border-s-2 border-emerald-600 ps-4" data-testid="timeline">
          {c.timeline.map((e, i) => (
            <li key={i} className="text-[0.9375rem]">
              {formatDateTime(e.at)} · {e.actor} · {e.kind === 'state' ? `${e.from ? `${STAGE_LABELS[e.from]} → ` : ''}${STAGE_LABELS[e.to ?? '']}` : e.kind.replace('_', ' ')}
              {e.reason ? ` (${e.reason.replace(/_/g, ' ')})` : ''}
            </li>
          ))}
        </ol>
      </section>
    </StaffShell>
  );
}
