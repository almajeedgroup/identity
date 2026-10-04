import type { Metadata } from 'next';
import { localeNames, locales } from '@/i18n/config';
import './fonts';
import './globals.css';

export const metadata: Metadata = { title: 'Page not found — Identity' };

/** F04 edge case · Unknown pages and unknown locales: 404 with links to the four languages. */
export default function GlobalNotFound() {
  return (
    <html lang="en" dir="ltr">
      <body className="font-sans">
        <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-6 px-4 py-10">
          <h1 className="text-[2rem] font-extrabold">Page not found</h1>
          <p>
            <span lang="kn">ಪುಟ ಕಂಡುಬಂದಿಲ್ಲ</span> · <span lang="hi">पेज नहीं मिला</span> ·{' '}
            <span lang="ur" dir="rtl">
              صفحہ نہیں ملا
            </span>
          </p>
          <ul className="grid gap-3">
            {locales.map((l) => (
              <li key={l}>
                <a href={`/${l}`} lang={l} className="btn-secondary w-full">
                  {localeNames[l]}
                </a>
              </li>
            ))}
          </ul>
        </main>
      </body>
    </html>
  );
}
