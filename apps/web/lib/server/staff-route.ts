import 'server-only';
import { can } from '@identity/db';
import type { StaffActor } from '@identity/services';
import { platform } from './platform';
import { staffSession } from './staff';

/** For route handlers: a signed-in, 2FA-verified staff member with `cases.work`, or null. */
export async function staffActorForRoute() {
  const session = await staffSession();
  if (!session?.mfaVerified || !can(session.roles, 'cases.work')) return null;
  const actor: StaffActor = { id: session.staff.id, name: session.staff.name, roles: session.roles };
  return { actor, s: (await platform()).services };
}

/** F07-AC-2.2 · Private, uncached; "not found" for anything refused. */
export function staffFileResponse(file: { bytes: Buffer; mime: string } | null): Response {
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!file) return new Response('Not found', { status: 404, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(new Uint8Array(file.bytes), { status: 200, headers: { ...headers, 'Content-Type': file.mime, 'Content-Disposition': 'inline' } });
}
