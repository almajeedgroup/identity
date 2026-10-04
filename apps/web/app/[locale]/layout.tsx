import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { largeTextBootScript } from '@/components/LargeTextToggle';
import { SiteFooter } from '@/components/SiteFooter';
import { SiteHeader } from '@/components/SiteHeader';
import { directionOf, isLocale, locales } from '@/i18n/config';
import { I18nProvider } from '@/i18n/I18nProvider';
import { getMessages } from '@/i18n/messages';
import { createTranslator } from '@/i18n/translate';
import '../fonts';
import '../globals.css';

export const dynamicParams = false;

export function generateStaticParams() {
  return locales.map((locale) => ({ locale }));
}

type Props = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Omit<Props, 'children'>): Promise<Metadata> {
  const { locale } = await params;
  if (!isLocale(locale)) return {};
  const t = createTranslator(locale, getMessages(locale));
  return {
    title: t('meta.title'),
    description: t('meta.description'),
    alternates: { languages: Object.fromEntries(locales.map((l) => [l, `/${l}`])) },
  };
}

export default async function LocaleLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const messages = getMessages(locale);
  const t = createTranslator(locale, messages);

  return (
    <html lang={locale} dir={directionOf(locale)} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: largeTextBootScript }} />
      </head>
      <body className="font-sans">
        <I18nProvider locale={locale} messages={messages}>
          <a
            href="#main"
            className="sr-only focus:not-sr-only focus:absolute focus:start-2 focus:top-2 focus:z-20 focus:rounded-lg focus:bg-white focus:p-3"
          >
            {t('nav.skip')}
          </a>
          <SiteHeader locale={locale} t={t} />
          <main id="main" tabIndex={-1} className="mx-auto max-w-2xl px-4 py-6 outline-none">
            {children}
          </main>
          <SiteFooter t={t} />
        </I18nProvider>
      </body>
    </html>
  );
}
