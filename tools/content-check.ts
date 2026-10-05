/** npm run check:content — F02-FR-07 validation, plus freshness and expiry warnings (report only). */
import { freshness, seedBundle, seedKnowledgeBase, todayInIndia, upcomingExpiries, validateBundle, validateKnowledgeBase } from '@identity/content';

const result = validateBundle(seedBundle);
if (!result.ok) {
  console.error(`Content bundle is invalid:\n${result.errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
const asOf = todayInIndia();
const items = [...seedBundle.documents, ...seedBundle.links, ...seedBundle.actions];
const byFreshness = items.reduce<Record<string, number>>((acc, item) => {
  const f = freshness(item.meta, asOf);
  acc[f] = (acc[f] ?? 0) + 1;
  return acc;
}, {});
console.log(`Content bundle ${seedBundle.version} is valid.`);

const kb = validateKnowledgeBase(seedKnowledgeBase);
if (!kb.ok) {
  console.error(`Knowledge base is invalid:\n${kb.errors.map((e) => `  - ${e}`).join('\n')}`);
  process.exit(1);
}
const unverifiedRules = seedKnowledgeBase.rules.filter((r) => !r.meta.lastVerified).length;
console.log(`Knowledge base ${seedKnowledgeBase.version} is valid: ${seedKnowledgeBase.catalogue.length} documents, ${seedKnowledgeBase.rules.length} rules (${unverifiedRules} not yet verified — warning only until O03 starts).`);
console.log(`Freshness on ${asOf}: ${Object.entries(byFreshness).map(([k, v]) => `${k} ${v}`).join(', ')} (warning only until O03 starts).`);
for (const alert of upcomingExpiries(seedBundle, asOf)) {
  console.warn(`Expiring: ${alert.kind} ${alert.id} on ${alert.effectiveTo} (${alert.daysLeft} days) — owner: ${alert.owner}`);
}
