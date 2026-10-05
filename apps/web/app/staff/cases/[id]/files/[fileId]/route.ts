import { openStaffCaseFile, ServiceError } from '@identity/services';
import { staffFileResponse, staffActorForRoute } from '@/lib/server/staff-route';

export const dynamic = 'force-dynamic';

/** M09 · A case file, for staff on the case; audited. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string; fileId: string }> }) {
  const { id, fileId } = await params;
  const ctx = await staffActorForRoute();
  if (!ctx) return staffFileResponse(null);
  try {
    return staffFileResponse(await openStaffCaseFile(ctx.s, ctx.actor, id, fileId));
  } catch (e) {
    if (e instanceof ServiceError) return staffFileResponse(null);
    throw e;
  }
}
