import { diffJson, getKbItem, needsSecondPerson, type KbVersionView } from '@identity/services';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { DraftEditor } from '@/components/staff/DraftEditor';
import { Notice, StaffShell } from '@/components/staff/StaffShell';
import { query, type SearchParams } from '@/lib/server/page';
import { discardAction, publishAction, rollbackAction, verifyAction, withdrawAction } from '@/lib/server/staff-actions';
import { requireStaff } from '@/lib/server/staff';
import { formatDateTime, KIND_LABELS, staffError } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Item' };

const show = (v: unknown) => (v === undefined ? '—' : JSON.stringify(v));

/** M13 US2–US4 · Versions, differences, publish, withdraw, verify and edit one item. */
export default async function KbItemPage({ params, searchParams }: { params: Promise<{ kind: string; key: string }>; searchParams: SearchParams }) {
  const { kind, key: rawKey } = await params;
  const key = decodeURIComponent(rawKey);
  const { actor, s, can } = await requireStaff('rules.read');
  const item = await getKbItem(s, actor, kind, key);
  if (!item) notFound();
  const q = await query(searchParams);
  const { kb } = await s.knowledge();
  const effective = item.versions.find((v) => v.version === item.effectiveVersion) ?? null;
  const hasMeta = !!effective && typeof effective.data === 'object' && effective.data !== null && 'meta' in effective.data;
  const error = staffError(q.error);
  const today = new Date().toISOString().slice(0, 10);
  const hidden = (version?: number) => (
    <>
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="key" value={key} />
      {version !== undefined && <input type="hidden" name="version" value={version} />}
    </>
  );

  const versionCard = (v: KbVersionView) => {
    const isDraft = v.status === 'draft';
    const changes = isDraft ? diffJson(effective?.data ?? {}, v.data) : [];
    return (
      <li key={v.version} className="card space-y-3" data-version={v.version} data-status={v.status}>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-lg font-bold">
            Version {v.version} · {v.status.replace('_', ' ')}
            {v.version === item.effectiveVersion && <span className="ms-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.8125rem] text-emerald-700">effective</span>}
          </h3>
          <span className="text-[0.875rem] text-slate-500">
            {v.createdBy ?? 'Unknown'} · {formatDateTime(v.createdAt)}
          </span>
        </div>
        {v.note && <p>{v.note}</p>}
        {v.publishedBy && v.publishedAt && (
          <p className="text-[0.875rem]">
            {v.status === 'withdrawn' ? 'Withdrawn' : 'Published'} by {v.publishedBy} · {formatDateTime(v.publishedAt)}
          </p>
        )}
        {v.verifiedOn && (
          <p className="text-[0.875rem] font-semibold text-emerald-700" data-testid="verified">
            Verified on {v.verifiedOn} by {v.verifiedBy} against {v.verifiedSource}
          </p>
        )}
        {isDraft && (
          <div className="space-y-2">
            <h4 className="font-bold">Changes from the effective version</h4>
            {needsSecondPerson(changes) && <p className="font-semibold text-amber-700">Changes a fee or a link — a different publisher must publish it.</p>}
            <div className="overflow-x-auto" tabIndex={0} role="region" aria-label="Scrollable table">
              <table className="w-full border-collapse font-mono text-[0.8125rem]" data-testid="diff">
                <thead>
                  <tr className="border-b-2 border-line-200">
                    <th scope="col" className="p-1 text-start">
                      Path
                    </th>
                    <th scope="col" className="p-1 text-start">
                      Before
                    </th>
                    <th scope="col" className="p-1 text-start">
                      After
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {changes.map((c) => (
                    <tr key={c.path} className="border-b border-line-200 align-top">
                      <td className="p-1">{c.path}</td>
                      <td className="p-1 break-all text-coral-700">{show(c.before)}</td>
                      <td className="p-1 break-all text-emerald-700">{show(c.after)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex flex-wrap gap-2">
              {can('rules.publish') && (
                <form action={publishAction}>
                  {hidden(v.version)}
                  <button type="submit" className="btn-primary">
                    Publish version {v.version}
                  </button>
                </form>
              )}
              {can('rules.edit') && (
                <form action={discardAction}>
                  {hidden(v.version)}
                  <button type="submit" className="btn-secondary">
                    Discard draft
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
        {!isDraft && v.version !== item.effectiveVersion && can('rules.edit') && (
          <form action={rollbackAction}>
            {hidden(v.version)}
            <button type="submit" className="btn-quiet">
              Make a draft from this version
            </button>
          </form>
        )}
        <details>
          <summary className="cursor-pointer font-semibold text-sky-600">Show JSON</summary>
          <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-mist-50 p-3 text-[0.75rem]" dir="ltr">
            {JSON.stringify(v.data, null, 2)}
          </pre>
        </details>
      </li>
    );
  };

  return (
    <StaffShell name={actor.name} roles={[...actor.roles]} can={can} title={item.label || key}>
      <p className="text-slate-500">
        <Link href={`/staff/rules?kind=${kind}`} className="underline">{KIND_LABELS[kind]}</Link> · <span className="font-mono">{key}</span> · effective version{' '}
        {item.effectiveVersion ?? 'none (withdrawn)'}
      </p>
      {error && (
        <Notice tone="error">
          {error}
          {q.detail && <span className="mt-1 block font-mono text-[0.8125rem]">{q.detail}</span>}
        </Notice>
      )}
      {q.saved && <Notice tone="success">Draft version {q.saved} saved. It is not visible to citizens until published.</Notice>}
      {q.published && <Notice tone="success">Version {q.published} is published and now used for citizens.</Notice>}
      {q.discarded && <Notice tone="success">Draft version {q.discarded} discarded.</Notice>}
      {q.withdrawn && <Notice tone="success">The item is withdrawn.</Notice>}
      {q.verified && <Notice tone="success">Verification recorded.</Notice>}

      {effective && hasMeta && can('rules.edit') && (
        <section className="card space-y-3" aria-labelledby="verify-title">
          <h2 id="verify-title" className="text-xl font-bold">
            Record a verification
          </h2>
          <p>Confirm that version {effective.version} matches the official source today. The content does not change.</p>
          <form action={verifyAction} className="flex flex-wrap items-end gap-3">
            {hidden()}
            <div>
              <label className="field-label" htmlFor="date">
                Checked on
              </label>
              <input id="date" name="date" type="date" className="field-input" defaultValue={today} max={today} required />
            </div>
            <div className="grow">
              <label className="field-label" htmlFor="source">
                Against
              </label>
              <select id="source" name="source" className="field-input" required>
                {kb.sources.map((src) => (
                  <option key={src.id} value={src.id}>
                    {src.title.en} ({new URL(src.url).hostname})
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn-secondary">
              Record verification
            </button>
          </form>
        </section>
      )}

      <section className="space-y-3" aria-labelledby="versions-title">
        <h2 id="versions-title" className="text-xl font-bold">
          Versions
        </h2>
        <ol className="space-y-3">{item.versions.map(versionCard)}</ol>
      </section>

      {can('rules.edit') && (
        <section className="card space-y-3" aria-labelledby="edit-title">
          <h2 id="edit-title" className="text-xl font-bold">
            Change this item
          </h2>
          <p>Saving creates a new draft version. Version numbers, the rule history and verification are filled in for you.</p>
          <DraftEditor kind={kind} itemKey={key} initial={JSON.stringify((effective ?? item.versions[0]!).data, null, 2)} />
        </section>
      )}

      {effective && can('rules.publish') && (
        <details className="rounded-xl border-2 border-line-200 bg-white p-4">
          <summary className="cursor-pointer font-bold text-coral-700">Withdraw this item</summary>
          <form action={withdrawAction} className="mt-3 space-y-3">
            {hidden()}
            <p>Citizens stop seeing it at once. Items that others depend on cannot be withdrawn.</p>
            <div>
              <label className="field-label" htmlFor="reason">
                Reason
              </label>
              <input id="reason" name="reason" className="field-input" required maxLength={500} />
            </div>
            <button type="submit" className="inline-flex min-h-12 items-center rounded-xl bg-coral-700 px-5 font-bold text-white">
              Withdraw
            </button>
          </form>
        </details>
      )}
    </StaffShell>
  );
}
