import type { Translate } from '@/i18n/translate';

/** C-01 · An official source from the knowledge base (allowlisted at validation), with badge and domain. */
export function SourceLink({ url, label, t }: { url: string; label: string; t: Translate }) {
  const host = new URL(url).hostname;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex min-h-12 flex-wrap items-center gap-x-2 gap-y-1 rounded-xl border border-line-200 px-3 py-2 no-underline hover:bg-sky-50"
    >
      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-[0.75rem] font-bold text-emerald-700">
        <svg width="12" height="12" viewBox="0 0 16 16" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 1.5l5 2v4c0 3.2-2.2 5.6-5 7-2.8-1.4-5-3.8-5-7v-4l5-2z" strokeLinejoin="round" />
        </svg>
        {t('trust.officialLink')}
      </span>
      <span className="font-semibold text-sky-600 underline">{label}</span>
      <bdi className="text-[0.8125rem] text-slate-500" dir="ltr">
        {host}
      </bdi>
      <span className="sr-only">({t('trust.opensNewTab')})</span>
    </a>
  );
}
