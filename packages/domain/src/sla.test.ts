import { describe, expect, it } from 'vitest';
import { loadExample } from '../../../tools/spec/specs';
import type { CaseState } from './caseLifecycle';
import { computeSla, orderQueue, shortName, type PriorityFlag } from './sla';

describe('M09 SLA, queue order and masked names', () => {
  it('@M09-AC-1.2 working days, holidays and pauses are counted as specified', () => {
    const ex = loadExample<{ holidays: string[]; cases: { name: string; created: string; events: { to: CaseState; at: string }[]; now: string; expect: unknown }[] }>('M09', 'M09-EX-sla');
    for (const c of ex.cases) {
      const sla = computeSla({ createdAt: new Date(c.created), events: c.events.map((e) => ({ to: e.to, at: new Date(e.at) })), holidays: ex.holidays, now: new Date(c.now) });
      expect(sla, c.name).toEqual(c.expect);
    }
  });

  it('@M09-AC-1.1 the queue is ordered by priority, then SLA due date', () => {
    const ex = loadExample<{ today: string; cases: { id: string; priority: PriorityFlag[]; deadline?: string; due: string }[]; expect: string[] }>('M09', 'M09-EX-order');
    expect(orderQueue(ex.cases, ex.today).map((c) => c.id)).toEqual(ex.expect);
  });

  it('@M09-AC-2.3 @M04-AC-2.1 names are shown as first name and initial', () => {
    for (const c of loadExample<{ cases: { name: string; masked: string }[] }>('M09', 'M09-EX-mask').cases) expect(shortName(c.name)).toBe(c.masked);
    for (const c of loadExample<{ cases: { name: string; shown: string }[] }>('M04', 'M04-EX-staff-name').cases) expect(shortName(c.name)).toBe(c.shown);
  });
});
