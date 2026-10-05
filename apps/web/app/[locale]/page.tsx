import { seedBundle } from '@identity/content';
import Link from 'next/link';
import { LastCheckSummary } from '@/components/LastCheckSummary';
import { isLocale, type Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { createTranslator } from '@/i18n/translate';

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : 'en') as Locale;
  const t = createTranslator(locale, getMessages(locale));

  return (
    <div className="space-y-8">
      <section className="space-y-4">
        <h1 className="text-[2rem] leading-tight font-extrabold">{t('home.title')}</h1>
        <p className="text-lg">{t('home.intro')}</p>
        <Link href={`/${locale}/check`} className="btn-primary">
          {t('home.start')}
        </Link>
        <p className="flex items-center gap-2 font-semibold text-emerald-700">
          <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <rect x="4" y="9" width="12" height="9" rx="2" />
            <path d="M7 9V6a3 3 0 016 0v3" />
          </svg>
          {t('home.privacy')}
        </p>
      </section>

      <LastCheckSummary />

      <section className="card space-y-2">
        <h2 className="text-lg font-bold">{t('home.documentsTitle')}</h2>
        <ul className="flex flex-wrap gap-2">
          {seedBundle.documents.map((d) => (
            <li key={d.id} className="rounded-full bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
              {d.label[locale]}
            </li>
          ))}
        </ul>
      </section>

      <section className="card space-y-3" data-testid="full-check-entry">
        <h2 className="text-lg font-bold">{t('home.fullCheckTitle')}</h2>
        <p>{t('home.fullCheckText')}</p>
        <Link href={`/${locale}/me`} className="btn-secondary">
          {t('home.fullCheckLink')}
        </Link>
      </section>

      <section className="card space-y-3">
        <h2 className="text-lg font-bold">{t('home.assistedTitle')}</h2>
        <p>{t('home.assistedText')}</p>
        <Link href={`/${locale}/help`} className="font-semibold">
          {t('home.assistedLink')}
        </Link>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">{t('trust.heading')}</h2>
        <ul className="list-disc space-y-1 ps-6">
          <li>{t('trust.notGovernment')}</li>
          <li>{t('trust.officialOnly')}</li>
          <li>{t('trust.feesToAuthority')}</li>
          <li className="font-bold">{t('trust.otpWarning')}</li>
        </ul>
      </section>
    </div>
  );
}
