/** M09-AC-1.2 · SLA in working days (Q-08 default): Mon–Fri minus holidays; days ending in `awaiting_citizen` do not count. */
import type { CaseState } from './caseLifecycle';

/** India Standard Time — fixed offset, no daylight saving. */
const IST_MS = 330 * 60_000;
const DAY_MS = 86_400_000;
export const SLA_TARGET_DAYS = 3;

export type SlaStatus = 'on_track' | 'due_today' | 'overdue' | 'paused' | 'met' | 'missed' | 'stopped';

export interface SlaInput {
  createdAt: Date;
  /** State changes in time order (the case starts in `new`). */
  events: { to: CaseState; at: Date }[];
  holidays?: readonly string[];
  now: Date;
}

export interface Sla {
  /** Working days counted so far (the request day is day 1 unless it ended paused). */
  day: number;
  /** The working day by which filing is due (YYYY-MM-DD, IST), projected without further pauses. */
  due: string;
  status: SlaStatus;
}

export const istDate = (d: Date) => new Date(d.getTime() + IST_MS).toISOString().slice(0, 10);
const endOfIstDay = (iso: string) => new Date(Date.parse(`${iso}T00:00:00Z`) - IST_MS + DAY_MS - 1);
const addDays = (iso: string, n: number) => new Date(Date.parse(`${iso}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);

export function isWorkingDay(iso: string, holidays: readonly string[] = []): boolean {
  const weekday = new Date(`${iso}T00:00:00Z`).getUTCDay();
  return weekday !== 0 && weekday !== 6 && !holidays.includes(iso);
}

function stateAt(input: SlaInput, at: Date): CaseState {
  let state: CaseState = 'new';
  for (const e of input.events) if (e.at.getTime() <= at.getTime()) state = e.to;
  return state;
}

const STOPPED: readonly CaseState[] = ['filed', 'with_authority', 'completed'];
const ENDED: readonly CaseState[] = ['closed_not_proceeding', 'withdrawn'];

export function computeSla(input: SlaInput): Sla {
  const holidays = input.holidays ?? [];
  const filedAt = input.events.find((e) => e.to === 'filed')?.at;
  const endedAt = input.events.find((e) => ENDED.includes(e.to))?.at;
  const stopAt = filedAt ?? endedAt ?? input.now;
  const last = istDate(stopAt);
  let day = 0;
  let cursor = istDate(input.createdAt);
  let due: string | null = null;
  for (; cursor <= last; cursor = addDays(cursor, 1)) {
    if (!isWorkingDay(cursor, holidays)) continue;
    const checkAt = cursor === last ? stopAt : endOfIstDay(cursor);
    if (stateAt(input, checkAt) === 'awaiting_citizen') continue;
    day++;
    if (day === SLA_TARGET_DAYS) due = cursor;
  }
  // Project the due day forward, assuming no further pauses.
  let projected = day;
  let next = last;
  while (!due) {
    next = addDays(next, 1);
    if (!isWorkingDay(next, holidays)) continue;
    projected++;
    if (projected >= SLA_TARGET_DAYS) due = next;
  }
  if (day >= SLA_TARGET_DAYS && !due) due = last;
  const current = stateAt(input, input.now);
  let status: SlaStatus;
  if (filedAt) status = day <= SLA_TARGET_DAYS ? 'met' : 'missed';
  else if (endedAt) status = 'stopped';
  else if (current === 'awaiting_citizen') status = 'paused';
  else if (day > SLA_TARGET_DAYS) status = 'overdue';
  else if (day === SLA_TARGET_DAYS) status = 'due_today';
  else status = 'on_track';
  return { day, due: due!, status };
}

// ---------------------------------------------------------------- queue order (M09-EX-order, Q-09)

export type PriorityFlag = 'age60' | 'disability' | 'deadline';

export interface QueueItem {
  priority: readonly PriorityFlag[];
  /** YYYY-MM-DD */
  deadline?: string | null;
  /** YYYY-MM-DD */
  due: string;
  createdAt?: Date;
}

/** 0 = deadline within 7 days, 1 = age 60+ or disability, 2 = normal. */
export function priorityRank(item: QueueItem, today: string): number {
  if (item.priority.includes('deadline') && item.deadline && item.deadline <= addDays(today, 7)) return 0;
  if (item.priority.includes('age60') || item.priority.includes('disability')) return 1;
  return 2;
}

export function orderQueue<T extends QueueItem>(items: readonly T[], today: string): T[] {
  return [...items].sort(
    (a, b) =>
      priorityRank(a, today) - priorityRank(b, today) ||
      a.due.localeCompare(b.due) ||
      (a.createdAt?.getTime() ?? 0) - (b.createdAt?.getTime() ?? 0),
  );
}

// ---------------------------------------------------------------- names (M09-EX-mask, M04-EX-staff-name)

const parts = (name: string) => name.trim().split(/\s+/).filter(Boolean);

/** "Mohammed Ibrahim" → "Mohammed I." — for queues and for showing a volunteer to a citizen. */
export function shortName(name: string | null | undefined, empty = '(no name given)'): string {
  const p = parts(name ?? '');
  if (p.length === 0) return empty;
  if (p.length === 1) return p[0]!;
  return `${p[0]} ${p[p.length - 1]![0]!.toUpperCase()}.`;
}
