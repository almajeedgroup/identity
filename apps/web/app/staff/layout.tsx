import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { HydrationMarker } from '@/components/HydrationMarker';
import '../fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: { default: '1dentity staff console', template: '%s · 1dentity staff' },
  robots: { index: false, follow: false },
};

/** M15-FR-09 · The staff console has its own root layout, outside the citizen app. */
export default function StaffLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans">
        {children}
        <HydrationMarker />
      </body>
    </html>
  );
}
