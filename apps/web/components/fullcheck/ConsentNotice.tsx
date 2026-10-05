import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translate } from '@/i18n/translate';
import { grantConsentAction } from '@/lib/server/actions';
import { SubmitButton } from './SubmitButton';

/** F06-AC-1.1 / 1.2 · The notice for one purpose; nothing is stored for it until the citizen agrees. */
export function ConsentNotice({ t, locale, purpose, next }: { t: Translate; locale: Locale; purpose: 'full_check' | 'uploads'; next: string }) {
  const key = purpose === 'full_check' ? 'fullCheck' : 'uploads';
  const points = purpose === 'full_check' ? ['keep', 'why', 'who', 'howLong', 'notGovernment'] : ['keep', 'read', 'aadhaar', 'howLong'];
  const Heading = purpose === 'full_check' ? 'h1' : 'h2';
  return (
    <section className="card space-y-4" data-testid={`consent-${purpose}`} aria-labelledby={`consent-${purpose}-title`}>
      <Heading id={`consent-${purpose}-title`} className={purpose === 'full_check' ? 'text-[2rem] leading-tight font-extrabold' : 'text-xl font-bold'}>
        {t(`consent.${key}.title`)}
      </Heading>
      <p>{t(`consent.${key}.intro`)}</p>
      <ul className="list-disc space-y-2 ps-6">
        {points.map((p) => (
          <li key={p} className={p === 'aadhaar' ? 'font-bold' : undefined}>
            {t(`consent.${key}.${p}`)}
          </li>
        ))}
      </ul>
      <Link href={`/${locale}/privacy`} className="font-semibold">
        {t('consent.readNotice')}
      </Link>
      <form action={grantConsentAction} className="space-y-4">
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="purpose" value={purpose} />
        <input type="hidden" name="next" value={next} />
        <label className="choice">
          <input type="checkbox" name="agree" value="yes" required />
          <span>{t(`consent.${key}.agree`)}</span>
        </label>
        <SubmitButton>{t(`consent.${key}.submit`)}</SubmitButton>
      </form>
      {purpose === 'full_check' && (
        <Link href={`/${locale}/check`} className="btn-quiet">
          {t('consent.fullCheck.decline')}
        </Link>
      )}
    </section>
  );
}
