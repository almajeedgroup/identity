import { caseDocuments, ServiceError, type CaseDocumentView } from '@identity/services';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StaffShell } from '@/components/staff/StaffShell';
import { requireStaff } from '@/lib/server/staff';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Citizen documents' };

const show = (v: unknown) => (v && typeof v === 'object' ? Object.values(v as Record<string, string>).filter(Boolean).join(', ') : String(v ?? '—'));

/** M09-AC-2.4 · The citizen's confirmed documents, numbers masked, for the assigned case only; audited. */
export default async function CaseDocumentsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { actor, s, can } = await requireStaff('cases.work');
  let docs: CaseDocumentView[];
  try {
    docs = await caseDocuments(s, actor, id);
  } catch (e) {
    if (e instanceof ServiceError && e.code === 'not_found') notFound();
    throw e;
  }
  const { kb } = await s.knowledge();
  return (
    <StaffShell name={actor.name} roles={[...actor.roles]} can={can} title="Citizen documents">
      <p>Every view is recorded. Use these details only for this case.</p>
      <ul className="space-y-3" data-testid="case-documents">
        {docs.map((d) => (
          <li key={d.id} className="card space-y-2">
            <h2 className="text-lg font-bold">
              {kb.catalogue.find((c) => c.kind === d.kind)?.label.en} {d.numberMasked && <span className="font-mono text-[0.9375rem]">· {d.numberMasked}</span>}
            </h2>
            <dl className="grid gap-1 sm:grid-cols-2">
              {d.fields.map((f) => (
                <div key={f.field}>
                  <dt className="field-label">{f.field.replace(/_/g, ' ')}</dt>
                  <dd>{show(f.value)}</dd>
                </div>
              ))}
            </dl>
            {d.uploads.map((u) => (
              <a key={u.id} href={`/staff/cases/${id}/documents/${u.id}`} target="_blank" rel="noopener" className="font-semibold">
                Open the uploaded file
              </a>
            ))}
          </li>
        ))}
      </ul>
      <Link href={`/staff/cases/${id}`} className="btn-secondary">
        Back to the case
      </Link>
    </StaffShell>
  );
}
