import { listDocuments } from '@identity/services';
import Link from 'next/link';
import { Banner } from '@/components/fullcheck/Banner';
import { StatusChip } from '@/components/StatusChip';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { errorMessage, localeOf, query, type LocaleParams, type SearchParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

export default async function DocumentsPage({ params, searchParams }: { params: LocaleParams; searchParams: SearchParams }) {
  const { locale, t } = await localeOf(params);
  const q = await query(searchParams);
  const { s, userId } = await requireFullCheck(locale);
  const [docs, { kb }] = await Promise.all([listDocuments(s, userId), s.knowledge()]);
  const label = (kind: string) => kb.catalogue.find((c) => c.kind === kind)?.label[locale] ?? kind;
  const error = errorMessage(t, q.error);

  return (
    <div className="space-y-6">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('docs.title')}</h1>
      {q.added && <Banner tone="success">{t('docs.added')}</Banner>}
      {q.deleted && <Banner tone="success">{t('docs.deleted')}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      <Link href={`/${locale}/me/documents/new`} className="btn-primary">
        {t('docs.add')}
      </Link>
      {docs.length === 0 ? (
        <p className="card">{t('docs.empty')}</p>
      ) : (
        <ul className="space-y-3" data-testid="documents">
          {docs.map((d) => (
            <li key={d.id}>
              <Link href={`/${locale}/me/documents/${d.id}`} className="card flex flex-wrap items-center justify-between gap-2 text-ink-900 no-underline hover:border-emerald-600">
                <span className="space-y-1">
                  <span className="block text-lg font-bold">{label(d.kind)}</span>
                  <span className="block text-[0.875rem] text-slate-500">
                    {d.source === 'upload' ? t('docs.uploaded') : t('docs.typed')}
                    {d.numberMasked && (
                      <>
                        {' · '}
                        <bdi dir="ltr">{d.numberMasked}</bdi>
                      </>
                    )}
                  </span>
                </span>
                <StatusChip status={d.status === 'verified' ? 'ok' : 'update_due'} label={t(`docs.status.${d.status}`)} />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <Link href={`/${locale}/me`} className="btn-quiet">
        {t('me.title')}
      </Link>
    </div>
  );
}
