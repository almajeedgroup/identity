import type { Translate } from '@/i18n/translate';

/** C-01 / F10 · The disclaimer appears on every page. */
export function SiteFooter({ t }: { t: Translate }) {
  return (
    <footer className="mt-10 border-t border-line-200 bg-white">
      <div className="mx-auto max-w-2xl space-y-3 px-4 py-6 text-[0.9375rem]">
        <p data-testid="disclaimer" className="text-ink-900">
          {t('trust.disclaimer')}
        </p>
        <p className="text-slate-500">
          <span lang="en" className="font-bold text-emerald-700">
            {t('brand.name')}
          </span>{' '}
          · {t('brand.unit')} · {t('brand.tagline')}
        </p>
      </div>
    </footer>
  );
}
