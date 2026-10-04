import type { ScoreBand } from '@identity/rules';

const ring: Record<ScoreBand, string> = {
  all_valid: 'var(--color-emerald-600)',
  good: 'var(--color-amber-400)',
  needs_attention: 'var(--color-coral-500)',
};

/** Health-score dial. The ring is decorative; the number and label carry the meaning. */
export function ScoreDial({ score, band, label }: { score: number; band: ScoreBand; label: string }) {
  const r = 42;
  const circumference = 2 * Math.PI * r;
  return (
    <div className="relative h-28 w-28 shrink-0" role="img" aria-label={label}>
      <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="var(--color-line-200)" strokeWidth="9" />
        <circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={ring[band]}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`}
        />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[2rem] font-extrabold" aria-hidden="true">
        {score}
      </span>
    </div>
  );
}
