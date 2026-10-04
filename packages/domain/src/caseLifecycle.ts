/** F01 · Case lifecycle — the state machine behind "My case" and the case queue. */

export const CASE_STATES = [
  'new',
  'awaiting_citizen',
  'visit_booked',
  'in_progress',
  'filed',
  'with_authority',
  'completed',
  'closed_not_proceeding',
  'withdrawn',
] as const;
export type CaseState = (typeof CASE_STATES)[number];

export const CLOSURE_REASONS = ['rejected_by_authority', 'not_reachable', 'out_of_scope', 'duplicate', 'other'] as const;
export type ClosureReason = (typeof CLOSURE_REASONS)[number];

export type SlaClock = 'running' | 'paused' | 'stopped';

interface StateInfo {
  /** Citizen-facing stage key (F01-FR-03). Text lives in the app's message files. */
  citizenStage: string;
  staffStage: string;
  sla: SlaClock;
  terminal: boolean;
}

export const STATE_INFO: Record<CaseState, StateInfo> = {
  new: { citizenStage: 'request_received', staffStage: 'new', sla: 'running', terminal: false },
  awaiting_citizen: { citizenStage: 'need_from_you', staffStage: 'awaiting_citizen', sla: 'paused', terminal: false },
  visit_booked: { citizenStage: 'appointment_booked', staffStage: 'visit_booked', sla: 'running', terminal: false },
  in_progress: { citizenStage: 'documents_checked', staffStage: 'in_progress', sla: 'running', terminal: false },
  filed: { citizenStage: 'filed', staffStage: 'filed', sla: 'stopped', terminal: false },
  with_authority: { citizenStage: 'with_authority', staffStage: 'with_authority', sla: 'stopped', terminal: false },
  completed: { citizenStage: 'completed', staffStage: 'completed', sla: 'stopped', terminal: true },
  closed_not_proceeding: { citizenStage: 'closed', staffStage: 'closed', sla: 'stopped', terminal: true },
  withdrawn: { citizenStage: 'withdrawn', staffStage: 'withdrawn', sla: 'stopped', terminal: true },
};

/** F01-FR-04 — allowed moves besides the universal withdrawn / closed_not_proceeding. */
const FORWARD: Record<CaseState, readonly CaseState[]> = {
  new: ['in_progress', 'visit_booked', 'awaiting_citizen'],
  awaiting_citizen: ['in_progress', 'visit_booked'],
  visit_booked: ['in_progress', 'awaiting_citizen'],
  in_progress: ['awaiting_citizen', 'visit_booked', 'filed'],
  filed: ['with_authority', 'completed', 'awaiting_citizen'],
  with_authority: ['completed', 'awaiting_citizen'],
  completed: [],
  closed_not_proceeding: [],
  withdrawn: [],
};

export function isTerminal(state: CaseState): boolean {
  return STATE_INFO[state].terminal;
}

export function slaClock(state: CaseState): SlaClock {
  return STATE_INFO[state].sla;
}

export function allowedTransitions(from: CaseState): CaseState[] {
  if (isTerminal(from)) return [];
  return [...FORWARD[from], 'withdrawn', 'closed_not_proceeding'];
}

export type TransitionResult =
  | { ok: true; state: CaseState }
  | { ok: false; error: 'not_allowed' | 'reason_required'; state: CaseState };

export function transition(from: CaseState, to: CaseState, reason?: ClosureReason): TransitionResult {
  if (!allowedTransitions(from).includes(to)) return { ok: false, error: 'not_allowed', state: from };
  if (to === 'closed_not_proceeding' && !reason) return { ok: false, error: 'reason_required', state: from };
  return { ok: true, state: to };
}

export const INITIAL_STATE: CaseState = 'new';

/** F01-FR-08 — `ID-` followed by at least five digits. */
const CASE_ID = /^ID-\d{5,}$/;

export function formatCaseId(n: number): string {
  if (!Number.isInteger(n) || n < 0) throw new Error('Case number must be a non-negative integer');
  return `ID-${String(n).padStart(5, '0')}`;
}

export function isCaseId(value: unknown): value is string {
  return typeof value === 'string' && CASE_ID.test(value);
}
