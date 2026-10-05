import { DOCUMENT_KINDS, type DocumentKind } from '@identity/content';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Banner } from '@/components/fullcheck/Banner';
import { ConsentNotice } from '@/components/fullcheck/ConsentNotice';
import { DocumentFieldsForm } from '@/components/fullcheck/DocumentFieldsForm';
import { SubmitButton } from '@/components/fullcheck/SubmitButton';
import { addTypedDocumentAction, uploadDocumentAction } from '@/lib/server/actions';
import { PersonBar } from '@/components/fullcheck/PersonBar';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { errorMessage, localeOf, query, type SearchParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** M17 US1 and US2 · Type the details, or upload a photo or PDF (after the upload notice). */
export default async function AddDocumentPage({ params, searchParams }: { params: Promise<{ locale: string; kind: string }>; searchParams: SearchParams }) {
  const { locale, t } = await localeOf(params);
  const { kind } = await params;
  if (!(DOCUMENT_KINDS as readonly string[]).includes(kind)) notFound();
  const q = await query(searchParams);
  const { s, consents, person, hasFamily } = await requireFullCheck(locale);
  const { kb } = await s.knowledge();
  const entry = kb.catalogue.find((c) => c.kind === kind);
  if (!entry) notFound();
  const label = entry.label[locale];
  const error = errorMessage(t, q.error);
  const here = `/${locale}/me/documents/new/${kind}`;

  return (
    <div className="space-y-6">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('docs.addTitle', { document: label })}</h1>
      <PersonBar t={t} locale={locale} person={person} hasFamily={hasFamily} />
      {error && <Banner tone="error">{error}</Banner>}

      <section className="card space-y-4" aria-labelledby="type-title">
        <h2 id="type-title" className="text-xl font-bold">
          {t('docs.typeTitle')}
        </h2>
        <p>{t('docs.typeHint')}</p>
        <form action={addTypedDocumentAction} className="space-y-5">
          <input type="hidden" name="person" value={person.id} />
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="kind" value={kind} />
          <DocumentFieldsForm t={t} locale={locale} kb={kb} kind={kind as DocumentKind} numberMode="new" />
          <SubmitButton>{t('docs.save')}</SubmitButton>
        </form>
      </section>

      {consents.has('uploads') ? (
        <section className="card space-y-4" aria-labelledby="upload-title">
          <h2 id="upload-title" className="text-xl font-bold">
            {t('docs.uploadTitle')}
          </h2>
          <p>{t('docs.uploadHint')}</p>
          {entry.numberStorage === 'last4_only' && <p className="font-bold text-coral-700">{t('consent.uploads.aadhaar')}</p>}
          <form action={uploadDocumentAction} className="space-y-4">
            <input type="hidden" name="person" value={person.id} />
            <input type="hidden" name="locale" value={locale} />
            <input type="hidden" name="kind" value={kind} />
            <div>
              <label className="field-label" htmlFor="file">
                {t('docs.file')}
              </label>
              <input id="file" name="file" type="file" accept="image/jpeg,image/png,application/pdf" className="field-input py-3" required />
            </div>
            <SubmitButton pendingText={t('docs.uploadWait')}>{t('docs.upload')}</SubmitButton>
          </form>
        </section>
      ) : (
        <ConsentNotice t={t} locale={locale} purpose="uploads" next={here} />
      )}

      <Link href={`/${locale}/me/documents/new`} className="btn-quiet">
        {t('docs.back')}
      </Link>
    </div>
  );
}
