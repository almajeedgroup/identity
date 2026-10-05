import { openUpload } from '@identity/services';
import { platform } from '@/lib/server/platform';
import { currentCitizen } from '@/lib/server/session';

export const dynamic = 'force-dynamic';

/** F07-AC-2.1 / 2.2 · Files are served only to their owner, privately, never from a public path. */
export async function GET(_request: Request, { params }: { params: Promise<{ uploadId: string }> }) {
  const { uploadId } = await params;
  const citizen = await currentCitizen();
  const file = await openUpload((await platform()).services, citizen?.user.id ?? null, uploadId);
  const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (!file) return new Response('Not found', { status: 404, headers: { ...headers, 'Content-Type': 'text/plain; charset=utf-8' } });
  return new Response(new Uint8Array(file.bytes), {
    status: 200,
    // Only JPEG, PNG or PDF are ever stored (sniffed on upload, F07-AC-3.1), so the type is exact.
    headers: { ...headers, 'Content-Type': file.mime, 'Content-Disposition': 'inline' },
  });
}
