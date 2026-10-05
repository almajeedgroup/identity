'use server';

import { revokeSessionByToken, staffSignIn, verifyStaffTotp, type Permission } from '@identity/db';
import {
  addStaff,
  changeStaffStatus,
  discardDraft,
  publishVersion,
  recordVerification,
  rollbackTo,
  saveDraft,
  ServiceError,
  setRoles,
  withdrawItem,
} from '@identity/services';
import { redirect } from 'next/navigation';
import { platform } from './platform';
import { clearStaffCookie, requireStaff, setStaffCookie, staffSession } from './staff';

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
};
const q = (path: string, params: Record<string, string>) => `${path}${path.includes('?') ? '&' : '?'}${new URLSearchParams(params).toString()}`;

/** Runs a staff operation and redirects; a refusal goes back with `?error=<code>` (and the first detail, if any). */
async function act(back: string, fn: () => Promise<string>): Promise<never> {
  let target: string;
  try {
    target = await fn();
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    target = q(back, error.details.length ? { error: error.code, detail: error.details.slice(0, 3).join(' · ').slice(0, 400) } : { error: error.code });
  }
  redirect(target);
}

// ---------------------------------------------------------------- sign-in (F05 US2)

export async function staffSignInAction(fd: FormData) {
  const { db } = await platform();
  const result = await staffSignIn(db, str(fd, 'email'), str(fd, 'password'));
  if (!result.ok) redirect(`/staff/sign-in?error=${result.error}`);
  await setStaffCookie(result.token);
  redirect(result.needsEnrolment ? '/staff/enrol' : '/staff/verify');
}

export async function staffTotpAction(fd: FormData) {
  const session = await staffSession();
  if (!session) redirect('/staff/sign-in');
  const { db, config } = await platform();
  const result = await verifyStaffTotp(db, config.keyring, session.staff.id, session.token, str(fd, 'code'));
  const back = session.staff.totpEnabledAt ? '/staff/verify' : '/staff/enrol';
  if (!result.ok) redirect(`${back}?error=${result.error}`);
  redirect('/staff');
}

export async function staffSignOutAction() {
  const session = await staffSession();
  if (session) await revokeSessionByToken((await platform()).db, session.token);
  await clearStaffCookie();
  redirect('/staff/sign-in?signedOut=1');
}

// ---------------------------------------------------------------- rules admin (M13)

const itemPath = (kind: string, key: string) => `/staff/rules/${encodeURIComponent(kind)}/${encodeURIComponent(key)}`;

export interface DraftState {
  error?: string;
  details?: string[];
}

/** Used with useActionState so the editor keeps its text when a draft is refused (M13-AC-2.2). */
export async function saveDraftAction(_prev: DraftState, fd: FormData): Promise<DraftState> {
  const { actor, s } = await requireStaff('rules.edit');
  let target: string;
  try {
    const kind = str(fd, 'kind');
    const { key, version } = await saveDraft(s, actor, { kind, key: str(fd, 'key') || undefined, data: str(fd, 'data'), note: str(fd, 'note') });
    target = `${itemPath(kind, key)}?saved=${version}`;
  } catch (error) {
    if (error instanceof ServiceError) return { error: error.code, details: error.details };
    throw error;
  }
  redirect(target);
}

async function kbAction(fd: FormData, permission: Permission, fn: (ctx: Awaited<ReturnType<typeof requireStaff>>, kind: string, key: string) => Promise<string>) {
  const ctx = await requireStaff(permission);
  const kind = str(fd, 'kind');
  const key = str(fd, 'key');
  await act(itemPath(kind, key), async () => {
    const target = await fn(ctx, kind, key);
    ctx.p.invalidateKnowledge();
    return target;
  });
}

export async function publishAction(fd: FormData) {
  await kbAction(fd, 'rules.publish', async ({ actor, s }, kind, key) => {
    await publishVersion(s, actor, kind, key, Number(str(fd, 'version')));
    return q(itemPath(kind, key), { published: str(fd, 'version') });
  });
}

export async function discardAction(fd: FormData) {
  await kbAction(fd, 'rules.edit', async ({ actor, s }, kind, key) => {
    await discardDraft(s, actor, kind, key, Number(str(fd, 'version')));
    return q(itemPath(kind, key), { discarded: str(fd, 'version') });
  });
}

export async function rollbackAction(fd: FormData) {
  await kbAction(fd, 'rules.edit', async ({ actor, s }, kind, key) => {
    const { version } = await rollbackTo(s, actor, kind, key, Number(str(fd, 'version')));
    return q(itemPath(kind, key), { saved: String(version) });
  });
}

export async function withdrawAction(fd: FormData) {
  await kbAction(fd, 'rules.publish', async ({ actor, s }, kind, key) => {
    await withdrawItem(s, actor, kind, key, str(fd, 'reason'));
    return q(itemPath(kind, key), { withdrawn: '1' });
  });
}

export async function verifyAction(fd: FormData) {
  await kbAction(fd, 'rules.edit', async ({ actor, s }, kind, key) => {
    await recordVerification(s, actor, kind, key, { date: str(fd, 'date'), sourceId: str(fd, 'source') });
    return q(itemPath(kind, key), { verified: '1' });
  });
}

// ---------------------------------------------------------------- team (M15 US6)

export async function addStaffAction(fd: FormData) {
  const { actor, s } = await requireStaff('staff.manage');
  await act('/staff/team', async () => {
    await addStaff(s, actor, { email: str(fd, 'email'), name: str(fd, 'name'), password: str(fd, 'password'), roles: fd.getAll('roles').map(String) });
    return '/staff/team?added=1';
  });
}

export async function setRolesAction(fd: FormData) {
  const { actor, s } = await requireStaff('staff.manage');
  await act('/staff/team', async () => {
    await setRoles(s, actor, str(fd, 'id'), fd.getAll('roles').map(String));
    return '/staff/team?saved=1';
  });
}

export async function setStatusAction(fd: FormData) {
  const { actor, s } = await requireStaff('staff.manage');
  await act('/staff/team', async () => {
    await changeStaffStatus(s, actor, str(fd, 'id'), str(fd, 'status') as 'active');
    return '/staff/team?saved=1';
  });
}
