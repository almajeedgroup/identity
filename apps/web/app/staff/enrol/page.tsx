import { beginTotpEnrolment, decryptValue, otpauthUri } from '@identity/db';
import { redirect } from 'next/navigation';
import QRCode from 'qrcode';
import { Notice } from '@/components/staff/StaffShell';
import { query, type SearchParams } from '@/lib/server/page';
import { platform } from '@/lib/server/platform';
import { staffTotpAction } from '@/lib/server/staff-actions';
import { staffSession } from '@/lib/server/staff';
import { staffError } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Set up two-step verification' };

/** F05-AC-2.1 / F05-FR-05 · First sign-in: nothing opens until an authenticator app is enrolled. */
export default async function EnrolPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await staffSession();
  if (!session) redirect('/staff/sign-in');
  if (session.mfaVerified) redirect('/staff');
  if (session.staff.totpEnabledAt) redirect('/staff/verify');
  const { db, config } = await platform();
  // Until enrolment is confirmed, the same pending secret is shown again rather than replaced.
  const { secret, uri } = session.staff.totpSecret
    ? (() => {
        const pending = decryptValue(session.staff.totpSecret!, config.keyring);
        return { secret: pending, uri: otpauthUri(pending, session.staff.email) };
      })()
    : await beginTotpEnrolment(db, config.keyring, session.staff.id);
  const svg = await QRCode.toString(uri, { type: 'svg', margin: 1, width: 220 });
  const error = staffError((await query(searchParams)).error);

  return (
    <main id="main" className="mx-auto max-w-md space-y-6 px-4 py-10">
      <h1 className="text-[2rem] leading-tight font-extrabold">Set up two-step verification</h1>
      {error && <Notice tone="error">{error}</Notice>}
      <ol className="list-decimal space-y-2 ps-6">
        <li>Open an authenticator app on your phone (for example Google Authenticator or Microsoft Authenticator).</li>
        <li>Scan this code, or type the key below.</li>
        <li>Enter the 6-digit code the app shows.</li>
      </ol>
      <div className="card flex flex-col items-center gap-3">
        <div role="img" aria-label="QR code for your authenticator app" dangerouslySetInnerHTML={{ __html: svg }} />
        <p className="text-center">
          Key:{' '}
          <code data-testid="totp-secret" className="font-mono text-lg font-bold tracking-wider break-all">
            {secret.match(/.{1,4}/g)!.join(' ')}
          </code>
        </p>
        <p className="text-[0.875rem] text-slate-500">This key is shown only until you confirm. Do not share it.</p>
      </div>
      <form action={staffTotpAction} className="card space-y-4">
        <div>
          <label className="field-label" htmlFor="code">
            6-digit code
          </label>
          <input id="code" name="code" className="field-input text-2xl tracking-[0.3em]" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" required />
        </div>
        <button type="submit" className="btn-primary">
          Confirm and continue
        </button>
      </form>
    </main>
  );
}
