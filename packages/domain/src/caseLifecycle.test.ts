import { describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import {
  CASE_STATES,
  INITIAL_STATE,
  STATE_INFO,
  formatCaseId,
  isCaseId,
  slaClock,
  transition,
  type CaseState,
  type ClosureReason,
} from './caseLifecycle';

describe('F01 case lifecycle', () => {
  it('@F01-AC-1.1 a new case is "new" and the citizen sees "Request received"', () => {
    expect(INITIAL_STATE).toBe('new');
    expect(STATE_INFO[INITIAL_STATE].citizenStage).toBe('request_received');
  });

  it('@F01-AC-1.2 filed → with_authority shows "With the authority"', () => {
    const r = transition('filed', 'with_authority');
    expect(r).toEqual({ ok: true, state: 'with_authority' });
    expect(STATE_INFO.with_authority.citizenStage).toBe('with_authority');
  });

  it('@F01-AC-1.3 new → completed is rejected and the state is unchanged', () => {
    expect(transition('new', 'completed')).toEqual({ ok: false, error: 'not_allowed', state: 'new' });
  });

  it('@F01-AC-2.1 the SLA clock pauses only while awaiting the citizen', () => {
    for (const s of CASE_STATES) {
      if (s === 'awaiting_citizen') expect(slaClock(s)).toBe('paused');
      else expect(slaClock(s)).not.toBe('paused');
    }
    expect(slaClock('new')).toBe('running');
    expect(slaClock('in_progress')).toBe('running');
  });

  it('@F01-AC-2.2 any non-terminal case can be withdrawn; terminal cases cannot move', () => {
    for (const s of CASE_STATES) {
      const r = transition(s, 'withdrawn');
      expect(r.ok).toBe(!STATE_INFO[s].terminal);
    }
  });

  it('@F01-AC-2.3 closing without a reason is rejected', () => {
    expect(transition('in_progress', 'closed_not_proceeding').ok).toBe(false);
    expect(transition('in_progress', 'closed_not_proceeding', 'duplicate').ok).toBe(true);
  });

  const transitions = loadExample<{
    cases: { from: CaseState; to: CaseState; allowed: boolean; reason?: ClosureReason }[];
  }>('F01', 'F01-EX-transitions');
  it.each(transitions.cases)('F01-EX-transitions $from → $to (reason: $reason) allowed=$allowed', (c) => {
    expect(transition(c.from, c.to, c.reason).ok).toBe(c.allowed);
  });

  it('@F01-AC-3.1 F01-EX-case-ids format and validate case IDs', () => {
    const ex = loadExample<{ cases: { number: number; formatted: string }[]; valid: string[]; invalid: unknown[] }>(
      'F01',
      'F01-EX-case-ids',
    );
    for (const c of ex.cases) expect(formatCaseId(c.number)).toBe(c.formatted);
    for (const v of ex.valid) expect(isCaseId(v)).toBe(true);
    for (const v of ex.invalid) expect(isCaseId(v)).toBe(false);
  });
});
