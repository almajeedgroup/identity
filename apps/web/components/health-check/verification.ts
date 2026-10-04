/** F02-AC-1.3 · What a citizen is told about how current an item is. */
import { freshness, type Meta } from '@identity/content';
import { formatIsoDate } from '@/i18n/format';

export function verificationMessage(meta: Pick<Meta, 'lastVerified'>, asOf: string): { key: string; vars?: { date: string } } {
  switch (freshness(meta, asOf)) {
    case 'unverified':
      return { key: 'result.unverified' };
    case 'rechecking':
      return { key: 'result.rechecking' };
    default:
      return { key: 'result.verified', vars: { date: formatIsoDate(meta.lastVerified!) } };
  }
}
