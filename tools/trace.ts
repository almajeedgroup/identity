/** npm run trace — writes docs/traceability.md; fails on blocking gaps (F12-AC-3.1, 3.2). */
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { listTrackedFiles } from './files';
import { listSpecs, repoRoot } from './spec/specs';
import { buildTrace, renderTrace } from './trace.lib';

const testFiles = listTrackedFiles()
  .filter((p) => /\.(test|spec)\.tsx?$/.test(p))
  .map((path) => ({ path, text: readFileSync(join(repoRoot, path), 'utf8') }));

const result = buildTrace(listSpecs(), testFiles);
writeFileSync(join(repoRoot, 'docs/traceability.md'), renderTrace(result));

for (const s of result.specs) {
  const missing = s.criteria.filter((c) => !c.tests.length).map((c) => c.id);
  const note = missing.length ? ` — untested: ${missing.join(', ')}${s.blocking ? '' : ' (report only: spec is not yet approved)'}` : '';
  console.log(`${s.id} [${s.status}] ACs ${s.criteria.length - missing.length}/${s.criteria.length}${note}`);
}
if (result.failures.length) {
  console.error(`\nTraceability check failed:\n${result.failures.map((f) => `  - ${f}`).join('\n')}`);
  process.exit(1);
}
console.log('\nTraceability check passed. Report: docs/traceability.md');
