import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Banner } from '@/components/fullcheck/Banner';
import { SubmitButton } from '@/components/fullcheck/SubmitButton';
import { changeMobileAction, requestCodeAction, verifyCodeAction } from '@/lib/server/actions';
import { errorMessage, localeOf, ltr, query, type LocaleParams, type SearchParams } from '@/lib/server/page';
import { currentCitizen, pendingMobile } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** F05 US1 · Sign in with a one-time code sent to the citizen's own mobile. */
export default async function SignInPage({ params, searchParams }: { params: LocaleParams; searchParams: SearchParams }) {
  const { locale, t } = await localeOf(params);
  if (await currentCitizen()) redirect(`/${locale}/me`);
  const q = await query(searchParams);
  const mobile = await pendingMobile();
  const error = errorMessage(t, q.error);

  return (
    <div className="space-y-6">
      <h1 className="text-[2rem] leading-tight font-extrabold">{t('signIn.title')}</h1>
      <p className="text-lg">{t('signIn.intro')}</p>
      {error && <Banner tone="error">{error}</Banner>}

      {mobile ? (
        <div className="card space-y-4">
          <p className="font-semibold">{t('signIn.codeSentTo', { mobile: ltr(mobile.replace(/^\+91(\d{5})(\d{5})$/, '+91 $1 $2')) })}</p>
          <form action={verifyCodeAction} className="space-y-4">
            <input type="hidden" name="locale" value={locale} />
            <div>
              <label className="field-label" htmlFor="code">
                {t('signIn.code')}
              </label>
              <input id="code" name="code" className="field-input text-2xl tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required dir="ltr" />
            </div>
            <SubmitButton>{t('signIn.verify')}</SubmitButton>
          </form>
          <form action={changeMobileAction}>
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className="btn-quiet">
              {t('signIn.changeNumber')}
            </button>
          </form>
        </div>
      ) : (
        <form action={requestCodeAction} className="card space-y-4">
          <input type="hidden" name="locale" value={locale} />
          <div>
            <label className="field-label" htmlFor="mobile">
              {t('signIn.mobile')}
            </label>
            <input id="mobile" name="mobile" type="tel" className="field-input" autoComplete="tel" required aria-describedby="mobile-hint" dir="ltr" />
            <p id="mobile-hint" className="mt-1 text-[0.875rem] text-slate-500">
              {t('signIn.mobileHint')}
            </p>
          </div>
          <SubmitButton>{t('signIn.sendCode')}</SubmitButton>
        </form>
      )}

      <p className="rounded-xl border-2 border-coral-500 bg-coral-50 p-4 font-bold text-coral-700">{t('signIn.codeNote')}</p>
      <p>
        {t('signIn.quickCheck')}{' '}
        <Link href={`/${locale}/check`} className="font-semibold">
          {t('home.start')}
        </Link>
      </p>
    </div>
  );
}
