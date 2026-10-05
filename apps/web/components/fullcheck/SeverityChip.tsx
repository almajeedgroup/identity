import type { Status } from '@identity/engine';
import { STATUS_COLOUR } from '@identity/engine';

/** M02-FR-15 · The six comparison statuses: colour, icon and word together — never colour alone (C-09). */
const tone = {
  green: 'bg-emerald-50 text-emerald-700',
  yellow: 'bg-yellow-50 text-yellow-700',
  orange: 'bg-orange-50 text-orange-700',
  red: 'bg-coral-50 text-coral-700',
  grey: 'bg-slate-50 text-slate-500',
} as const;

function Icon({ status }: { status: Status }) {
  const common = { width: 16, height: 16, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 2, 'aria-hidden': true } as const;
  switch (status) {
    case 'exact_match':
    case 'formatting_variation':
      return (
        <svg {...common} data-icon="check">
          <path d="M3 8.5l3 3 7-7" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case 'likely_equivalent':
      return (
        <svg {...common} data-icon="approx">
          <path d="M3 6.5c1.5-1.5 3-1.5 5 0s3.5 1.5 5 0M3 10.5c1.5-1.5 3-1.5 5 0s3.5 1.5 5 0" strokeLinecap="round" />
        </svg>
      );
    case 'potential_discrepancy':
      return (
        <svg {...common} data-icon="warning">
          <path d="M8 2.5l6 11H2l6-11z" strokeLinejoin="round" />
          <path d="M8 6.5v3.5M8 12v.01" strokeLinecap="round" />
        </svg>
      );
    case 'major_discrepancy':
      return (
        <svg {...common} data-icon="cross">
          <path d="M4 4l8 8M12 4l-8 8" strokeLinecap="round" />
        </svg>
      );
    case 'missing':
      return (
        <svg {...common} data-icon="dash">
          <path d="M4 8h8" strokeLinecap="round" />
        </svg>
      );
  }
}

export function SeverityChip({ status, label }: { status: Status; label: string }) {
  const colour = STATUS_COLOUR[status];
  return (
    <span
      data-status={status}
      data-colour={colour}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[0.8125rem] font-bold whitespace-nowrap ${tone[colour]}`}
    >
      <Icon status={status} />
      <span>{label}</span>
    </span>
  );
}
