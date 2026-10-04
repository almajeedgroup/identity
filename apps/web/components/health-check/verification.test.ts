import { describe, expect, it } from 'vitest';
import { verificationMessage } from './verification';

describe('F02 verification status shown to citizens', () => {
  it('@F02-AC-1.3 shows the last-verified date when there is one, and says "not yet verified" when there is not', () => {
    expect(verificationMessage({ lastVerified: '2026-11-01' }, '2026-11-20')).toEqual({ key: 'result.verified', vars: { date: '01-11-2026' } });
    expect(verificationMessage({ lastVerified: '2026-11-01' }, '2026-12-10')).toEqual({ key: 'result.verified', vars: { date: '01-11-2026' } });
    expect(verificationMessage({ lastVerified: null }, '2026-11-20')).toEqual({ key: 'result.unverified' });
    expect(verificationMessage({ lastVerified: '2026-11-01' }, '2026-12-31')).toEqual({ key: 'result.rechecking' });
  });
});
