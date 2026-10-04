'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { LOCALE_STORAGE_KEY, localeNames, locales, type Locale } from '@/i18n/config';
import { useI18n } from '@/i18n/I18nProvider';
import { writeStorage } from '@/lib/storage';

/** F04-FR-03 · Switch language and stay on the same page. */
export function LanguageSwitcher() {
  const { locale, t } = useI18n();
  const pathname = usePathname() ?? `/${locale}`;
  const rest = pathname.replace(/^\/[^/]+/, '');
  return (
    <details className="relative">
      <summary className="flex min-h-12 cursor-pointer list-none items-center gap-2 rounded-xl border border-line-200 bg-white px-3 font-semibold">
        <svg width="18" height="18" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
          <circle cx="10" cy="10" r="8" />
          <path d="M2 10h16M10 2c2.5 2.5 2.5 13.5 0 16M10 2c-2.5 2.5-2.5 13.5 0 16" />
        </svg>
        <span className="sr-only">{t('nav.language')}: </span>
        <span lang={locale}>{localeNames[locale]}</span>
      </summary>
      <ul className="absolute end-0 z-10 mt-2 w-44 rounded-xl border border-line-200 bg-white p-1 shadow-lg">
        {locales.map((l: Locale) => (
          <li key={l}>
            <Link
              href={`/${l}${rest}`}
              lang={l}
              hrefLang={l}
              aria-current={l === locale ? 'true' : undefined}
              onClick={() => writeStorage(LOCALE_STORAGE_KEY, l)}
              className="flex min-h-12 items-center rounded-lg px-3 font-semibold text-ink-900 no-underline hover:bg-emerald-50 aria-[current=true]:bg-emerald-50"
            >
              {localeNames[l]}
            </Link>
          </li>
        ))}
      </ul>
    </details>
  );
}
