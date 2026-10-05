/** Staff console messages (English; C-08 covers citizen screens — M15-FR-09). */
export const STAFF_ERRORS: Record<string, string> = {
  invalid: 'That did not work. Check the details and try again.',
  locked: 'Too many failed attempts. The account is locked for 15 minutes.',
  inactive: 'This account is suspended or offboarded. Ask an admin.',
  not_enrolled: 'Two-step verification is not set up yet. Sign in again.',
  forbidden: 'Your role does not allow this.',
  invalid_json: 'The item is not valid JSON.',
  invalid_kb: 'This change would make the knowledge base invalid.',
  key_mismatch: 'The identifier in the JSON does not match this item. Create a new item instead.',
  invalid_kind: 'Unknown kind of item.',
  not_draft: 'Only drafts can be published or discarded.',
  second_person_required: 'This draft changes a fee or a link, so a different publisher must publish it.',
  no_metadata: 'This kind of item has no verification date.',
  reason_required: 'Please give a reason.',
  invalid_date: 'Use a date in the form YYYY-MM-DD, not in the future.',
  invalid_value: 'One of the values is not valid.',
  not_found: 'Not found.',
  self_lockout: 'You cannot remove your own admin role, suspend or offboard yourself.',
  weak_password: 'Passwords need at least 12 characters.',
  email_taken: 'Someone already uses that email address.',
  no_roles: 'Choose at least one role.',
  invalid_mobile: 'Enter the full 10-digit mobile number.',
  case_closed: 'This case has ended.',
  not_allowed: 'That move is not allowed from the current stage.',
  proof_required: 'Add proof of completion: a file, or a note if the office issues nothing.',
  already_assigned: 'Someone has already taken this case.',
  rejected_aadhaar: 'The file shows a full Aadhaar number, so it was not stored. Ask for a masked copy.',
  bad_type: 'Only JPG, PNG or PDF files.',
  too_large: 'Files can be up to 10 MB.',
};

export const staffError = (code: string | undefined) => (code ? (STAFF_ERRORS[code] ?? 'Something went wrong.') : null);

export const ROLE_LABELS: Record<string, string> = {
  volunteer: 'Volunteer',
  supervisor: 'Supervisor',
  content_editor: 'Content editor',
  publisher: 'Publisher',
  privacy_officer: 'Privacy officer',
  admin: 'Admin',
};

export const KIND_LABELS: Record<string, string> = {
  rule: 'Correction rules',
  authority: 'Authorities',
  source: 'Official sources',
  catalogue: 'Document catalogue',
  jurisdiction: 'Jurisdictions',
  service_price: 'Service prices',
  place_variants: 'Place names',
  address_abbreviations: 'Address abbreviations',
};

export const formatDateTime = (d: Date) => d.toISOString().slice(0, 16).replace('T', ' ') + ' UTC';

export const STAGE_LABELS: Record<string, string> = {
  new: 'New',
  awaiting_citizen: 'Awaiting citizen',
  visit_booked: 'Visit booked',
  in_progress: 'In progress',
  filed: 'Filed',
  with_authority: 'With authority',
  completed: 'Completed',
  closed_not_proceeding: 'Closed',
  withdrawn: 'Withdrawn',
};

export const FEE_LABELS: Record<string, string> = {
  not_set: 'Not set',
  awaiting_acceptance: 'Waiting for the citizen to accept',
  due: 'Due',
  paid: 'Paid',
  waived: 'Waived',
  refunded: 'Refunded',
};
export const METHOD_LABELS: Record<string, string> = { cash: 'Cash', upi: 'UPI', card: 'Card', other: 'Other' };

export const MODE_LABELS: Record<string, string> = { desk: 'Help desk', whatsapp_video: 'WhatsApp video', doorstep: 'Home visit' };
export const PRIORITY_LABELS: Record<string, string> = { age60: '60+', disability: 'Disability', deadline: 'Deadline' };
export const SLA_LABELS: Record<string, string> = {
  on_track: 'On track',
  due_today: 'Due today',
  overdue: 'Overdue',
  paused: 'Paused',
  met: 'Met',
  missed: 'Missed',
  stopped: 'Stopped',
};
