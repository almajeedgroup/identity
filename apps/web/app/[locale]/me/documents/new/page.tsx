import Link from 'next/link';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { localeOf, type LocaleParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** M17-AC-1.1 · Any of the 11 document types (F02 catalogue). */
export default async function NewDocumentPage({ params }: { params: LocaleParams }) {
  const { locale, t } = await localeOf(params);
  const { s } = await requireFullCheck(locale);
  const { kb } = await s.knowledge();
  return (
    <div className="space-y-6">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('docs.chooseTitle')}</h1>
      <p>{t('docs.chooseHint')}</p>
      <ul className="grid gap-3 sm:grid-cols-2">
        {kb.catalogue.map((c) => (
          <li key={c.kind}>
            <Link href={`/${locale}/me/documents/new/${c.kind}`} className="choice font-bold text-ink-900 no-underline">
              {c.label[locale]}
            </Link>
          </li>
        ))}
      </ul>
      <Link href={`/${locale}/me/documents`} className="btn-quiet">
        {t('docs.back')}
      </Link>
    </div>
  );
}
