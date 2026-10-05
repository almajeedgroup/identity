'use client';

import type { ReactNode } from 'react';
import { useFormStatus } from 'react-dom';

/** Disabled while the form is being sent, so a slow phone cannot submit twice. */
export function SubmitButton({ children, variant = 'primary', pendingText }: { children: ReactNode; variant?: 'primary' | 'secondary' | 'danger'; pendingText?: string }) {
  const { pending } = useFormStatus();
  const cls =
    variant === 'primary'
      ? 'btn-primary'
      : variant === 'secondary'
        ? 'btn-secondary'
        : 'inline-flex min-h-12 w-full items-center justify-center rounded-xl bg-coral-700 px-5 py-3 font-bold text-white sm:w-auto';
  return (
    <button type="submit" className={`${cls} disabled:opacity-60`} disabled={pending} aria-disabled={pending}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}
