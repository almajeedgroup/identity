'use server';

import { COMPARED_FIELDS, type ComparedField } from '@identity/content';
import { requestCode, revokeSessionByToken, verifyCode } from '@identity/db';
import type { AddressValue, FieldValue, RelativeType } from '@identity/engine';
import {
  addTypedDocument,
  changeKind,
  closeAccount,
  confirmDocument,
  confirmTarget,
  deleteDocument,
  editDocument,
  grantConsent,
  requireProfile,
  revokeOverride,
  ServiceError,
  setOverride,
  updateProfile,
  uploadDocument,
  withdrawFullCheck,
  withdrawUploads,
  type DocumentValues,
  type Purpose,
} from '@identity/services';
import { redirect } from 'next/navigation';
import { isLocale, type Locale } from '@/i18n/config';
import { platform } from './platform';
import { clearPendingMobile, clearSessionCookie, currentCitizen, pendingMobile, setPendingMobile, setSessionCookie } from './session';

const str = (fd: FormData, key: string) => {
  const v = fd.get(key);
  return typeof v === 'string' ? v : '';
};
const localeOf = (fd: FormData): Locale => {
  const v = fd.get('locale');
  return isLocale(v) ? v : 'en';
};

/** Runs a service call and redirects: to its result on success, back with `?error=<code>` on a refusal. */
async function act(back: string, fn: () => Promise<string>): Promise<never> {
  let target: string;
  try {
    target = await fn();
  } catch (error) {
    if (!(error instanceof ServiceError)) throw error;
    target = `${back}${back.includes('?') ? '&' : '?'}error=${error.code}`;
  }
  redirect(target);
}

async function signedIn(locale: Locale) {
  const citizen = await currentCitizen();
  if (!citizen) redirect(`/${locale}/sign-in`);
  return { citizen, p: await platform() };
}

// ---------------------------------------------------------------- sign-in (F05 US1)

export async function requestCodeAction(fd: FormData) {
  const locale = localeOf(fd);
  const { db, otp, config } = await platform();
  const result = await requestCode({ db, sender: otp, pepper: config.otpPepper }, str(fd, 'mobile'));
  if (!result.ok) redirect(`/${locale}/sign-in?error=${result.error}`);
  await setPendingMobile(result.mobile);
  redirect(`/${locale}/sign-in`);
}

export async function verifyCodeAction(fd: FormData) {
  const locale = localeOf(fd);
  const mobile = await pendingMobile();
  if (!mobile) redirect(`/${locale}/sign-in?error=expired`);
  const { db, otp, config } = await platform();
  const result = await verifyCode({ db, sender: otp, pepper: config.otpPepper }, mobile, str(fd, 'code'), locale);
  if (!result.ok) redirect(`/${locale}/sign-in?error=${result.error}`);
  await setSessionCookie(result.token);
  await clearPendingMobile();
  redirect(`/${locale}/me`);
}

export async function changeMobileAction(fd: FormData) {
  await clearPendingMobile();
  redirect(`/${localeOf(fd)}/sign-in`);
}

export async function signOutAction(fd: FormData) {
  const locale = localeOf(fd);
  const citizen = await currentCitizen();
  if (citizen) await revokeSessionByToken((await platform()).db, citizen.token);
  await clearSessionCookie();
  redirect(`/${locale}`);
}

// ---------------------------------------------------------------- consent (F06)

export async function grantConsentAction(fd: FormData) {
  const locale = localeOf(fd);
  const { citizen, p } = await signedIn(locale);
  const purpose = str(fd, 'purpose') as Purpose;
  const next = str(fd, 'next');
  const back = next.startsWith(`/${locale}/me`) ? next : `/${locale}/me`;
  if (str(fd, 'agree') !== 'yes') redirect(`${back}${back.includes('?') ? '&' : '?'}error=must_agree`);
  await act(back, async () => {
    await grantConsent(p.services, citizen.user.id, purpose === 'uploads' ? 'uploads' : 'full_check', locale);
    return back;
  });
}

