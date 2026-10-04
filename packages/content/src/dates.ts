/** Calendar dates as ISO strings (YYYY-MM-DD), compared in UTC so results never depend on the device's time zone. */

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export type IsoDate = string;

export function isIsoDate(value: string): boolean {
  const m = ISO.exec(value);
  if (!m) return false;
  const d = new Date(Date.UTC(+m[1]!, +m[2]! - 1, +m[3]!));
  return d.getUTCFullYear() === +m[1]! && d.getUTCMonth() === +m[2]! - 1 && d.getUTCDate() === +m[3]!;
}

function toUtc(value: IsoDate): number {
  if (!isIsoDate(value)) throw new Error(`Not an ISO date: ${value}`);
  const [y, mo, d] = value.split('-').map(Number) as [number, number, number];
  return Date.UTC(y, mo - 1, d);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

/** Today's date in India (Asia/Kolkata), the reference time zone for every rule. */
export function todayInIndia(now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
