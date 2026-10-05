import { listCustomers, ServiceError, type CustomerRow } from '@identity/services';
import Link from 'next/link';
import { Notice, StaffShell } from '@/components/staff/StaffShell';
import { query, type SearchParams } from '@/lib/server/page';
import { requireStaff } from '@/lib/server/staff';
import { formatDateTime, staffError } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Customers' };

/** M15-AC-5.2 · References, masked numbers and counts only; every view is audited. */
export default async function CustomersPage({ searchParams }: { searchParams: SearchParams }) {
  const { actor, s, can } = await requireStaff('customers.read');
  const q = await query(searchParams);
  let rows: CustomerRow[] = [];
  let error: string | null = null;
  try {
    rows = await listCustomers(s, actor, { mobile: q.mobile });
  } catch (e) {
    if (!(e instanceof ServiceError)) throw e;
    error = staffError(e.code);
  }
  return (
    <StaffShell name={actor.name} roles={[...actor.roles]} can={can} title="Customers">
      <p>
        Until a citizen asks 1dentity for help (P1), staff see no names, document details or files — only what is needed to recognise an account at the
        help desk.
      </p>
      <form className="flex flex-wrap items-end gap-3" method="get">
        <div className="grow">
          <label className="field-label" htmlFor="mobile">
            Find by full mobile number
          </label>
          <input id="mobile" name="mobile" type="tel" className="field-input" defaultValue={q.mobile ?? ''} />
        </div>
        <button type="submit" className="btn-secondary">
          Search
        </button>
      </form>
      {error && <Notice tone="error">{error}</Notice>}
      <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
        <table className="w-full border-collapse bg-white text-start" data-testid="customers">
          <thead>
            <tr className="border-b-2 border-line-200 text-start">
              {['Reference', 'Mobile', 'Joined', 'Full Check', 'Uploads', 'Documents', 'Issues'].map((h) => (
                <th key={h} scope="col" className="p-2 text-start">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-b border-line-200">
                <td className="p-2 font-mono">
                  <Link href={`/staff/customers/${r.id}`}>{r.ref}</Link>
                </td>
                <td className="p-2 font-mono">{r.mobileMasked}</td>
                <td className="p-2">{formatDateTime(r.createdAt)}</td>
                <td className="p-2">{r.fullCheck ? 'Agreed' : '—'}</td>
                <td className="p-2">{r.uploads ? 'Agreed' : '—'}</td>
                <td className="p-2">{r.documents}</td>
                <td className="p-2">{r.issues ?? '—'}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td colSpan={7} className="p-3">
                  No customers found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </StaffShell>
  );
}
