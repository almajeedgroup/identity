import type { Permission } from '@identity/db';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { staffSignOutAction } from '@/lib/server/staff-actions';
import { ROLE_LABELS } from '@/lib/staff-text';

const NAV: { href: string; label: string; permission: Permission }[] = [
  { href: '/staff', label: 'Dashboard', permission: 'dashboard.read' },
  { href: '/staff/cases', label: 'Cases', permission: 'cases.work' },
  { href: '/staff/customers', label: 'Customers', permission: 'customers.read' },
  { href: '/staff/rules', label: 'Rules', permission: 'rules.read' },
  { href: '/staff/audit', label: 'Audit log', permission: 'audit.read' },
  { href: '/staff/team', label: 'Team', permission: 'staff.manage' },
];

/** Staff pages: header, navigation limited to what the role can open, and sign-out. */
export function StaffShell({ name, roles, can, title, children }: { name: string; roles: string[]; can: (p: Permission) => boolean; title: string; children: ReactNode }) {
  return (
    <>
      <header className="bg-ink-900 text-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <Link href="/staff" className="flex min-h-12 items-center gap-2 text-white no-underline">
            <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-600 text-lg font-extrabold">
              1
            </span>
            <span className="text-lg font-extrabold">1dentity staff</span>
          </Link>
          <div className="flex items-center gap-3 text-[0.9375rem]">
            <span>
              {name} · {roles.map((r) => ROLE_LABELS[r] ?? r).join(', ')}
            </span>
            <form action={staffSignOutAction}>
              <button type="submit" className="min-h-12 rounded-xl border-2 border-white px-3 font-bold">
                Sign out
              </button>
            </form>
          </div>
        </div>
        <nav aria-label="Staff console" className="mx-auto max-w-5xl px-4 pb-2">
          <ul className="flex flex-wrap gap-1">
            {NAV.filter((n) => can(n.permission)).map((n) => (
              <li key={n.href}>
                <Link href={n.href} className="inline-flex min-h-12 items-center rounded-lg px-3 font-semibold text-mint-300 hover:bg-white/10">
                  {n.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>
      <main id="main" className="mx-auto max-w-5xl space-y-6 px-4 py-6">
        <h1 className="text-[2rem] leading-tight font-extrabold">{title}</h1>
        {children}
      </main>
    </>
  );
}

export function Notice({ tone, children }: { tone: 'success' | 'error'; children: ReactNode }) {
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} data-testid={`staff-${tone}`} className={`rounded-xl border-2 p-4 font-semibold ${tone === 'error' ? 'border-coral-500 bg-coral-50 text-coral-700' : 'border-emerald-600 bg-emerald-50 text-emerald-700'}`}>
      {children}
    </div>
  );
}
