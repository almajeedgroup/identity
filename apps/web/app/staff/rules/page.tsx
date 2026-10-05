import { KB_KINDS, listKbItems } from '@identity/services';
import Link from 'next/link';
import { StaffShell } from '@/components/staff/StaffShell';
import { query, type SearchParams } from '@/lib/server/page';
import { requireStaff } from '@/lib/server/staff';
import { KIND_LABELS } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Rules' };

const FRESHNESS = {
  unverified: 'bg-amber-50 text-amber-700',
  fresh: 'bg-emerald-50 text-emerald-700',
  stale: 'bg-orange-50 text-orange-700',
  rechecking: 'bg-coral-50 text-coral-700',
} as const;

/** M13-AC-1.1 · Every knowledge-base item with its version, status and freshness. */
export default async function RulesPage({ searchParams }: { searchParams: SearchParams }) {
  const { actor, s, can } = await requireStaff('rules.read');
  const q = await query(searchParams);
  const items = await listKbItems(s, actor);
  const kinds = KB_KINDS.filter((k) => !q.kind || q.kind === k);
  return (
    <StaffShell name={actor.name} roles={[...actor.roles]} can={can} title="Rules and knowledge base">
      <p>Changes are made as new versions. Citizens see a change only after it is published. Fees and links need a second person to publish.</p>
      {can('rules.edit') && (
        <Link href="/staff/rules/new" className="btn-secondary">
          New item
        </Link>
      )}
      {kinds.map((kind) => {
        const rows = items.filter((i) => i.kind === kind);
        if (rows.length === 0) return null;
        return (
          <section key={kind} className="space-y-2" aria-labelledby={`k-${kind}`}>
            <h2 id={`k-${kind}`} className="text-xl font-bold">
              {KIND_LABELS[kind]}
            </h2>
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
              <table className="w-full border-collapse bg-white" data-testid={`kb-${kind}`}>
                <thead>
                  <tr className="border-b-2 border-line-200">
                    {['Item', 'Effective', 'Drafts', 'Last verified', 'Owner'].map((h) => (
                      <th key={h} scope="col" className="p-2 text-start">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((i) => (
                    <tr key={i.key} className="border-b border-line-200" data-key={i.key}>
                      <td className="p-2">
                        <Link href={`/staff/rules/${i.kind}/${encodeURIComponent(i.key)}`} className="font-semibold">
                          {i.label || i.key}
                        </Link>
                        <span className="block font-mono text-[0.8125rem] text-slate-500">{i.key}</span>
                      </td>
                      <td className="p-2">{i.effective ? `v${i.effective.version} · ${i.effective.status.replace('_', ' ')}` : 'Withdrawn'}</td>
                      <td className="p-2">{i.drafts || '—'}</td>
                      <td className="p-2">
                        {i.freshness ? (
                          <span className={`rounded-full px-2 py-0.5 text-[0.8125rem] font-bold ${FRESHNESS[i.freshness]}`}>
                            {i.lastVerified ?? 'never'} · {i.freshness}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td className="p-2">{i.owner ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </StaffShell>
  );
}
