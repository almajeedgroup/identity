import type { AddressValue } from '@identity/engine';
import Link from 'next/link';
import { Banner } from '@/components/fullcheck/Banner';
import { SubmitButton } from '@/components/fullcheck/SubmitButton';
import { updateProfileAction } from '@/lib/server/actions';
import { PersonBar } from '@/components/fullcheck/PersonBar';
import { requireFullCheck } from '@/lib/server/fullcheck';
import { errorMessage, localeOf, query, type LocaleParams, type SearchParams } from '@/lib/server/page';

export const dynamic = 'force-dynamic';

/** M16-FR-01 · The citizen's own details: not compared, but used for the address target and the right offices. */
export default async function ProfilePage({ params, searchParams }: { params: LocaleParams; searchParams: SearchParams }) {
  const { locale, t } = await localeOf(params);
  const q = await query(searchParams);
  const { s, userId, citizen, person, hasFamily } = await requireFullCheck(locale);
  const [profile, { kb }] = await Promise.all([person, s.knowledge()]);
  const address = (profile.currentAddress ?? {}) as AddressValue;
  const states = kb.jurisdictions.filter((j) => j.code.split('-').length === 2);
  const error = errorMessage(t, q.error);
  const text = (id: string, label: string, value: string | null | undefined, extra: Record<string, unknown> = {}) => (
    <div>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <input id={id} name={id} className="field-input" defaultValue={value ?? ''} {...extra} />
    </div>
  );

  return (
    <div className="space-y-6">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('profile.title')}</h1>
      <PersonBar t={t} locale={locale} person={person} hasFamily={hasFamily} />
      <p>{t('profile.intro')}</p>
      {q.saved && <Banner tone="success">{t('profile.saved')}</Banner>}
      {error && <Banner tone="error">{error}</Banner>}
      <form action={updateProfileAction} className="card space-y-5">
        <input type="hidden" name="person" value={person.id} />
        <input type="hidden" name="locale" value={locale} />
        {text('display_name', t('profile.displayName'), profile.displayName, { autoComplete: 'name' })}
        <div>
          <p className="field-label">{t('profile.mobile')}</p>
          <p className="text-lg font-semibold">
            <bdi dir="ltr">{citizen.user.mobile}</bdi>
          </p>
        </div>
        {text('email', t('profile.email'), profile.email, { type: 'email', autoComplete: 'email', dir: 'ltr' })}
        <div>
          <label className="field-label" htmlFor="jurisdiction">
            {t('profile.state')}
          </label>
          <select id="jurisdiction" name="jurisdiction" className="field-input" defaultValue={profile.jurisdiction}>
            {states.map((j) => (
              <option key={j.code} value={j.code}>
                {j.name[locale]}
              </option>
            ))}
          </select>
        </div>
        {text('district', t('profile.district'), profile.district)}
        <fieldset className="space-y-3 rounded-xl border-2 border-line-200 p-4">
          <legend className="px-1 font-bold">{t('profile.currentAddress')}</legend>
          <p className="text-[0.875rem] text-slate-500">{t('profile.currentAddressHint')}</p>
          {text('address_line', t('fields.addressLine'), address.line, { autoComplete: 'street-address' })}
          {text('address_city', t('fields.addressCity'), address.city)}
          {text('address_district', t('fields.addressDistrict'), address.district)}
          {text('address_state', t('fields.addressState'), address.state)}
          {text('address_pin', t('fields.addressPin'), address.pin, { inputMode: 'numeric', maxLength: 6, pattern: '[0-9]{6}', autoComplete: 'postal-code' })}
        </fieldset>
        <SubmitButton>{t('profile.save')}</SubmitButton>
      </form>
      <Link href={`/${locale}/me`} className="btn-quiet">
        {t('me.title')}
      </Link>
    </div>
  );
}
