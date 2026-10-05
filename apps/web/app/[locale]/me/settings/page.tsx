import { consentRecords } from '@identity/services';
import Link from 'next/link';
import { Banner } from '@/components/fullcheck/Banner';
import { SubmitButton } from '@/components/fullcheck/SubmitButton';
import type { Translate } from '@/i18n/translate';
import { closeAccountAction, signOutAction, withdrawFullCheckAction, withdrawUploadsAction } from '@/lib/server/actions';
import { citizenContext } from '@/lib/server/fullcheck';
import { errorMessage, formatDate, localeOf, query, type LocaleParams, type SearchParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** F06 US3 · What the citizen agreed to, and withdrawal and deletion that really delete. */
export default async function SettingsPage({ params, searchParams }: { params: LocaleParams; searchParams: SearchParams }) {
  const { locale, t } = await localeOf(params);
  const q = await query(searchParams);
  const { p, userId } = await citizenContext(locale);
  const consents = await consentRecords(p.db, userId);
  const consent = (purpose: string) => consents.find((c) => c.purpose === purpose);
  const error = errorMessage(t, q.error);
  const status = (purpose: string) => {
    const c = consent(purpose);
    return <p className="text-slate-500">{c ? t('settings.agreed', { date: formatDate(c.grantedAt), version: c.noticeVersion }) : t('settings.notAgreed')}</p>;
  };

  return (
    <div className="space-y-6">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('settings.title')}</h1>
      <p>{t('settings.intro')}</p>
      {q.done === 'uploads' && <Banner tone="success">{t('settings.uploadsDone')}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}

      <section className="card space-y-3" aria-labelledby="uploads-title">
        <h2 id="uploads-title" className="text-xl font-bold">
          {t('settings.uploadsTitle')}
        </h2>
        {status('uploads')}
        {consent('uploads') && <DangerForm t={t} locale={locale} action={withdrawUploadsAction} text={t('settings.withdrawUploadsText')} button={t('settings.withdrawUploads')} />}
      </section>

      <section className="card space-y-3" aria-labelledby="fullcheck-title">
        <h2 id="fullcheck-title" className="text-xl font-bold">
          {t('settings.fullCheckTitle')}
        </h2>
        {status('full_check')}
        {consent('full_check') && <DangerForm t={t} locale={locale} action={withdrawFullCheckAction} text={t('settings.withdrawFullCheckText')} button={t('settings.withdrawFullCheck')} />}
      </section>

      <section className="card space-y-3" aria-labelledby="close-title">
        <h2 id="close-title" className="text-xl font-bold">
          {t('settings.closeTitle')}
        </h2>
        <DangerForm t={t} locale={locale} action={closeAccountAction} text={t('settings.closeText')} button={t('settings.close')} />
      </section>

      <Link href={`/${locale}/privacy`} className="font-semibold">
        {t('settings.privacy')}
      </Link>
      <form action={signOutAction}>
        <input type="hidden" name="locale" value={locale} />
        <button type="submit" className="btn-secondary">
          {t('signIn.signOut')}
        </button>
      </form>
    </div>
  );
}

function DangerForm({ t, locale, action, text, button }: { t: Translate; locale: string; action: (fd: FormData) => Promise<void>; text: string; button: string }) {
  return (
    <details className="rounded-xl border-2 border-line-200 p-3">
      <summary className="cursor-pointer font-bold text-coral-700">{button}</summary>
      <form action={action} className="mt-3 space-y-3">
        <input type="hidden" name="locale" value={locale} />
        <p>{text}</p>
        <label className="choice">
          <input type="checkbox" name="confirm" value="yes" required />
          <span>{t('settings.confirm')}</span>
        </label>
        <SubmitButton variant="danger">{button}</SubmitButton>
      </form>
    </details>
  );
}
