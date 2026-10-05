import { openMyCaseFile } from '@identity/services';
import { platform } from '@/lib/server/platform';
import { currentCitizen } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** M04 / F07-AC-2.1 · A case file for the citizen whose case it is; private and uncached. */
export async function GET(_request: Request, { params }: { params: Promise<{ caseId: string; fileId: string }> }) {
  const { caseId, fileId } = await params;
  const citizen = await currentCitizen();
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  const file = citizen ? await openMyCaseFile((await platform()).services, citizen.user.id, caseId, fileId) : null;
  if (!file) return new Response('Not found', { status: 404, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(new Uint8Array(file.bytes), { status: 200, headers: { ...headers, 'Content-Type': file.mime, 'Content-Disposition': 'inline' } });
}
