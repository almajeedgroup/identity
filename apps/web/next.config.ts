import type { NextConfig } from 'next';

const isDev = process.env.NODE_ENV !== 'production';

/**
 * C-14: no third-party scripts, fonts or trackers — everything is served from our own origin.
 * C-07: framing denied; no referrer is sent to official portals we link to.
 */
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  `connect-src 'self'${isDev ? ' ws:' : ''}`,
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const nextConfig: NextConfig = {
  poweredByHeader: false,
  reactStrictMode: true,
  transpilePackages: ['@identity/content', '@identity/db', '@identity/domain', '@identity/engine', '@identity/ocr', '@identity/rules', '@identity/ui'],
  // WebAssembly and worker-based packages load from node_modules at runtime (ADR-011, ADR-012).
  serverExternalPackages: ['@electric-sql/pglite', 'pg', 'tesseract.js', 'tesseract.js-core', 'pdfjs-dist'],
  experimental: {
    globalNotFound: true,
    // M17 · uploads up to 10 MB (F07-AC-3.1).
    serverActions: { bodySizeLimit: '11mb' },
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), payment=()' },
        ],
      },
    ];
  },
};

export default nextConfig;
