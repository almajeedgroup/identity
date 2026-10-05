import { caseDashboard, dashboard } from '@identity/services';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { requireStaff } from '@/lib/server/staff';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Dashboard' };

/** M15-AC-5.1 · Counts only — no personal data. */
export default async function StaffDashboard() {
  const { actor, s, can } = await requireStaff('dashboard.read');
  const d = await dashboard(s, actor);
  const cases = can('cases.work') ? await caseDashboard(s, actor) : null;
  const tile = (label: string, value: number, href?: string) => (
    <div className="card space-y-1" data-testid={`tile-${label}`}>
      <p className="text-[2rem] leading-none font-extrabold">{value}</p>
      <p className="font-semibold text-slate-500">{href ? <Link href={href}>{label}</Link> : label}</p>
    </div>
  );
  return (
    <StaffShell name={actor.name} roles={[...actor.roles]} can={can} title="Dashboard">
      <section aria-labelledby="citizens" className="space-y-3">
        <h2 id="citizens" className="text-xl font-bold">
          Citizens
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {tile('Customers', d.customers, can('customers.read') ? '/staff/customers' : undefined)}
          {tile('Full Check profiles', d.fullCheckProfiles)}
          {tile('Documents', d.documents)}
          {tile('Waiting for the citizen to confirm', d.awaitingConfirmation)}
          {tile('Issues in latest reports', d.openIssues)}
          {tile('Uploaded files stored', d.uploadsStored)}
        </div>
      </section>
      <section aria-labelledby="kb" className="space-y-3">
        <h2 id="kb" className="text-xl font-bold">
          Knowledge base
        </h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {tile('Items', d.kb.items, can('rules.read') ? '/staff/rules' : undefined)}
          {tile('Published', d.kb.published)}
          {tile('In review (seed, not yet published)', d.kb.inReview)}
          {tile('Drafts waiting', d.kb.drafts)}
          {tile('Never verified', d.kb.unverified)}
          {tile('Stale or re-checking', d.kb.stale + d.kb.rechecking)}
        </div>
      </section>
      {cases && (
        <section aria-labelledby="cases" className="space-y-3">
          <h2 id="cases" className="text-xl font-bold">
            Cases
          </h2>
          <div className="grid gap-3 sm:grid-cols-3">
            {tile('New', cases.new, '/staff/cases')}
            {tile('Unassigned', cases.unassigned, '/staff/cases?filter=unassigned')}
            {tile('Awaiting the citizen', cases.awaitingCitizen)}
            {tile('Filed or with the authority', cases.withAuthority)}
            {tile('Overdue', cases.overdue, '/staff/cases?filter=overdue')}
            {tile('Completed in 30 days', cases.completed30d)}
          </div>
          {cases.workload.length > 0 && (
            <ul className="card space-y-1" aria-label="Workload">
              {cases.workload.map((w) => (
                <li key={w.name}>
                  {w.name}: {w.open} open
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </StaffShell>
  );
}
