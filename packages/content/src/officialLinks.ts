/** F02-FR-03 · Official-domain allowlist (constitution C-01). */

/** Government suffixes: only government bodies can register these. */
export const GOVERNMENT_SUFFIXES = ['gov.in', 'nic.in'] as const;

/** Named authorised agencies (seed list; changes need two people — M13). */
export const AUTHORISED_AGENCY_DOMAINS = ['protean-tinpan.com', 'utiitsl.com'] as const;

export type LinkCheck = { ok: true; host: string } | { ok: false; reason: 'invalid_url' | 'not_https' | 'not_official' };

function isSameOrSubdomain(host: string, domain: string): boolean {
  return host === domain || host.endsWith(`.${domain}`);
}

export function checkOfficialUrl(url: string): LinkCheck {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return { ok: false, reason: 'invalid_url' };
  }
  if (parsed.protocol !== 'https:') return { ok: false, reason: 'not_https' };
  const host = parsed.hostname.toLowerCase();
  const allowed = [...GOVERNMENT_SUFFIXES, ...AUTHORISED_AGENCY_DOMAINS].some((d) => isSameOrSubdomain(host, d));
  return allowed ? { ok: true, host } : { ok: false, reason: 'not_official' };
}
