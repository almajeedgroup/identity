/**
 * Reads specs/<ID>-<slug>/spec.md files: status, acceptance criteria,
 * functional requirements and executable examples (fenced yaml blocks with an `id`).
 * Tests load examples from here so the spec stays the single source of truth (ADR-010).
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'yaml';

export const repoRoot = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
export const specsDir = join(repoRoot, 'specs');

const SPEC_DIR = /^([FMDXO]\d{2})-[a-z0-9-]+$/;

export interface SpecFile {
  id: string;
  dir: string;
  path: string;
  status: string;
  version: string;
  text: string;
}

export function listSpecs(): SpecFile[] {
  return readdirSync(specsDir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && SPEC_DIR.test(d.name))
    .map((d) => join(specsDir, d.name, 'spec.md'))
    .filter((p) => existsSync(p))
    .map(readSpecFile)
    .sort((a, b) => a.id.localeCompare(b.id));
}

export function readSpec(id: string): SpecFile {
  const spec = listSpecs().find((s) => s.id === id);
  if (!spec) throw new Error(`Spec ${id} not found under specs/`);
  return spec;
}

function readSpecFile(path: string): SpecFile {
  const dir = dirname(path).split(/[\\/]/).pop()!;
  const id = SPEC_DIR.exec(dir)![1]!;
  const text = readFileSync(path, 'utf8');
  return { id, dir, path, status: tableValue(text, 'Status'), version: tableValue(text, 'Version'), text };
}

function tableValue(text: string, key: string): string {
  const m = new RegExp(`^\\|\\s*\\*\\*${key}\\*\\*\\s*\\|\\s*([^|]+?)\\s*\\|`, 'm').exec(text);
  return m?.[1] ?? '';
}

export function acceptanceCriteria(text: string): string[] {
  return unique([...text.matchAll(/\*\*([FMDXO]\d{2}-AC-\d+\.\d+)\*\*/g)].map((m) => m[1]!));
}

export function functionalRequirements(text: string): string[] {
  return unique([...text.matchAll(/\*\*([FMDXO]\d{2}-FR-\d+)\*\*/g)].map((m) => m[1]!));
}

export function examples(text: string): Map<string, Record<string, unknown>> {
  const found = new Map<string, Record<string, unknown>>();
  for (const m of text.matchAll(/```yaml\n([\s\S]*?)```/g)) {
    const doc = parse(m[1]!) as Record<string, unknown> | null;
    if (doc && typeof doc.id === 'string') {
      if (found.has(doc.id)) throw new Error(`Duplicate example id ${doc.id}`);
      found.set(doc.id, doc);
    }
  }
  return found;
}

/** Load one executable example from a spec, e.g. loadExample('M02', 'M02-EX-irfan'). */
export function loadExample<T = Record<string, unknown>>(specId: string, exampleId: string): T {
  const example = examples(readSpec(specId).text).get(exampleId);
  if (!example) throw new Error(`Example ${exampleId} not found in spec ${specId}`);
  return example as T;
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)];
}
