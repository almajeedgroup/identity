/** Application services for the Full Check (M16, M17, F06): everything the web app does with citizen data. */
import type { KnowledgeBase } from '@identity/content';
import type { Db, Keyring, ObjectStore, OtpSender } from '@identity/db';
import type { EngineContext } from '@identity/engine';
import type { Providers } from '@identity/ocr';

export interface Knowledge {
  kb: KnowledgeBase;
  version: string;
  ctx: EngineContext;
}

export interface Services {
  db: Db;
  keyring: Keyring;
  /** Encrypted object store (F07). */
  store: ObjectStore;
  ocr: Providers;
  knowledge(): Promise<Knowledge>;
  now?: () => Date;
  /** M09-FR-04 · Holidays for SLA counting (YYYY-MM-DD). */
  holidays?: readonly string[];
  /** F08 · SMS through the sender interface (ADR-014) and the public URL for links; absent = in-app only. */
  messaging?: { sender: OtpSender; appUrl: string; /** F08-AC-2.3 · default true; tests may turn it off. */ quietHours?: boolean };
}

export const nowOf = (s: Pick<Services, 'now'>) => s.now?.() ?? new Date();

export type ErrorCode =
  | 'consent_required'
  | 'uploads_consent_required'
  | 'not_found'
  | 'invalid_kind'
  | 'invalid_field'
  | 'invalid_value'
  | 'invalid_date'
  | 'invalid_pin'
  | 'invalid_number'
  | 'relative_type_required'
  | 'aadhaar_full_number'
  | 'too_large'
  | 'bad_type'
  | 'rejected_aadhaar'
  | 'no_text'
  | 'not_verified'
  | 'already_verified'
  | 'reason_required'
  // staff console (M13, M15)
  | 'forbidden'
  | 'invalid_json'
  | 'invalid_kb'
  | 'key_mismatch'
  | 'not_draft'
  | 'second_person_required'
  | 'no_metadata'
  | 'self_lockout'
  | 'weak_password'
  | 'email_taken'
  | 'no_roles'
  | 'invalid_mobile'
  // cases (M04, M09)
  | 'assistance_consent_required'
  | 'no_correction_step'
  | 'case_closed'
  | 'not_allowed'
  | 'not_awaiting'
  | 'proof_required'
  | 'already_assigned';

/** A refusal the citizen can act on; the web layer turns the code into a message. */
export class ServiceError extends Error {
  constructor(
    readonly code: ErrorCode,
    /** Messages the person can act on, e.g. knowledge-base validation errors (M13-AC-2.2). */
    readonly details: string[] = [],
  ) {
    super(details.length ? `${code}: ${details.join('; ')}` : code);
    this.name = 'ServiceError';
  }
}

export type Actor = { kind: 'citizen'; id: string } | { kind: 'staff'; id: string };

/** A signed-in staff member (F05: password and TOTP done) with their roles (M15-FR-01). */
export interface StaffActor {
  id: string;
  name: string;
  roles: readonly string[];
}
