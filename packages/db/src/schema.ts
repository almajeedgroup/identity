/** F01 v0.3 · PostgreSQL schema (Drizzle, ADR-011) for the PRD §25 entities needed at P0. */
import { sql } from 'drizzle-orm';
import { bigserial, boolean, index, integer, jsonb, pgTable, primaryKey, real, serial, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';

const ts = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });
const created = () => ts('created_at').notNull().defaultNow();

// ---------------------------------------------------------------- identities (F05)

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  mobile: text('mobile').notNull().unique(),
  email: text('email'),
  locale: text('locale').notNull().default('en'),
  createdAt: created(),
  lastSeenAt: ts('last_seen_at'),
});

export const otpChallenges = pgTable(
  'otp_challenges',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    mobile: text('mobile').notNull(),
    codeHash: text('code_hash').notNull(),
    attempts: integer('attempts').notNull().default(0),
    createdAt: created(),
    expiresAt: ts('expires_at').notNull(),
    consumedAt: ts('consumed_at'),
  },
  (t) => [index('otp_challenges_mobile_created').on(t.mobile, t.createdAt)],
);

export const staffUsers = pgTable('staff_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  name: text('name').notNull(),
  passwordHash: text('password_hash').notNull(),
  /** Encrypted (ADR-013). */
  totpSecret: text('totp_secret'),
  totpEnabledAt: ts('totp_enabled_at'),
  totpLastStep: integer('totp_last_step'),
  status: text('status', { enum: ['active', 'suspended', 'offboarded'] }).notNull().default('active'),
  failedAttempts: integer('failed_attempts').notNull().default(0),
  lockedUntil: ts('locked_until'),
  createdAt: created(),
  offboardedAt: ts('offboarded_at'),
});

export const staffRoles = pgTable(
  'staff_roles',
  {
    staffId: uuid('staff_id')
      .notNull()
      .references(() => staffUsers.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
  },
  (t) => [primaryKey({ columns: [t.staffId, t.role] })],
);

export const sessions = pgTable(
  'sessions',
  {
    /** sha256 of the cookie token — never the token itself. */
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['citizen', 'staff'] }).notNull(),
    userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
    staffId: uuid('staff_id').references(() => staffUsers.id, { onDelete: 'cascade' }),
    mfaVerified: boolean('mfa_verified').notNull().default(false),
    createdAt: created(),
    lastSeenAt: ts('last_seen_at').notNull().defaultNow(),
    expiresAt: ts('expires_at').notNull(),
    revokedAt: ts('revoked_at'),
  },
  (t) => [index('sessions_user').on(t.userId), index('sessions_staff').on(t.staffId)],
);

/** F06 · consent per purpose, with the notice version the citizen saw. */
export const consents = pgTable('consents', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  purpose: text('purpose', { enum: ['full_check', 'uploads', 'assistance', 'sms', 'whatsapp'] }).notNull(),
  noticeVersion: text('notice_version').notNull(),
  locale: text('locale').notNull(),
  grantedAt: created(),
  withdrawnAt: ts('withdrawn_at'),
});

// ---------------------------------------------------------------- profile and targets (M16)

export const citizenProfiles = pgTable(
  'citizen_profiles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** "self" now; family members (M07, P1) add other relationships. */
    relationship: text('relationship').notNull().default('self'),
    displayName: text('display_name'),
    jurisdiction: text('jurisdiction').notNull().default('IN-KA'),
    district: text('district'),
    currentAddress: jsonb('current_address'),
    permanentAddress: jsonb('permanent_address'),
    email: text('email'),
    locale: text('locale').notNull().default('en'),
    createdAt: created(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('citizen_profiles_one_self').on(t.userId).where(sql`${t.relationship} = 'self'`)],
);

export const masterValues = pgTable(
  'master_values',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => citizenProfiles.id, { onDelete: 'cascade' }),
    field: text('field').notNull(),
    value: jsonb('value').notNull(),
    source: text('source').notNull(),
    confirmedAt: ts('confirmed_at').notNull().defaultNow(),
    confirmedByKind: text('confirmed_by_kind', { enum: ['citizen', 'staff'] }).notNull(),
    confirmedById: uuid('confirmed_by_id').notNull(),
  },
  (t) => [uniqueIndex('master_values_profile_field').on(t.profileId, t.field)],
);

