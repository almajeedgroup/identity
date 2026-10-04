'use client';

import { useEffect, useState } from 'react';
import { useI18n } from '@/i18n/I18nProvider';
import { LARGE_TEXT_KEY, readStorage, writeStorage } from '@/lib/storage';

/** F03-AC-3.1 · One tap, remembered on this device. */
export function LargeTextToggle() {
  const { t } = useI18n();
  const [on, setOn] = useState(false);

  useEffect(() => {
    setOn(readStorage(LARGE_TEXT_KEY) === 'true');
  }, []);

  const toggle = () => {
    const next = !on;
    setOn(next);
    writeStorage(LARGE_TEXT_KEY, String(next));
    document.documentElement.dataset.largeText = String(next);
  };

  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={toggle}
      className="flex min-h-12 min-w-12 items-center justify-center gap-1 rounded-xl border border-line-200 bg-white px-3 font-bold aria-pressed:border-emerald-600 aria-pressed:bg-emerald-50"
    >
      <span aria-hidden="true">
        A<span className="text-[1.25em]">A</span>
      </span>
      <span className="sr-only sm:not-sr-only">{t('nav.largeText')}</span>
    </button>
  );
}

/** Applied before first paint so large text doesn't flash. */
export const largeTextBootScript = `try{if(localStorage.getItem('${LARGE_TEXT_KEY}')==='true'){document.documentElement.dataset.largeText='true'}}catch(e){}`;
