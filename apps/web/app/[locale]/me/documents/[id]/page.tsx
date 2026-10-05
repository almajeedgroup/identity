import type { DocumentKind } from '@identity/content';
import { canonicalJson } from '@identity/db';
import { displayValue } from '@identity/engine';
import { getDocument } from '@identity/services';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { StatusChip } from '@/components/StatusChip';
import { Banner } from '@/components/fullcheck/Banner';
import { DocumentFieldsForm, type ReadField } from '@/components/fullcheck/DocumentFieldsForm';
import { SubmitButton } from '@/components/fullcheck/SubmitButton';
import { changeKindAction, confirmDocumentAction, deleteDocumentAction, editDocumentAction } from '@/lib/server/actions';
import { PersonBar } from '@/components/fullcheck/PersonBar';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { errorMessage, formatDate, localeOf, query, type SearchParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** M17 US3 (verify) and US5 (view, edit as a new version, delete). */
export default async function DocumentPage({ params, searchParams }: { params: Promise<{ locale: string; id: string }>; searchParams: SearchParams }) {
  const { locale, t } = await localeOf(params);
  const { id } = await params;
  const q = await query(searchParams);
  const { s, userId, person, hasFamily } = await requireFullCheck(locale);
  const doc = await getDocument(s, userId, id);
  if (!doc) notFound();
  const { kb } = await s.knowledge();
  const labelOf = (kind: string) => kb.catalogue.find((c) => c.kind === kind)?.label[locale] ?? kind;
  const label = labelOf(doc.kind);
  const error = errorMessage(t, q.error);
  const upload = doc.uploads[0];
  const fieldLabel = (field: string) => (field === 'relative_type' ? t('fields.relative_type') : t(`fields.${field}`));
  const values = Object.fromEntries(doc.fields.map((f) => [f.field, f.confirmed ?? f.original]));

  const fileLink = upload && (
    <div className="space-y-3">
      {upload.mime.startsWith('image/') && (
        // eslint-disable-next-line @next/next/no-img-element -- private, uncached file; never through an image optimiser
        <img src={`/api/files/${upload.id}`} alt={t('verify.preview')} className="max-h-96 w-full rounded-xl border border-line-200 object-contain" />
      )}
      <a href={`/api/files/${upload.id}`} target="_blank" rel="noopener" className="font-semibold">
        {t('verify.viewFile')}
      </a>
    </div>
  );

  if (doc.status !== 'verified') {
    const read: Record<string, ReadField> = Object.fromEntries(doc.fields.map((f) => [f.field, { original: f.original, confidence: f.confidence }]));
    const looksLike = doc.detectedKind && doc.detectedKind !== doc.kind ? doc.detectedKind : null;
    return (
      <div className="space-y-6">
        <h1 className="text-[2rem] leading-tight font-extrabold">{t('verify.title', { document: label })}</h1>
        <PersonBar t={t} locale={locale} person={person} hasFamily={hasFamily} />
        <p className="text-lg">{t('verify.intro')}</p>
        {error && <Banner tone="error">{error}</Banner>}
        {looksLike && (
          <div className="space-y-3 rounded-xl border-2 border-amber-400 bg-amber-50 p-4" data-testid="looks-like">
            <p className="font-bold text-amber-700">{t('verify.looksLike', { document: labelOf(looksLike), chosen: label })}</p>
            <form action={changeKindAction}>
              <input type="hidden" name="locale" value={locale} />
              <input type="hidden" name="id" value={doc.id} />
              <input type="hidden" name="kind" value={looksLike} />
              <SubmitButton variant="secondary">{t('verify.switch', { document: labelOf(looksLike) })}</SubmitButton>
            </form>
          </div>
        )}
        {fileLink}
        <form action={confirmDocumentAction} className="card space-y-5">
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="id" value={doc.id} />
          <DocumentFieldsForm t={t} locale={locale} kb={kb} kind={doc.kind as DocumentKind} values={values} read={read} numberMode="verify" numberMasked={doc.numberMasked} />
          <SubmitButton>{t('verify.confirm')}</SubmitButton>
        </form>
        <DeleteBox t={t} locale={locale} id={doc.id} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="text-[2rem] leading-tight font-extrabold">{label}</h1>
        <PersonBar t={t} locale={locale} person={person} hasFamily={hasFamily} />
        <StatusChip status="ok" label={t('docs.status.verified')} />
      </div>
      {q.confirmed && <Banner tone="success">{t('verify.confirmed')}</Banner>}
      {q.saved && <Banner tone="success">{t('doc.saved')}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      {q.edit ? (
        <section className="card space-y-4" aria-labelledby="edit-title">
          <h2 id="edit-title" className="text-xl font-bold">
            {t('doc.editTitle')}
          </h2>
          <p>{t('doc.editHint')}</p>
          <form action={editDocumentAction} className="space-y-5">
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="id" value={doc.id} />
            <DocumentFieldsForm t={t} locale={locale} kb={kb} kind={doc.kind as DocumentKind} values={values} numberMode="edit" numberMasked={doc.numberMasked} />
            <SubmitButton>{t('doc.saveEdit')}</SubmitButton>
          </form>
          <Link href={`/${locale}/me/documents/${doc.id}`} className="btn-quiet">
            {t('doc.cancel')}
          </Link>
        </section>
      ) : (
        <section className="card space-y-4">
          <dl className="space-y-3" data-testid="fields">
            {doc.fields
              .filter((f) => f.field !== 'relative_type')
              .map((f) => {
                const relation = f.field === 'relative_name' ? doc.fields.find((r) => r.field === 'relative_type')?.confirmed : null;
                const differs = f.confirmed !== null && canonicalJson(f.confirmed) !== canonicalJson(f.original);
                return (
                  <div key={f.field} data-field={f.field}>
                    <dt className="field-label">
                      {fieldLabel(f.field)}
                      {typeof relation === 'string' ? ` (${t(`fields.relation.${relation}`)})` : ''}
                    </dt>
                    <dd className="text-lg font-semibold">{f.confirmed !== null ? displayValue(f.confirmed) : <span className="text-slate-500">{t('doc.notEntered')}</span>}</dd>
                    {differs && <dd className="text-[0.875rem] text-slate-500">{t('doc.documentSays', { value: displayValue(f.original) })}</dd>}
                  </div>
                );
              })}
            {doc.numberMasked && (
              <div>
                <dt className="field-label">{t('docs.number')}</dt>
                <dd className="text-lg font-semibold">
                  <bdi dir="ltr">{doc.numberMasked}</bdi>
                </dd>
              </div>
            )}
          </dl>
          <Link href={`/${locale}/me/documents/${doc.id}?edit=1`} className="btn-secondary">
            {t('doc.edit')}
          </Link>
        </section>
      )}

      {upload && (
        <section className="space-y-2">
          {fileLink}
          {upload.purgeAfter && <p className="text-[0.875rem] text-slate-500">{t('verify.fileKept', { date: formatDate(upload.purgeAfter) })}</p>}
        </section>
      )}

      <section className="space-y-2" aria-labelledby="history-title">
        <h2 id="history-title" className="text-lg font-bold">
          {t('doc.versions')}
        </h2>
        <ol className="space-y-1" data-testid="versions">
          {doc.versions.map((v) => (
            <li key={v.version}>
              {t('doc.version', { version: v.version })} · {t(`doc.versionReason.${v.reason}`)} · {formatDate(v.createdAt)}
            </li>
          ))}
        </ol>
      </section>

      <DeleteBox t={t} locale={locale} id={doc.id} />
      <Link href={`/${locale}/me/documents`} className="btn-quiet">
        {t('docs.back')}
      </Link>
    </div>
  );
}

function DeleteBox({ t, locale, id }: { t: (key: string) => string; locale: string; id: string }) {
  return (
    <details className="rounded-xl border-2 border-line-200 bg-white p-4">
      <summary className="cursor-pointer font-bold text-coral-700">{t('doc.delete')}</summary>
      <form action={deleteDocumentAction} className="mt-3 space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={id} />
        <p>{t('doc.deleteText')}</p>
        <SubmitButton variant="danger">{t('doc.deleteConfirm')}</SubmitButton>
      </form>
    </details>
  );
}
