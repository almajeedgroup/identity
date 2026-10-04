/** F02-FR-07 · Bundle validation: schema plus cross-references. */
import { ContentBundle } from './schema';

export type ValidationResult = { ok: true; bundle: ContentBundle } | { ok: false; errors: string[] };

export function validateBundle(input: unknown): ValidationResult {
  const parsed = ContentBundle.safeParse(input);
  if (!parsed.success) {
    return {
      ok: false,
      errors: parsed.error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`),
    };
  }
  const bundle = parsed.data;
  const errors: string[] = [];

  const duplicates = (ids: string[], what: string) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) errors.push(`${what} id "${id}" is used more than once`);
      seen.add(id);
    }
  };
  duplicates(bundle.documents.map((d) => d.id), 'document');
  duplicates(bundle.links.map((l) => l.id), 'link');
  duplicates(bundle.actions.map((a) => a.id), 'action');
  duplicates(bundle.actions.flatMap((a) => a.fees.map((f) => f.id)), 'fee');

  const linkIds = new Set(bundle.links.map((l) => l.id));
  for (const action of bundle.actions) {
    for (const link of action.links) {
      if (!linkIds.has(link)) errors.push(`action "${action.id}" refers to unknown link "${link}"`);
    }
    const doc = bundle.documents.find((d) => d.kind === action.document);
    if (!doc) errors.push(`action "${action.id}" is for document "${action.document}", which is not in the bundle`);
  }

  const tokens = new Map<string, string>();
  for (const group of bundle.nameVariants.groups) {
    for (const token of [...group.variants, ...group.abbreviations]) {
      const other = tokens.get(token);
      if (other && other !== group.canonical) errors.push(`name token "${token}" is in groups "${other}" and "${group.canonical}"`);
      tokens.set(token, group.canonical);
    }
    if (!group.variants.includes(group.canonical)) errors.push(`name group "${group.canonical}" must list its canonical form as a variant`);
  }

  return errors.length ? { ok: false, errors } : { ok: true, bundle };
}
