import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translate } from '@/i18n/translate';
import { LanguageSwitcher } from './LanguageSwitcher';
import { LargeTextToggle } from './LargeTextToggle';

export function SiteHeader({ locale, t }: { locale: Locale; t: Translate }) {
  return (
    <header className="border-b border-line-200 bg-white">
      <div className="mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-x-3 gap-y-1 px-4 py-2">
        <Link href={`/${locale}`} className="flex min-h-12 items-center gap-2 text-ink-900 no-underline">
          <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-lg font-extrabold text-white">
            i
          </span>
          <span className="text-xl font-extrabold tracking-tight" lang="en">
            {t('brand.name')}
          </span>
        </Link>
        <div className="ms-auto flex items-center gap-2">
          <LargeTextToggle />
          <LanguageSwitcher />
        </div>
      </div>
    </header>
  );
}
