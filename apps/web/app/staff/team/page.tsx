import { STAFF_ROLES } from '@identity/db';
import { listStaff } from '@identity/services';
import { Notice, StaffShell } from '@/components/staff/StaffShell';
import { query, type SearchParams } from '@/lib/server/page';
import { addStaffAction, setRolesAction, setStatusAction } from '@/lib/server/staff-actions';
import { requireStaff } from '@/lib/server/staff';
import { ROLE_LABELS, staffError } from '@/lib/staff-text';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Team' };

/** M15 US6 · Admins add staff, change roles, suspend, reactivate or offboard. */
export default async function TeamPage({ searchParams }: { searchParams: SearchParams }) {
  const { actor, s, can } = await requireStaff('staff.manage');
  const q = await query(searchParams);
  const team = await listStaff(s, actor);
  const error = staffError(q.error);
  const roleBoxes = (name: string, checked: string[] = []) => (
    <fieldset className="flex flex-wrap gap-2">
      <legend className="field-label">Roles</legend>
      {STAFF_ROLES.map((r) => (
        <label key={r} className="choice min-h-12">
          <input type="checkbox" name={name} value={r} defaultChecked={checked.includes(r)} />
          <span>{ROLE_LABELS[r]}</span>
        </label>
      ))}
    </fieldset>
  );
  return (
    <StaffShell name={actor.name} roles={[...actor.roles]} can={can} title="Team">
      {error && <Notice tone="error">{error}</Notice>}
      {q.added && <Notice tone="success">Staff member added. They set up two-step verification at their first sign-in.</Notice>}
      {q.saved && <Notice tone="success">Saved.</Notice>}
      <ul className="space-y-3" data-testid="team">
        {team.map((m) => (
          <li key={m.id} className="card space-y-3" data-email={m.email}>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p>
                <span className="text-lg font-bold">{m.name}</span> · <span className="font-mono">{m.email}</span>
              </p>
              <p className="text-[0.875rem]">
                {m.status} · {m.twoFactor ? '2FA on' : '2FA not set up yet'}
              </p>
            </div>
            {m.status !== 'offboarded' && (
              <>
                <form action={setRolesAction} className="space-y-2">
                  <input type="hidden" name="id" value={m.id} />
                  {roleBoxes('roles', m.roles)}
                  <button type="submit" className="btn-secondary">
                    Save roles
                  </button>
                </form>
                {m.id !== actor.id && (
                  <div className="flex flex-wrap gap-2">
                    {(m.status === 'active' ? ['suspended', 'offboarded'] : ['active', 'offboarded']).map((status) => (
                      <form key={status} action={setStatusAction}>
                        <input type="hidden" name="id" value={m.id} />
                        <input type="hidden" name="status" value={status} />
                        <button type="submit" className="btn-quiet">
                          {status === 'active' ? 'Reactivate' : status === 'suspended' ? 'Suspend' : 'Offboard'}
                        </button>
                      </form>
                    ))}
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>
      <section className="card space-y-4" aria-labelledby="add-title">
        <h2 id="add-title" className="text-xl font-bold">
          Add a staff member
        </h2>
        <form action={addStaffAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="field-label" htmlFor="name">
                Name
              </label>
              <input id="name" name="name" className="field-input" required />
            </div>
            <div>
              <label className="field-label" htmlFor="email">
                Email
              </label>
              <input id="email" name="email" type="email" className="field-input" required />
            </div>
          </div>
          <div>
            <label className="field-label" htmlFor="password">
              Initial password (at least 12 characters, hand it over in person)
            </label>
            <input id="password" name="password" type="password" className="field-input" minLength={12} autoComplete="new-password" required />
          </div>
          {roleBoxes('roles')}
          <button type="submit" className="btn-primary">
            Add staff member
          </button>
        </form>
      </section>
    </StaffShell>
  );
}
