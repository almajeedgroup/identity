import 'server-only';
import { resolveSession, SESSION_COOKIE, SESSION_POLICY, type tables } from '@identity/db';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import type { Locale } from '@/i18n/config';
import { platform } from './platform';

/** F05-AC-3.3 · HttpOnly, SameSite=Lax, Secure on HTTPS; the database holds only the token's hash. */
export const PENDING_MOBILE_COOKIE = 'identity_pending_mobile';

export interface Citizen {
  user: typeof tables.users.$inferSelect;
  token: string;
}

export async function currentCitizen(): Promise<Citizen | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!token) return null;
  const { db } = await platform();
  const session = await resolveSession(db, token);
  return session?.kind === 'citizen' ? { user: session.user, token } : null;
}

export async function requireCitizen(locale: Locale): Promise<Citizen> {
  const citizen = await currentCitizen();
  if (!citizen) redirect(`/${locale}/sign-in`);
  return citizen;
}

async function cookieOptions(maxAgeSeconds: number) {
  const { config } = await platform();
  return { httpOnly: true, sameSite: 'lax' as const, secure: config.secureCookies, path: '/', maxAge: maxAgeSeconds };
}

export async function setSessionCookie(token: string) {
  (await cookies()).set(SESSION_COOKIE, token, await cookieOptions(SESSION_POLICY.citizen.maxMs / 1000));
}

export async function clearSessionCookie() {
  (await cookies()).delete(SESSION_COOKIE);
}

export async function setPendingMobile(mobile: string) {
  (await cookies()).set(PENDING_MOBILE_COOKIE, mobile, await cookieOptions(10 * 60));
}

export async function pendingMobile(): Promise<string | null> {
  return (await cookies()).get(PENDING_MOBILE_COOKIE)?.value ?? null;
}

export async function clearPendingMobile() {
  (await cookies()).delete(PENDING_MOBILE_COOKIE);
}
