/** M15-FR-02 · Every staff operation checks its permission on the server; a refusal is audited. */
import { can, writeAudit, type Permission } from '@identity/db';
import { nowOf, ServiceError, type Services, type StaffActor } from '../services';

export async function requirePermission(s: Services, actor: StaffActor, permission: Permission, subject?: { kind: string; id: string }): Promise<void> {
  if (can(actor.roles, permission)) return;
  await writeAudit(
    s.db,
    { actorKind: 'staff', actorId: actor.id, action: 'access.denied', subjectKind: subject?.kind ?? null, subjectId: subject?.id ?? null, details: { permission } },
    nowOf(s),
  );
  throw new ServiceError('forbidden');
}
