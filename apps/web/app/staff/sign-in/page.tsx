import { redirect } from 'next/navigation';
import { Notice } from '@/components/staff/StaffShell';
import { query, type SearchParams } from '@/lib/server/page';
import { staffSignInAction } from '@/lib/server/staff-actions';
import { staffSession } from '@/lib/server/staff';
import { staffError } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Sign in' };

/** F05 US2 · Email and password, then the authenticator code. */
export default async function StaffSignInPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await staffSession();
  if (session?.mfaVerified) redirect('/staff');
  const q = await query(searchParams);
  const error = staffError(q.error);
  return (
    <main id="main" className="mx-auto max-w-md space-y-6 px-4 py-10">
      <h1 className="text-[2rem] leading-tight font-extrabold">1dentity staff sign-in</h1>
      {q.signedOut && <Notice tone="success">You are signed out.</Notice>}
      {error && <Notice tone="error">{error}</Notice>}
      <form action={staffSignInAction} className="card space-y-4">
        <div>
          <label className="field-label" htmlFor="email">
            Email
          </label>
          <input id="email" name="email" type="email" className="field-input" autoComplete="username" required />
        </div>
        <div>
          <label className="field-label" htmlFor="password">
            Password
          </label>
          <input id="password" name="password" type="password" className="field-input" autoComplete="current-password" required />
        </div>
        <button type="submit" className="btn-primary">
          Continue
        </button>
      </form>
      <p className="text-slate-500">Staff accounts always use two-step verification with an authenticator app.</p>
    </main>
  );
}
