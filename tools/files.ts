import { execFileSync } from 'node:child_process';
import { repoRoot } from './spec/specs';

/** Tracked plus new (not ignored) files, relative to the repo root. */
export function listTrackedFiles(): string[] {
  return execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], { cwd: repoRoot, encoding: 'utf8' })
    .split('\n')
    .filter(Boolean);
}
