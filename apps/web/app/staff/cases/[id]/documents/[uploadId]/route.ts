import { openCaseDocumentFile, ServiceError } from '@identity/services';
import { staffFileResponse, staffActorForRoute } from '@/lib/server/staff-route';

export const dynamic = 'force-dynamic';

/** M09-AC-2.4 · A citizen's uploaded document, for staff on the case; audited. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; uploadId: string }> }) {
  const { id, uploadId } = await params;
  const ctx = await staffActorForRoute();
  if (!ctx) return staffFileResponse(null);
  try {
    return staffFileResponse(await openCaseDocumentFile(ctx.s, ctx.actor, id, uploadId));
  } catch (e) {
    if (e instanceof ServiceError) return staffFileResponse(null);
    throw e;
  }
}