// ---------------------------------------------------------------- documents (M17)

function valuesFrom(fd: FormData): DocumentValues {
  const values: DocumentValues = {};
  for (const key of ['name', 'dob', 'gender', 'father_name', 'mother_name', 'spouse_name', 'place_of_birth', 'relative_name'] as const) {
    if (fd.has(key)) values[key] = str(fd, key);
  }
  if (fd.has('relative_type') && str(fd, 'relative_type')) values.relative_type = str(fd, 'relative_type') as RelativeType;
  if (fd.has('address_line')) {
    values.address = { line: str(fd, 'address_line'), city: str(fd, 'address_city'), district: str(fd, 'address_district'), state: str(fd, 'address_state'), pin: str(fd, 'address_pin') };
  }
  return values;
}

export async function addTypedDocumentAction(fd: FormData) {
  const locale = localeOf(fd);
  const { citizen, p } = await signedIn(locale);
  const kind = str(fd, 'kind');
  await act(`/${locale}/me/documents/new/${kind}`, async () => {
    await addTypedDocument(p.services, citizen.user.id, { kind, values: valuesFrom(fd), number: str(fd, 'number') });
    return `/${locale}/me/documents?added=1`;
  });
}

export async function uploadDocumentAction(fd: FormData) {
  const locale = localeOf(fd);
  const { citizen, p } = await signedIn(locale);
  const kind = str(fd, 'kind');
  const file = fd.get('file');
  const back = `/${locale}/me/documents/new/${kind}`;
  if (!(file instanceof File) || file.size === 0) redirect(`${back}?error=no_file`);
  await act(back, async () => {
    const outcome = await uploadDocument(p.services, citizen.user.id, { kind, bytes: new Uint8Array(await file.arrayBuffer()) });
    return `/${locale}/me/documents/${outcome.documentId}${outcome.kindMismatch && outcome.detectedKind ? `?looksLike=${outcome.detectedKind}` : ''}`;
  });
}

export async function changeKindAction(fd: FormData) {
  const locale = localeOf(fd);
  const { citizen, p } = await signedIn(locale);
  const id = str(fd, 'id');
  await act(`/${locale}/me/documents/${id}`, async () => {
    await changeKind(p.services, citizen.user.id, id, str(fd, 'kind'));
    return `/${locale}/me/documents/${id}`;
  });
}

export async function confirmDocumentAction(fd: FormData) {
  const locale = localeOf(fd);
  const { citizen, p } = await signedIn(locale);
  const id = str(fd, 'id');
  await act(`/${locale}/me/documents/${id}`, async () => {
    await confirmDocument(p.services, citizen.user.id, id, { values: valuesFrom(fd), number: str(fd, 'number') });
    return `/${locale}/me/documents/${id}?confirmed=1`;
  });
}

export async function editDocumentAction(fd: FormData) {
  const locale = localeOf(fd);
  const { citizen, p } = await signedIn(locale);
  const id = str(fd, 'id');
  await act(`/${locale}/me/documents/${id}?edit=1`, async () => {
    await editDocument(p.services, citizen.user.id, id, { values: valuesFrom(fd), number: str(fd, 'number') });
    return `/${locale}/me/documents/${id}?saved=1`;
  });
}

export async function deleteDocumentAction(fd: FormData) {
  const locale = localeOf(fd);
  const { citizen, p } = await signedIn(locale);
  const id = str(fd, 'id');
  await act(`/${locale}/me/documents/${id}`, async () => {
    await deleteDocument(p.services, citizen.user.id, id);
    return `/${locale}/me/documents?deleted=1`;
  });
}

// ---------------------------------------------------------------- targets and overrides (M16)

const isField = (v: string): v is ComparedField => (COMPARED_FIELDS as readonly string[]).includes(v);

