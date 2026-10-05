import { STATE_INFO, type CaseState } from '@identity/domain';
import { listMyCases } from '@identity/services';
import Link from 'next/link';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { formatDate, localeOf, type LocaleParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** M04 US2 · The citizen's help requests. */
export default async function MyCasesPage({ params }: { params: LocaleParams }) {
  const { locale, t } = await localeOf(params);
  const { s, userId } = await requireFullCheck(locale);
  const [rows, { kb }] = await Promise.all([listMyCases(s, userId), s.knowledge()]);
  return (
    <div className="space-y-6">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('cases.title')}</h1>
      {rows.length === 0 ? (
        <p className="card">{t('cases.empty')}</p>
      ) : (
        <ul className="space-y-3" data-testid="cases">
          {rows.map((c) => (
            <li key={c.id}>
              <Link href={`/${locale}/me/cases/${c.id}`} className="card flex flex-wrap items-center justify-between gap-2 text-ink-900 no-underline hover:border-emerald-600">
                <span>
                  <span className="block text-lg font-bold" dir="ltr">
                    {c.caseId}
                  </span>
                  <span className="block">{kb.catalogue.find((d) => d.kind === c.documentKind)?.label[locale]}</span>
                  {c.person.relationship !== 'self' && <span className="block text-slate-500">{t('cases.forPerson', { name: c.person.name ?? '', relationship: t(`family.rel.${c.person.relationship}`) })}</span>}
                </span>
                <span className="text-end">
                  <span className="block font-bold text-emerald-700">{t(`cases.stage.${STATE_INFO[c.state as CaseState].citizenStage}`)}</span>
                  <span className="block text-[0.875rem] text-slate-500">{formatDate(c.updatedAt)}</span>
                </span>
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
