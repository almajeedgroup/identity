import Link from 'next/link';
import { isLocale, type Locale } from '@/i18n/config';
import { getMessages } from '@/i18n/messages';
import { createTranslator } from '@/i18n/translate';

/** Placeholder until M05 Book Appointment (S3). */
export default async function HelpPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = (isLocale(raw) ? raw : 'en') as Locale;
  const t = createTranslator(locale, getMessages(locale));
  return (
    <div className="space-y-5">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('help.title')}</h1>
      <p className="text-lg">{t('help.intro')}</p>
      <p className="card">{t('help.soon')}</p>
      <p className="rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-700">{t('help.bring')}</p>
      <p className="rounded-xl border-2 border-coral-500 bg-coral-50 p-4 font-bold text-coral-700">{t('trust.otpWarning')}</p>
      <Link href={`/${locale}`} className="btn-secondary">
        {t('help.backHome')}
      </Link>
    </div>
  );
}