export async function confirmTargetAction(fd: FormData) {
  const locale = localeOf(fd);
  const { citizen, p } = await signedIn(locale);
  const field = str(fd, 'field');
  const back = `/${locale}/me/report`;
  if (!isField(field)) redirect(`${back}?error=invalid_field`);
  const choice = str(fd, 'choice');
  let value: FieldValue;
  if (choice === 'other') value = str(fd, 'other');
  else {
    try {
      value = JSON.parse(choice) as string | AddressValue;
    } catch {
      redirect(`${back}?error=invalid_value#target-${field}`);
    }
  }
  await act(`${back}#target-${field}`, async () => {
    const profile = await requireProfile(p.db, citizen.user.id);
    await confirmTarget(p.services, { kind: 'citizen', id: citizen.user.id }, profile.id, field, value);
    return `${back}?saved=${field}#target-${field}`;
  });
}

export async function setOverrideAction(fd: FormData) {
  const locale = localeOf(fd);
  const { citizen, p } = await signedIn(locale);
  const field = str(fd, 'field');
  const back = `/${locale}/me/report`;
  if (!isField(field)) redirect(`${back}?error=invalid_field`);
  const decision = str(fd, 'decision') === 'requires_correction' ? 'requires_correction' : 'accepted_equivalent';
  await act(`${back}#target-${field}`, async () => {
    const profile = await requireProfile(p.db, citizen.user.id);
    await setOverride(p.services, { kind: 'citizen', id: citizen.user.id }, profile.id, { documentId: str(fd, 'document'), field, decision, reason: str(fd, 'reason') });
    // A query change (not just a hash) makes the router fetch the updated report.
    return `${back}?decision=${field}#target-${field}`;
  });
}

export async function revokeOverrideAction(fd: FormData) {
  const locale = localeOf(fd);
  const { citizen, p } = await signedIn(locale);
  const back = `/${locale}/me/report`;
  await act(back, async () => {
    const profile = await requireProfile(p.db, citizen.user.id);
    await revokeOverride(p.services, { kind: 'citizen', id: citizen.user.id }, profile.id, str(fd, 'id'));
    return `${back}?decision=removed`;
  });
}

// ---------------------------------------------------------------- profile and settings (M16, F06)

export async function updateProfileAction(fd: FormData) {
  const locale = localeOf(fd);
  const { citizen, p } = await signedIn(locale);
  await act(`/${locale}/me/profile`, async () => {
    await updateProfile(p.services, citizen.user.id, {
      displayName: str(fd, 'display_name'),
      jurisdiction: str(fd, 'jurisdiction'),
      district: str(fd, 'district'),
      email: str(fd, 'email'),
      currentAddress: { line: str(fd, 'address_line'), city: str(fd, 'address_city'), district: str(fd, 'address_district'), state: str(fd, 'address_state'), pin: str(fd, 'address_pin') },
    });
    return `/${locale}/me/profile?saved=1`;
  });
}

function confirmed(fd: FormData, locale: Locale) {
  if (str(fd, 'confirm') !== 'yes') redirect(`/${locale}/me/settings?error=must_confirm`);
}

export async function withdrawUploadsAction(fd: FormData) {
  const locale = localeOf(fd);
  confirmed(fd, locale);
  const { citizen, p } = await signedIn(locale);
  await withdrawUploads(p.services, citizen.user.id);
  redirect(`/${locale}/me/settings?done=uploads`);
}

export async function withdrawFullCheckAction(fd: FormData) {
  const locale = localeOf(fd);
  confirmed(fd, locale);
  const { citizen, p } = await signedIn(locale);
  await withdrawFullCheck(p.services, citizen.user.id);
  redirect(`/${locale}/me?done=withdrawn`);
}

export async function closeAccountAction(fd: FormData) {
  const locale = localeOf(fd);
  confirmed(fd, locale);
  const { citizen, p } = await signedIn(locale);
  await closeAccount(p.services, citizen.user.id);
  await clearSessionCookie();
  redirect(`/${locale}/goodbye`);
}
