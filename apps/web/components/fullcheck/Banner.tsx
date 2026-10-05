import type { ReactNode } from 'react';

const tones = {
  success: 'border-emerald-600 bg-emerald-50 text-emerald-700',
  error: 'border-coral-500 bg-coral-50 text-coral-700',
  info: 'border-sky-500 bg-sky-50 text-ink-900',
  warning: 'border-amber-400 bg-amber-50 text-amber-700',
} as const;

/** A message after an action; errors are announced to screen readers. */
export function Banner({ tone, children, testId }: { tone: keyof typeof tones; children: ReactNode; testId?: string }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} data-testid={testId ?? `banner-${tone}`} className={`rounded-xl border-2 p-4 font-semibold ${tones[tone]}`}>
      {children}
    </div>
  );
}
