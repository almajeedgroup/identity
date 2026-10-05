import { listProfiles, runFullCheck, unreadCount } from '@identity/services';
import Link from 'next/link';
import { Banner } from '@/components/fullcheck/Banner';
import { ConsentNotice } from '@/components/fullcheck/ConsentNotice';
import type { Translate } from '@/i18n/translate';
import { signOutAction } from '@/lib/server/actions';
import { PersonBar } from '@/components/fullcheck/PersonBar';
import { citizenContext, personProfile } from '@/lib/server/fullcheck';
import { errorMessage, localeOf, ltr, query, type LocaleParams, type SearchParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

export default async function MePage({ params, searchParams }: { params: LocaleParams; searchParams: SearchParams }) {
  const { locale, t } = await localeOf(params);
  const q = await query(searchParams);
  const { citizen, s, consents } = await citizenContext(locale);
  const error = errorMessage(t, q.error);

  if (!consents.has('full_check')) {
    return (
      <div className="space-y-6">
        {q.done === 'withdrawn' && <Banner tone="success">{t('me.withdrawn')}</Banner>}
        {error && <Banner tone="error">{error}</Banner>}
        <ConsentNotice t={t} locale={locale} purpose="full_check" next={`/${locale}/me`} />
        <SignOut t={t} locale={locale} />
      </div>
    );
  }

  const [person, profiles] = await Promise.all([personProfile(s.db, citizen.user.id), listProfiles(s.db, citizen.user.id)]);
  const [check, unread] = await Promise.all([runFullCheck(s, citizen.user.id, person.id), unreadCount(s, citizen.user.id)]);
  const confirmed = check.analysis.documents.length;
  const nav = [
    ['documents', 'navDocuments'],
    ['report', 'navReport'],
    ['roadmap', 'navRoadmap'],
    ['cases', 'navCases'],
    ['profile', 'navProfile'],
    ['family', 'navFamily'],
    ['settings', 'navSettings'],
  ] as const;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-[2rem] leading-tight font-extrabold">{t('me.title')}</h1>
        <p className="text-slate-500">{t('me.signedInAs', { mobile: ltr(citizen.user.mobile) })}</p>
      </div>
      {error && <Banner tone="error">{error}</Banner>}
      <PersonBar t={t} locale={locale} person={person} hasFamily={profiles.length > 1} />

      <Link href={`/${locale}/me/notifications`} className="btn-secondary" data-testid="notifications-link">
        {unread > 0 ? t('notify.unread', { count: unread }) : t('notify.title')}
      </Link>

      <section className="card space-y-3" aria-labelledby="summary-title" data-testid="summary">
        <h2 id="summary-title" className="text-lg font-bold">
          {t('me.summary')}
        </h2>
        {confirmed === 0 && check.pending === 0 ? (
          <>
            <p>{t('me.empty')}</p>
            <Link href={`/${locale}/me/documents/new`} className="btn-primary">
              {t('me.addFirst')}
            </Link>
          </>
        ) : (
          <ul className="space-y-2">
            <li>{t('me.documents', { count: confirmed })}</li>
            {check.pending > 0 && (
              <li>
                <Link href={`/${locale}/me/documents`} className="font-semibold">
                  {t('me.pending', { count: check.pending })}
                </Link>
              </li>
            )}
            <li className="font-bold">
              {check.analysis.issueCount > 0 ? (
                <Link href={`/${locale}/me/report`}>{t('me.issues', { count: check.analysis.issueCount })}</Link>
              ) : (
                t('me.noIssues')
              )}
            </li>
          </ul>
        )}
      </section>

      <nav aria-label={t('me.title')}>
        <ul className="grid gap-3 sm:grid-cols-2">
          {nav.map(([path, key]) => (
            <li key={path}>
              <Link href={`/${locale}/me/${path}`} className="card block h-full space-y-1 text-ink-900 no-underline hover:border-emerald-600">
                <span className="block text-lg font-bold text-emerald-700">{t(`me.${key}`)}</span>
                <span className="block">{t(`me.${key}Text`)}</span>
              </Link>
            </li>
          ))}
        </ul>
      </nav>

      <SignOut t={t} locale={locale} />
    </div>
  );
}

function SignOut({ t, locale }: { t: Translate; locale: string }) {
  return (
    <form action={signOutAction}>
      <input type="hidden" name="locale" value={locale} />
      <button type="submit" className="btn-secondary">
        {t('signIn.signOut')}
      </button>
    </form>
  );
}
