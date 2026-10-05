import { revenue, ServiceError } from '@identity/services';
import { Notice, StaffShell } from '@/components/staff/StaffShell';
import { query, type SearchParams } from '@/lib/server/page';
import { requireStaff } from '@/lib/server/staff';
import { formatDateTime, METHOD_LABELS, staffError } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Revenue' };

/** M19-AC-3.1 · Service-fee payments, refunds and what is still due — never government fees. */
export default async function RevenuePage({ searchParams }: { searchParams: SearchParams }) {
  const { actor, s, can } = await requireStaff('payments.read');
  const q = await query(searchParams);
  let r: Awaited<ReturnType<typeof revenue>> | null = null;
  let error: string | null = null;
  try {
    r = await revenue(s, actor, { from: q.from, to: q.to });
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    error = staffError(e.code);
  }
  const tile = (label: string, value: string) => (
    <div className="card space-y-1" data-testid={`rev-${label}`}>
      <p className="text-[1.75rem] leading-none font-extrabold">{value}</p>
      <p className="font-semibold text-slate-500">{label}</p>
    </div>
  );
  return (
    <StaffShell name={actor.name} roles={[...actor.roles]} can={can} title="Service-fee revenue">
      <p>1dentity service fees only. Government fees are paid by citizens directly to the issuing office.</p>
      {error && <Notice tone="error">{error}</Notice>}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <div>
          <label className="field-label" htmlFor="from">
            From
          </label>
          <input id="from" name="from" type="date" className="field-input" defaultValue={r?.from} />
        </div>
        <div>
          <label className="field-label" htmlFor="to">
            To
          </label>
          <input id="to" name="to" type="date" className="field-input" defaultValue={r?.to} />
        </div>
        <button type="submit" className="btn-secondary">
          Show
        </button>
      </form>
      {r && (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {tile('Collected', `₹${r.payments}`)}
            {tile('Refunded', `₹${r.refunds}`)}
            {tile('Net', `₹${r.net}`)}
            {tile('Payments', String(r.count))}
            {tile('Waived', String(r.waived))}
            {tile('Still due on open cases', `₹${r.outstanding}`)}
          </div>
          <section className="card space-y-1">
            <h2 className="text-xl font-bold">By method (net)</h2>
            {Object.entries(r.byMethod).map(([m, v]) => (
              <p key={m}>
                {METHOD_LABELS[m]}: ₹{v}
              </p>
            ))}
          </section>
          <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
            <table className="w-full border-collapse bg-white text-[0.9375rem]" data-testid="ledger">
              <thead>
                <tr className="border-b-2 border-line-200">
                  {['Receipt', 'Date', 'Case', 'Kind', 'Amount', 'Method'].map((h) => (
                    <th key={h} scope="col" className="p-2 text-start">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {r.entries.map((e) => (
                  <tr key={e.number} className="border-b border-line-200">
                    <td className="p-2 font-mono">{e.number}</td>
                    <td className="p-2">{formatDateTime(e.at)}</td>
                    <td className="p-2 font-mono">{e.caseLabel}</td>
                    <td className="p-2">{e.kind}</td>
                    <td className="p-2">₹{e.amountInr}</td>
                    <td className="p-2">{METHOD_LABELS[e.method]}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </StaffShell>
  );
}
