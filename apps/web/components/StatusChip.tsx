/** F03-FR-04 · Status is always icon + word, never colour alone (C-09). */
export type ChipStatus = 'valid' | 'update_due' | 'mismatch' | 'in_progress' | 'ok';

const styles: Record<ChipStatus, string> = {
  valid: 'bg-emerald-50 text-emerald-700',
  ok: 'bg-emerald-50 text-emerald-700',
  update_due: 'bg-amber-50 text-amber-700',
  mismatch: 'bg-coral-50 text-coral-700',
  in_progress: 'bg-sky-50 text-sky-600',
};

function Icon({ status }: { status: ChipStatus }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true } as const;
  switch (status) {
    case 'valid':
    case 'ok':
      return (
        <svg {...common} data-icon="check">
          <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'update_due':
      return (
        <svg {...common} data-icon="clock">
          <circle cx="8" cy="8" r="6" />
          <path d="M8 4.5V8l2.5 1.5" strokeLinecap="round" />
        </svg>
      );
    case 'mismatch':
      return (
        <svg {...common} data-icon="cross">
          <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      );
    case 'in_progress':
      return (
        <svg {...common} data-icon="arrows">
          <path d="M3 6h8l-2-2M13 10H5l2 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
  }
}

export function StatusChip({ status, label }: { status: ChipStatus; label: string }) {
  return (
    <span
      data-status={status}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.8125rem] font-bold whitespace-nowrap ${styles[status]}`}
    >
      <Icon status={status} />
      <span>{label}</span>
    </span>
  );
}
