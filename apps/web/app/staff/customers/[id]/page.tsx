import { getCustomer } from '@identity/services';
import { notFound } from 'next/navigation';
import { StaffShell } from '@/components/staff/StaffShell';
import { requireStaff } from '@/lib/server/staff';
import { formatDateTime } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Customer' };

/** M15-AC-5.2 · One customer, without personal data; the view is audited. */
export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, s, can } = await requireStaff('customers.read');
  const c = await getCustomer(s, actor, id);
  if (!c) notFound();
  const { kb } = await s.knowledge();
  const label = (kind: string) => kb.catalogue.find((d) => d.kind === kind)?.label.en ?? kind;
  return (
    <StaffShell name={actor.name} roles={[...actor.roles]} can={can} title={`Customer ${c.ref}`}>
      <dl className="card grid gap-3 sm:grid-cols-2" data-testid="customer">
        <div>
          <dt className="field-label">Mobile</dt>
          <dd className="font-mono">{c.mobileMasked}</dd>
        </div>
        <div>
          <dt className="field-label">Joined · last seen</dt>
          <dd>
            {formatDateTime(c.createdAt)} · {c.lastSeenAt ? formatDateTime(c.lastSeenAt) : '—'}
          </dd>
        </div>
        <div>
          <dt className="field-label">Consents</dt>
          <dd>
            Full Check: {c.fullCheck ? 'agreed' : 'not agreed'} · Uploads: {c.uploads ? 'agreed' : 'not agreed'}
          </dd>
        </div>
        <div>
          <dt className="field-label">Issues in the latest report</dt>
          <dd>{c.issues ?? 'No report yet'}</dd>
        </div>
      </dl>
      <section className="space-y-2">
        <h2 className="text-xl font-bold">Documents</h2>
        <ul className="list-disc ps-6">
          {c.documentKinds.map((d, i) => (
            <li key={i}>
              {label(d.kind)} — {d.status === 'verified' ? 'confirmed by the citizen' : 'waiting for the citizen to confirm'}
            </li>
          ))}
          {c.documentKinds.length === 0 && <li>None</li>}
        </ul>
      </section>
      <p className="text-slate-500">Document details and files become visible to assigned staff only when the citizen asks for assistance (P1).</p>
    </StaffShell>
  );
}