/**
 * M16-AC-3.3 · Every target change with its old and new value. Kept with the profile (and deleted with it, F06)
 * so personal values never enter the append-only audit log, which records only the field and actor.
 */
export const targetChanges = pgTable(
  'target_changes',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => citizenProfiles.id, { onDelete: 'cascade' }),
    field: text('field').notNull(),
    oldValue: jsonb('old_value'),
    newValue: jsonb('new_value').notNull(),
    actorKind: text('actor_kind', { enum: ['citizen', 'staff'] }).notNull(),
    actorId: uuid('actor_id').notNull(),
    reason: text('reason'),
    createdAt: created(),
  },
  (t) => [index('target_changes_profile').on(t.profileId, t.createdAt)],
);

// ---------------------------------------------------------------- documents (M17, C-16)

export const documents = pgTable(
  'documents',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => citizenProfiles.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    jurisdiction: text('jurisdiction').notNull(),
    issuingAuthority: text('issuing_authority'),
    /** Encrypted (ADR-013); never set for Aadhaar (C-03). */
    numberEncrypted: text('number_encrypted'),
    numberLast4: text('number_last4'),
    issueDate: text('issue_date'),
    expiryDate: text('expiry_date'),
    source: text('source', { enum: ['manual', 'upload'] }).notNull(),
    status: text('status', { enum: ['draft', 'needs_verification', 'verified'] }).notNull().default('draft'),
    currentVersion: integer('current_version').notNull().default(1),
    createdAt: created(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
    verifiedAt: ts('verified_at'),
  },
  (t) => [index('documents_profile').on(t.profileId)],
);

export const documentVersions = pgTable(
  'document_versions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    reason: text('reason').notNull(),
    createdByKind: text('created_by_kind', { enum: ['citizen', 'staff', 'system'] }).notNull(),
    createdAt: created(),
  },
  (t) => [uniqueIndex('document_versions_doc_version').on(t.documentId, t.version)],
);

export const documentFields = pgTable(
  'document_fields',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    documentId: uuid('document_id')
      .notNull()
      .references(() => documents.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),
    field: text('field').notNull(),
    /** As extracted or typed — immutable (database trigger, C-16). */
    original: jsonb('original').notNull(),
    normalised: text('normalised'),
    /** As confirmed by the citizen (C-17); null until confirmed. */
    confirmed: jsonb('confirmed'),
    source: text('source', { enum: ['manual', 'ocr'] }).notNull(),
    confidence: real('confidence'),
    createdAt: created(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [uniqueIndex('document_fields_doc_version_field').on(t.documentId, t.version, t.field)],
);

export const uploads = pgTable('uploads', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull().unique(),
  mime: text('mime').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256: text('sha256').notNull(),
  createdAt: created(),
  purgeAfter: ts('purge_after'),
  purgedAt: ts('purged_at'),
});

export const ocrExtractions = pgTable('ocr_extractions', {
  id: uuid('id').primaryKey().defaultRandom(),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  uploadId: uuid('upload_id').references(() => uploads.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(),
  engineVersion: text('engine_version').notNull(),
  /** Encrypted (ADR-013). */
  rawText: text('raw_text').notNull(),
  meanConfidence: real('mean_confidence'),
  fields: jsonb('fields').notNull(),
  detectedKind: text('detected_kind'),
  createdAt: created(),
});

/** M02-FR-23 / M16-FR-06 */
export const overrides = pgTable('overrides', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => citizenProfiles.id, { onDelete: 'cascade' }),
  documentId: uuid('document_id')
    .notNull()
    .references(() => documents.id, { onDelete: 'cascade' }),
  field: text('field').notNull(),
  decision: text('decision', { enum: ['accepted_equivalent', 'requires_correction'] }).notNull(),
  reason: text('reason').notNull(),
  actorKind: text('actor_kind', { enum: ['citizen', 'staff'] }).notNull(),
  actorId: uuid('actor_id').notNull(),
  createdAt: created(),
  revokedAt: ts('revoked_at'),
});

