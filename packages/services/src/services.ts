/** Application services for the Full Check (M16, M17, F06): everything the web app does with citizen data. */
import type { KnowledgeBase } from '@identity/content';
import type { Db, Keyring, ObjectStore } from '@identity/db';
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
  | 'reason_required';

/** A refusal the citizen can act on; the web layer turns the code into a message. */
export class ServiceError extends Error {
  constructor(readonly code: ErrorCode) {
    super(code);
    this.name = 'ServiceError';
  }
}

export type Actor = { kind: 'citizen'; id: string } | { kind: 'staff'; id: string };
