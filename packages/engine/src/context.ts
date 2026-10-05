/** Dictionaries built once from content: names (M02), places and address abbreviations (F02 v0.3). */
import { seedBundle, type KnowledgeBase, type NameVariantGroup } from '@identity/content';
import { buildNameDictionary, type NameDictionary } from '@identity/rules';

export interface EngineContext {
  kb: KnowledgeBase;
  names: NameDictionary;
  /** word → canonical place */
  places: Map<string, string>;
  /** short → long words */
  abbreviations: Map<string, string[]>;
  ignore: Set<string>;
}

export function createContext(kb: KnowledgeBase, nameGroups: readonly NameVariantGroup[] = seedBundle.nameVariants.groups): EngineContext {
  const places = new Map<string, string>();
  for (const g of kb.placeVariants.groups) for (const v of g.variants) places.set(v, g.canonical);
  const abbreviations = new Map<string, string[]>();
  for (const e of kb.addressAbbreviations.entries) abbreviations.set(e.short, e.long.split(' '));
  return { kb, names: buildNameDictionary(nameGroups), places, abbreviations, ignore: new Set(kb.addressAbbreviations.ignore) };
}
