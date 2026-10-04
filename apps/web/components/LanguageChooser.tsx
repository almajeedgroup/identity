'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { LOCALE_STORAGE_KEY, directionOf, isLocale, localeNames, locales, type Locale } from '@/i18n/config';
import { readStorage, writeStorage } from '@/lib/storage';

/** F04-FR-02 · First visit: choose a language. Return visit: go straight to the stored one. */
export function LanguageChooser({ notices }: { notices: { locale: Locale; text: string }[] }) {
  const router = useRouter();
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    const stored = readStorage(LOCALE_STORAGE_KEY);
    if (isLocale(stored)) router.replace(`/${stored}`);
    else setChecked(true);
  }, [router]);

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-8 px-4 py-10" aria-busy={!checked}>
      <div className="flex items-center gap-3">
        <span aria-hidden="true" className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-600 text-xl font-extrabold text-white">
          i
        </span>
        <div>
          <p className="text-2xl font-extrabold tracking-tight">identity</p>
          <p className="text-slate-500">Valid. Correct. Yours.</p>
        </div>
      </div>
      <h1 className="text-[1.375rem] font-bold">
        Choose your language · <span lang="kn">ನಿಮ್ಮ ಭಾಷೆ ಆಯ್ಕೆಮಾಡಿ</span> · <span lang="hi">अपनी भाषा चुनें</span> ·{' '}
        <span lang="ur" dir="rtl">
          اپنی زبان چنیں
        </span>
      </h1>
      <ul className="grid gap-3" data-testid="language-choices">
        {locales.map((l) => (
          <li key={l}>
            <a
              href={`/${l}`}
              lang={l}
              hrefLang={l}
              dir={directionOf(l)}
              onClick={() => writeStorage(LOCALE_STORAGE_KEY, l)}
              className="flex min-h-14 items-center justify-center rounded-2xl border-2 border-line-200 bg-white px-5 text-xl font-bold text-ink-900 no-underline hover:border-emerald-600 hover:bg-emerald-50"
            >
              {localeNames[l]}
            </a>
          </li>
        ))}
      </ul>
      <footer className="space-y-1 border-t border-line-200 pt-4 text-[0.875rem] text-slate-500" data-testid="disclaimer">
        {notices.map((n) => (
          <p key={n.locale} lang={n.locale} dir={directionOf(n.locale)}>
            {n.text}
          </p>
        ))}
      </footer>
    </main>
  );
}
