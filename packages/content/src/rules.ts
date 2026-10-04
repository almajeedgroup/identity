/** F02 · Effective dates, freshness and expiry alerts. */
import { daysBetween, type IsoDate } from './dates';
import type { Action, ContentBundle, Fee, Meta } from './schema';

/** F02-FR-04 — an item applies when effectiveFrom ≤ date ≤ effectiveTo (open ends allowed). */
export function appliesOn(meta: Pick<Meta, 'effectiveFrom' | 'effectiveTo' | 'status'>, asOf: IsoDate): boolean {
  if (meta.status === 'withdrawn') return false;
  if (meta.effectiveFrom && asOf < meta.effectiveFrom) return false;
  if (meta.effectiveTo && asOf > meta.effectiveTo) return false;
  return true;
}

export function resolveFees(action: Action, asOf: IsoDate): Fee[] {
  return action.fees.filter((f) => appliesOn(f.meta, asOf));
}

export type Freshness = 'unverified' | 'fresh' | 'stale' | 'rechecking';
export const STALE_AFTER_DAYS = 35;
export const RECHECK_AFTER_DAYS = 60;

/** F02-FR-05 (Q-18 default thresholds). */
export function freshness(meta: Pick<Meta, 'lastVerified'>, asOf: IsoDate): Freshness {
  if (!meta.lastVerified) return 'unverified';
  const age = daysBetween(meta.lastVerified, asOf);
  if (age >= RECHECK_AFTER_DAYS) return 'rechecking';
  if (age >= STALE_AFTER_DAYS) return 'stale';
  return 'fresh';
}

export interface ExpiryAlert {
  kind: 'action' | 'fee' | 'link' | 'document';
  id: string;
  owner: string;
  effectiveTo: IsoDate;
  daysLeft: number;
}

/** F02-FR-06 — items that stop applying within `withinDays` (and have not already stopped). */
export function upcomingExpiries(bundle: ContentBundle, asOf: IsoDate, withinDays = 30): ExpiryAlert[] {
  const items: { kind: ExpiryAlert['kind']; id: string; meta: Meta }[] = [
    ...bundle.documents.map((d) => ({ kind: 'document' as const, id: d.id, meta: d.meta })),
    ...bundle.links.map((l) => ({ kind: 'link' as const, id: l.id, meta: l.meta })),
    ...bundle.actions.map((a) => ({ kind: 'action' as const, id: a.id, meta: a.meta })),
    ...bundle.actions.flatMap((a) => a.fees.map((f) => ({ kind: 'fee' as const, id: f.id, meta: f.meta }))),
  ];
  return items.flatMap(({ kind, id, meta }) => {
    if (!meta.effectiveTo) return [];
    const daysLeft = daysBetween(asOf, meta.effectiveTo);
    return daysLeft >= 0 && daysLeft <= withinDays
      ? [{ kind, id, owner: meta.owner, effectiveTo: meta.effectiveTo, daysLeft }]
      : [];
  });
}
