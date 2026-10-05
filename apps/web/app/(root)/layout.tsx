import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { largeTextBootScript } from '@/components/LargeTextToggle';
import '../fonts';
import '../globals.css';

export const metadata: Metadata = {
  title: '1dentity — choose your language',
  description: '1dentity, a unit of Islamic Information Centre. English · ಕನ್ನಡ · हिन्दी · اردو',
};

/** Root layout for the language chooser at "/" (F04-AC-1.1). Locale pages have their own root layout. */
export default function ChooserLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: largeTextBootScript }} />
      </head>
      <body className="font-sans">{children}</body>
    </html>
  );
}
