import { describe, expect, it } from 'vitest';
import { checkMessages } from './i18n-check.lib';
import { buildTrace } from './trace.lib';

// A made-up spec. IDs are built at run time so this file doesn't itself reference them (the tracer scans test files).
const S = ['M', '99'].join('');

const spec = (status: string) => ({
  id: S,
  dir: `${S}-example`,
  status,
  version: '0.1',
  text: [
    `- **${S}-AC-1.1** — Given …`,
    `- **${S}-AC-1.2** — Given …`,
    `- **${S}-FR-01** — The system MUST …`,
    '```yaml',
    `id: ${S}-EX-sample`,
    'cases: []',
    '```',
  ].join('\n'),
});

describe('F12 traceability', () => {
  it('@F12-AC-3.1 lists each criterion with its tests and flags those with none', () => {
    const result = buildTrace([spec('In review')], [{ path: 'a.test.ts', text: `it('@${S}-AC-1.1 works', …)\nit('${S}-EX-sample', …)` }]);
    const s = result.specs[0]!;
    expect(s.criteria).toEqual([
      { id: `${S}-AC-1.1`, tests: ['a.test.ts:1'] },
      { id: `${S}-AC-1.2`, tests: [] },
    ]);
    expect(s.examples).toEqual([{ id: `${S}-EX-sample`, tests: ['a.test.ts:2'] }]);
    expect(s.frCount).toBe(1);
  });

  it('@F12-AC-3.2 untested criteria fail only once a spec is Approved or later', () => {
    const tests = [{ path: 'a.test.ts', text: `it('@${S}-AC-1.1', …)` }];
    expect(buildTrace([spec('In review')], tests).failures).toEqual([]);
    expect(buildTrace([spec('Approved')], tests).failures).toEqual([`${S}-AC-1.2 (spec ${S} is Approved) has no test`]);
  });

  it('a test that references an ID no spec defines always fails', () => {
    const result = buildTrace([spec('Draft')], [{ path: 'b.spec.ts', text: `test('@${S}-AC-9.9 typo', …)` }]);
    expect(result.failures).toEqual([`b.spec.ts:1 references ${S}-AC-9.9, which no spec defines`]);
  });
});

describe('F04 i18n check', () => {
  it('@F04-AC-3.1 names missing, empty and mismatched keys per language', () => {
    const errors = checkMessages({
      en: { a: 'Hello {name}', b: { c: 'Bye' } },
      kn: { a: 'ನಮಸ್ಕಾರ {name}' },
      hi: { a: 'नमस्ते', b: { c: ' ' } },
    });
    expect(errors).toEqual(['kn: missing "b.c"', 'hi: placeholders differ in "a"', 'hi: empty "b.c"']);
  });
});

describe('F12 CI pipeline', () => {
  it('@F12-AC-1.1 every pull request runs all the quality gates', async () => {
    const { readFileSync } = await import('node:fs');
    const { join } = await import('node:path');
    const { parse } = await import('yaml');
    const { repoRoot } = await import('./spec/specs');
    const workflow = parse(readFileSync(join(repoRoot, '.github/workflows/ci.yml'), 'utf8')) as {
      on: Record<string, unknown>;
      jobs: Record<string, { steps: { run?: string }[] }>;
    };
    expect(Object.keys(workflow.on)).toContain('pull_request');
    const commands = Object.values(workflow.jobs).flatMap((j) => j.steps.map((s) => s.run ?? ''));
    for (const required of [
      'npm run typecheck',
      'npm test',
      'npm run check:i18n',
      'npm run check:aadhaar',
      'npm run check:content',
      'npm run trace',
      'npm run build',
      'npm run test:e2e',
    ]) {
      expect(commands, required).toContain(required);
    }
  });
});
