import { isKbKind, KB_KINDS, templateFor } from '@identity/services';
import Link from 'next/link';
import { DraftEditor } from '@/components/staff/DraftEditor';
import { StaffShell } from '@/components/staff/StaffShell';
import { query, type SearchParams } from '@/lib/server/page';
import { requireStaff } from '@/lib/server/staff';
import { KIND_LABELS } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'New item' };

/** M13-FR-01 / M13-AC-5.1 · A new item starts from a template and is saved as a draft. */
export default async function NewItemPage({ searchParams }: { searchParams: SearchParams }) {
  const { actor, can } = await requireStaff('rules.edit');
  const q = await query(searchParams);
  const kind = q.kind && isKbKind(q.kind) ? q.kind : null;
  return (
    <StaffShell name={actor.name} roles={[...actor.roles]} can={can} title={kind ? `New: ${KIND_LABELS[kind]}` : 'New item'}>
      {kind ? (
        <DraftEditor kind={kind} initial={JSON.stringify(templateFor(kind), null, 2)} />
      ) : (
        <ul className="grid gap-2 sm:grid-cols-2">
          {KB_KINDS.filter((k) => !['place_variants', 'address_abbreviations'].includes(k)).map((k) => (
            <li key={k}>
              <Link href={`/staff/rules/new?kind=${k}`} className="choice font-bold text-ink-900 no-underline">
                {KIND_LABELS[k]}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </StaffShell>
  );
}
