import { caseQueue, type QueueFilter } from '@identity/services';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { query, type SearchParams } from '@/lib/server/page';
import { requireStaff } from '@/lib/server/staff';
import { MODE_LABELS, PRIORITY_LABELS, SLA_LABELS, STAGE_LABELS } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Cases' };

const FILTERS: [QueueFilter, string][] = [
  ['open', 'All open'],
  ['unassigned', 'Unassigned'],
  ['mine', 'Mine'],
  ['overdue', 'Overdue'],
  ['ended', 'Ended'],
];

const SLA_TONE: Record<string, string> = {
  on_track: 'bg-emerald-50 text-emerald-700',
  met: 'bg-emerald-50 text-emerald-700',
  due_today: 'bg-amber-50 text-amber-700',
  paused: 'bg-sky-50 text-sky-600',
  overdue: 'bg-coral-50 text-coral-700',
  missed: 'bg-coral-50 text-coral-700',
  stopped: 'bg-slate-50 text-slate-500',
};

/** M09 US1 · Masked names, priority then SLA. */
export default async function CasesPage({ searchParams }: { searchParams: SearchParams }) {
  const { actor, s, can } = await requireStaff('cases.work');
  const q = await query(searchParams);
  const filter = (FILTERS.find(([f]) => f === q.filter)?.[0] ?? 'open') as QueueFilter;
  const [rows, { kb }] = await Promise.all([caseQueue(s, actor, filter), s.knowledge()]);
  const label = (kind: string) => kb.catalogue.find((c) => c.kind === kind)?.label.en ?? kind;
  return (
    <StaffShell name={actor.name} roles={[...actor.roles]} can={can} title="Cases">
      <nav aria-label="Case filters">
        <ul className="flex flex-wrap gap-2">
          {FILTERS.map(([f, text]) => (
            <li key={f}>
              <Link href={`/staff/cases?filter=${f}`} aria-current={f === filter ? 'page' : undefined} className={`inline-flex min-h-12 items-center rounded-full border-2 px-4 font-semibold no-underline ${f === filter ? 'border-emerald-600 bg-emerald-50 text-emerald-700' : 'border-line-200 bg-white text-ink-900'}`}>
                {text}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
        <table className="w-full border-collapse bg-white text-[0.9375rem]" data-testid="queue">
          <thead>
            <tr className="border-b-2 border-line-200">
              {['Case', 'Applicant', 'Document', 'Help', 'Priority', 'SLA', 'Assigned', 'Stage'].map((h) => (
                <th key={h} scope="col" className="p-2 text-start">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line-200" data-case={r.caseId}>
                <td className="p-2 font-mono">
                  <Link href={`/staff/cases/${r.id}`}>{r.caseId}</Link>
                </td>
                <td className="p-2">{r.name}</td>
                <td className="p-2">{label(r.documentKind)}</td>
                <td className="p-2">{MODE_LABELS[r.helpMode]}</td>
                <td className="p-2">{r.priority.map((p) => PRIORITY_LABELS[p]).join(', ') || '—'}</td>
                <td className="p-2">
                  <span className={`rounded-full px-2 py-0.5 text-[0.8125rem] font-bold whitespace-nowrap ${SLA_TONE[r.sla.status]}`}>
                    {SLA_LABELS[r.sla.status]} · day {r.sla.day}
                  </span>
                  {r.nextActionOverdue && <span className="mt-1 block text-[0.8125rem] font-bold text-coral-700">Follow-up overdue</span>}
                </td>
                <td className="p-2">{r.assignee ?? 'Unassigned'}</td>
                <td className="p-2">{STAGE_LABELS[r.state]}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={8} className="p-3">
                  No cases here.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
