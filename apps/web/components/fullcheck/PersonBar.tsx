import type { Profile } from '@identity/services';
import Link from 'next/link';
import type { Locale } from '@/i18n/config';
import type { Translate } from '@/i18n/translate';

/** M07-AC-1.2 · On every Full Check screen of an account with family members: whose documents these are. */
export function PersonBar({ t, locale, person, hasFamily }: { t: Translate; locale: Locale; person: Profile; hasFamily: boolean }) {
  if (!hasFamily) return null;
  const self = person.relationship === 'self';
  return (
    <div data-testid="person-bar" className="flex flex-wrap items-center justify-between gap-2 rounded-xl border-2 border-sky-500 bg-sky-50 p-3 font-semibold text-ink-900">
      <span>{t('family.viewing', { name: self ? t('family.you') : (person.displayName ?? ''), relationship: t(`family.rel.${person.relationship}`) })}</span>
      <Link href={`/${locale}/me/family`} className="underline">
        {t('family.change')}
      </Link>
    </div>
  );
}

