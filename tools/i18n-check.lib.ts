/** F04-AC-3.1 · Every locale has every key, non-empty, with the same {placeholders}. */
export type MessageTree = { [key: string]: string | MessageTree };

function flatten(tree: MessageTree, prefix = ''): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(tree)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'string') out[path] = v;
    else Object.assign(out, flatten(v, path));
  }
  return out;
}

const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

export function checkMessages(byLocale: Record<string, MessageTree>, source = 'en'): string[] {
  const errors: string[] = [];
  const base = flatten(byLocale[source] ?? {});
  for (const [locale, tree] of Object.entries(byLocale)) {
    const flat = flatten(tree);
    for (const key of Object.keys(base)) {
      const value = flat[key];
      if (value === undefined) errors.push(`${locale}: missing "${key}"`);
      else if (!value.trim()) errors.push(`${locale}: empty "${key}"`);
      else if (placeholders(value) !== placeholders(base[key]!)) errors.push(`${locale}: placeholders differ in "${key}"`);
    }
    for (const key of Object.keys(flat)) if (!(key in base)) errors.push(`${locale}: unexpected key "${key}" (not in ${source})`);
  }
  return errors;
}
