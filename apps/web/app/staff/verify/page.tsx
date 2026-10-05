import { redirect } from 'next/navigation';
import { Notice } from '@/components/staff/StaffShell';
import { query, type SearchParams } from '@/lib/server/page';
import { staffTotpAction } from '@/lib/server/staff-actions';
import { staffSession } from '@/lib/server/staff';
import { staffError } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Two-step verification' };

/** F05-AC-2.1 · A valid TOTP code is required before any staff page opens. */
export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await staffSession();
  if (!session) redirect('/staff/sign-in');
  if (session.mfaVerified) redirect('/staff');
  if (!session.staff.totpEnabledAt) redirect('/staff/enrol');
  const error = staffError((await query(searchParams)).error);
  return (
    <main id="main" className="mx-auto max-w-md space-y-6 px-4 py-10">
      <h1 className="text-[2rem] leading-tight font-extrabold">Enter your code</h1>
      {error && <Notice tone="error">{error}</Notice>}
      <form action={staffTotpAction} className="card space-y-4">
        <div>
          <label className="field-label" htmlFor="code">
            6-digit code from your authenticator app
          </label>
          <input id="code" name="code" className="field-input text-2xl tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required />
        </div>
        <button type="submit" className="btn-primary">
          Sign in
        </button>
      </form>
    </main>
  );
}
