import { listAuditEvents, ServiceError, type AuditPage } from '@identity/services';
import Link from 'next/link';
import { Notice, StaffShell } from '@/components/staff/StaffShell';
import { query, type SearchParams } from '@/lib/server/page';
import { requireStaff } from '@/lib/server/staff';
import { formatDateTime, staffError } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Audit log' };

/** M15-AC-3.4 / M15-FR-08 · Filtered audit events with the hash-chain verification result. */
export default async function AuditPageView({ searchParams }: { searchParams: SearchParams }) {
  const { actor, s, can } = await requireStaff('audit.read');
  const q = await query(searchParams);
  const filters = { actorKind: q.actorKind || undefined, actorId: q.actorId || undefined, action: q.action || undefined, from: q.from || undefined, to: q.to || undefined, before: q.before ? Number(q.before) : undefined };
  let page: AuditPage | null = null;
  let error: string | null = null;
  try {
    page = await listAuditEvents(s, actor, filters);
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    error = staffError(e.code);
  }
  const next = page?.nextBefore ? `?${new URLSearchParams({ ...Object.fromEntries(Object.entries(q).filter(([k]) => k !== 'before')), before: String(page.nextBefore) })}` : null;
  return (
    <StaffShell name={actor.name} roles={[...actor.roles]} can={can} title="Audit log">
      {page &&
        (page.chain.ok ? (
          <Notice tone="success">
            <span data-testid="chain">Chain intact — {page.chain.count} events verified.</span>
          </Notice>
        ) : (
          <Notice tone="error">
            <span data-testid="chain">Chain broken at event {page.chain.brokenAt}. Tell the privacy officer at once.</span>
          </Notice>
        ))}
      {error && <Notice tone="error">{error}</Notice>}
      <form method="get" className="card grid gap-3 sm:grid-cols-3">
        <div>
          <label className="field-label" htmlFor="actorKind">
            Actor kind
          </label>
          <select id="actorKind" name="actorKind" className="field-input" defaultValue={q.actorKind ?? ''}>
            <option value="">Any</option>
            {['citizen', 'staff', 'system', 'anonymous'].map((k) => (
              <option key={k} value={k}>
                {k}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="field-label" htmlFor="actorId">
            Actor id
          </label>
          <input id="actorId" name="actorId" className="field-input font-mono" defaultValue={q.actorId ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="action">
            Action starts with
          </label>
          <input id="action" name="action" className="field-input font-mono" placeholder="kb. or document.file_viewed" defaultValue={q.action ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="from">
            From
          </label>
          <input id="from" name="from" type="date" className="field-input" defaultValue={q.from ?? ''} />
        </div>
        <div>
          <label className="field-label" htmlFor="to">
            To
          </label>
          <input id="to" name="to" type="date" className="field-input" defaultValue={q.to ?? ''} />
        </div>
        <div className="flex items-end">
          <button type="submit" className="btn-secondary">
            Filter
          </button>
        </div>
      </form>
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
        <table className="w-full border-collapse bg-white text-[0.875rem]" data-testid="audit">
          <thead>
            <tr className="border-b-2 border-line-200">
              {['#', 'Time', 'Actor', 'Action', 'Subject', 'Details'].map((h) => (
                <th key={h} scope="col" className="p-2 text-start">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {page?.events.map((e) => (
              <tr key={e.id} className="border-b border-line-200 align-top">
                <td className="p-2">{e.id}</td>
                <td className="p-2 whitespace-nowrap">{formatDateTime(e.at)}</td>
                <td className="p-2 font-mono">
                  {e.actorKind}
                  {e.actorId ? ` ${e.actorId.slice(0, 8)}` : ''}
                </td>
                <td className="p-2 font-mono">{e.action}</td>
                <td className="p-2 font-mono break-all">{e.subjectKind ? `${e.subjectKind} ${String(e.subjectId ?? '').slice(0, 24)}` : '—'}</td>
                <td className="p-2 font-mono break-all">{JSON.stringify(e.details)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {next && (
        <Link href={`/staff/audit${next}`} className="btn-secondary">
          Older events
        </Link>
      )}
    </StaffShell>
  );
}