/** F01-FR-12 · snapshots of what a report said. */
export const analysisRuns = pgTable('analysis_runs', {
  id: uuid('id').primaryKey().defaultRandom(),
  profileId: uuid('profile_id')
    .notNull()
    .references(() => citizenProfiles.id, { onDelete: 'cascade' }),
  kbVersion: text('kb_version').notNull(),
  issueCount: integer('issue_count').notNull(),
  result: jsonb('result').notNull(),
  createdAt: created(),
});

// ---------------------------------------------------------------- assistance cases (M04, M09 · F01 v0.6)

export const cases = pgTable(
  'cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    /** Shown as ID-00042 (F01-FR-08); never enough to open a case. */
    number: serial('number').notNull().unique(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    profileId: uuid('profile_id')
      .notNull()
      .references(() => citizenProfiles.id, { onDelete: 'cascade' }),
    documentId: uuid('document_id').references(() => documents.id, { onDelete: 'set null' }),
    documentKind: text('document_kind').notNull(),
    /** The name the case is about (target name, or the profile's name), shown masked in queues. */
    applicantName: text('applicant_name'),
    /** M04-FR-02 · snapshot at request time. */
    issues: jsonb('issues').notNull(),
    rule: jsonb('rule'),
    governmentFees: jsonb('government_fees').notNull(),
    serviceFee: jsonb('service_fee'),
    helpMode: text('help_mode', { enum: ['desk', 'whatsapp_video', 'doorstep'] }).notNull(),
    priority: jsonb('priority').notNull(),
    deadline: text('deadline'),
    deadlineNote: text('deadline_note'),
    state: text('state').notNull().default('new'),
    closureReason: text('closure_reason'),
    assignedToId: uuid('assigned_to_id').references(() => staffUsers.id, { onDelete: 'set null' }),
    applicationRef: text('application_ref'),
    applicationDate: text('application_date'),
    appointmentAt: ts('appointment_at'),
    nextAction: text('next_action'),
    nextActionDue: text('next_action_due'),
    completedAt: ts('completed_at'),
    completionNote: text('completion_note'),
    endedAt: ts('ended_at'),
    /** M19-FR-01 · the 1dentity service fee for this help (never a government fee). */
    feeStatus: text('fee_status', { enum: ['not_set', 'awaiting_acceptance', 'due', 'paid', 'waived', 'refunded'] }).notNull().default('not_set'),
    feeAmountInr: integer('fee_amount_inr'),
    feeNote: text('fee_note'),
    createdAt: created(),
    updatedAt: ts('updated_at').notNull().defaultNow(),
  },
  (t) => [index('cases_user').on(t.userId), index('cases_state').on(t.state), index('cases_assigned').on(t.assignedToId)],
);

export const caseEvents = pgTable(
  'case_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['state', 'assigned', 'citizen_reply', 'file', 'filed', 'note'] }).notNull(),
    fromState: text('from_state'),
    toState: text('to_state'),
    actorKind: text('actor_kind', { enum: ['citizen', 'staff', 'system'] }).notNull(),
    actorId: uuid('actor_id'),
    reason: text('reason'),
    citizenVisible: boolean('citizen_visible').notNull().default(true),
    at: ts('at').notNull().defaultNow(),
  },
  (t) => [index('case_events_case').on(t.caseId, t.at)],
);

export const caseTasks = pgTable('case_tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => cases.id, { onDelete: 'cascade' }),
  position: integer('position').notNull(),
  label: text('label').notNull(),
  doneAt: ts('done_at'),
  doneById: uuid('done_by_id'),
});

export const caseNotes = pgTable('case_notes', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => cases.id, { onDelete: 'cascade' }),
  visibility: text('visibility', { enum: ['internal', 'citizen'] }).notNull(),
  /** Aadhaar numbers are masked before storing (M09-AC-3.3). */
  body: text('body').notNull(),
  authorKind: text('author_kind', { enum: ['citizen', 'staff'] }).notNull(),
  authorId: uuid('author_id').notNull(),
  createdAt: created(),
});

