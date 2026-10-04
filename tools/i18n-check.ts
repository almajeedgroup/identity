/** npm run check:i18n */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { repoRoot } from './spec/specs';
import { checkMessages, type MessageTree } from './i18n-check.lib';

const dir = join(repoRoot, 'apps/web/messages');
const byLocale = Object.fromEntries(
  readdirSync(dir)
    .filter((f) => f.endsWith('.json'))
    .map((f) => [f.replace(/\.json$/, ''), JSON.parse(readFileSync(join(dir, f), 'utf8')) as MessageTree]),
);
const errors = checkMessages(byLocale);
if (errors.length) {
  console.error(`i18n check failed:\n${errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
console.log(`i18n check passed: ${Object.keys(byLocale).sort().join(', ')} have identical keys and placeholders.`);