export const caseFiles = pgTable('case_files', {
  id: uuid('id').primaryKey().defaultRandom(),
  caseId: uuid('case_id')
    .notNull()
    .references(() => cases.id, { onDelete: 'cascade' }),
  storageKey: text('storage_key').notNull().unique(),
  mime: text('mime').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  sha256: text('sha256').notNull(),
  kind: text('kind', { enum: ['citizen', 'staff', 'proof'] }).notNull(),
  label: text('label'),
  uploadedByKind: text('uploaded_by_kind', { enum: ['citizen', 'staff'] }).notNull(),
  uploadedById: uuid('uploaded_by_id').notNull(),
  createdAt: created(),
  purgeAfter: ts('purge_after'),
  purgedAt: ts('purged_at'),
});

/** M19-FR-02 · The service-fee ledger; kept for accounts when a case or account is deleted (only the case ID text stays). */
export const payments = pgTable('payments', {
  id: uuid('id').primaryKey().defaultRandom(),
  /** Receipt R-00001… */
  number: serial('number').notNull().unique(),
  caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
  caseLabel: text('case_label').notNull(),
  kind: text('kind', { enum: ['payment', 'refund'] }).notNull(),
  amountInr: integer('amount_inr').notNull(),
  method: text('method', { enum: ['cash', 'upi', 'card', 'other'] }).notNull(),
  reference: text('reference'),
  note: text('note'),
  recordedById: uuid('recorded_by_id').notNull(),
  at: ts('at').notNull().defaultNow(),
});

/** F08 · In-app notifications and SMS delivery status. Parameters hold no personal data. */
export const notifications = pgTable(
  'notifications',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    caseId: uuid('case_id').references(() => cases.id, { onDelete: 'set null' }),
    documentId: uuid('document_id'),
    params: jsonb('params').notNull().default({}),
    createdAt: created(),
    readAt: ts('read_at'),
    sms: text('sms', { enum: ['none', 'pending', 'sent', 'failed'] }).notNull().default('none'),
    smsAttempts: integer('sms_attempts').notNull().default(0),
    smsSentAt: ts('sms_sent_at'),
    smsError: text('sms_error'),
  },
  (t) => [index('notifications_user').on(t.userId, t.createdAt), index('notifications_sms').on(t.sms)],
);

// ---------------------------------------------------------------- knowledge base (F02 v0.3, F01-FR-11)

export const kbItems = pgTable(
  'kb_items',
  {
    kind: text('kind').notNull(),
    key: text('key').notNull(),
    version: integer('version').notNull(),
    status: text('status', { enum: ['draft', 'in_review', 'published', 'withdrawn'] }).notNull(),
    data: jsonb('data').notNull(),
    note: text('note'),
    createdById: uuid('created_by_id'),
    createdAt: created(),
    /** M13-AC-3.1 */
    publishedById: uuid('published_by_id'),
    publishedAt: ts('published_at'),
    /** M13-FR-06 · Verification of this version's content against an official source; overlaid on meta.lastVerified. */
    verifiedOn: text('verified_on'),
    verifiedById: uuid('verified_by_id'),
    verifiedSource: text('verified_source'),
    verifiedAt: ts('verified_at'),
  },
  (t) => [primaryKey({ columns: [t.kind, t.key, t.version] })],
);

// ---------------------------------------------------------------- audit (M15)

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    at: ts('at').notNull(),
    actorKind: text('actor_kind', { enum: ['citizen', 'staff', 'system', 'anonymous'] }).notNull(),
    actorId: text('actor_id'),
    action: text('action').notNull(),
    subjectKind: text('subject_kind'),
    subjectId: text('subject_id'),
    details: jsonb('details').notNull().default({}),
    prevHash: text('prev_hash').notNull(),
    hash: text('hash').notNull(),
  },
  (t) => [index('audit_logs_action').on(t.action), index('audit_logs_actor').on(t.actorKind, t.actorId), index('audit_logs_at').on(t.at)],
);

/** F05 · development outbox for one-time codes (refused in production). */
export const devOutbox = pgTable('dev_outbox', {
  id: uuid('id').primaryKey().defaultRandom(),
  channel: text('channel').notNull(),
  recipient: text('recipient').notNull(),
  body: text('body').notNull(),
  createdAt: created(),
});
