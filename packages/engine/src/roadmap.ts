/** M18 · Correction roadmap and dependency engine. A pure function; recommendations, not rulings (C-18). */
import {
  appliesOn,
  authorityFor,
  catalogueEntry,
  selectRule,
  servicePriceFor,
  type ComparedField,
  type CorrectionRule,
  type DocumentKind,
  type KnowledgeBase,
  type PrintedField,
  type ServicePrice,
} from '@identity/content';
import type { EngineContext } from './context';
import type { Analysis, Issue } from './types';

export type StepReason = 'prerequisite' | 'foundational_first' | 'prerequisite_for_others' | 'independent';

export interface CorrectionStep {
  kind: 'correction';
  id: string;
  document: string;
  documentKind: DocumentKind;
  tier: number;
  /** null when the knowledge base has no usable rule: authority only, nothing invented (M18-AC-2.2). */
  rule: { id: string; version: number; status: CorrectionRule['meta']['status'] } | null;
  authority: string | null;
  verified: boolean;
  lastVerified: string | null;
  sources: string[];
  issues: Issue[];
  reason: StepReason;
  dependsOn: string[];
  governmentFees: CorrectionRule['fees'];
  /** C-01: the 1dentity service fee, separate from government fees; null = "to be confirmed". */
  serviceFee: ServicePrice | null;
}

export type RoadmapStep = { kind: 'confirm_targets'; fields: ComparedField[] } | CorrectionStep | { kind: 'recheck' };

export interface RoadmapWarning {
  kind: 'rule_cycle';
  rules: string[];
}

export interface Roadmap {
  steps: RoadmapStep[];
  warnings: RoadmapWarning[];
}

export interface RoadmapOptions {
  jurisdiction: string;
  asOf: string;
}

interface Edge {
  from: string;
  to: string;
  type: 'prerequisite' | 'tier';
  rule?: string;
}

/** Look up a rule for an issue, trying the printed field (e.g. relative_name) when the compared field has none. */
function ruleFor(kb: KnowledgeBase, issue: Issue, opts: RoadmapOptions): CorrectionRule | null {
  return (
    selectRule(kb, issue.kind, issue.field as PrintedField, opts.jurisdiction, opts.asOf) ??
    (issue.printedAs !== issue.field ? selectRule(kb, issue.kind, issue.printedAs, opts.jurisdiction, opts.asOf) : null)
  );
}

export function buildRoadmap(analysis: Analysis, ctx: EngineContext, opts: RoadmapOptions): Roadmap {
  const { kb } = ctx;
  if (analysis.issues.length === 0) return { steps: [], warnings: [] };

  // M18-FR-03 · one step per (document, rule)
  const steps = new Map<string, CorrectionStep>();
  const rulesById = new Map<string, CorrectionRule>();
  for (const doc of analysis.documents) {
    for (const issue of analysis.issues.filter((i) => i.document === doc.id)) {
      const rule = ruleFor(kb, issue, opts);
      if (rule) rulesById.set(rule.id, rule);
      const id = `${doc.id}:${rule?.id ?? 'none'}`;
      let step = steps.get(id);
      if (!step) {
        step = {
          kind: 'correction',
          id,
          document: doc.id,
          documentKind: doc.kind,
          tier: doc.tier,
          rule: rule ? { id: rule.id, version: rule.meta.version, status: rule.meta.status } : null,
          authority: rule?.authority ?? authorityFor(kb, doc.kind, opts.jurisdiction)?.id ?? null,
          verified: !!rule && rule.meta.status === 'published' && !!rule.meta.lastVerified,
          lastVerified: rule?.meta.lastVerified ?? null,
          sources: rule?.sources ?? [],
          issues: [],
          reason: 'independent',
          dependsOn: [],
          governmentFees: rule ? rule.fees.filter((f) => appliesOn(f.meta, opts.asOf)) : [],
          serviceFee: servicePriceFor(kb, 'assistance', doc.kind, opts.asOf),
        };
        steps.set(id, step);
      }
      step.issues.push(issue);
    }
  }
  const nodes = [...steps.values()];
  const fieldsOf = (s: CorrectionStep) => new Set<string>(s.issues.flatMap((i) => [i.field, i.printedAs]));

  // M18-FR-04 · edges
  let edges: Edge[] = [];
  for (const to of nodes) {
    const rule = to.rule ? rulesById.get(to.rule.id) : undefined;
    for (const from of nodes) {
      if (from === to) continue;
      const prerequisite = rule?.prerequisites.find((p) => p.document === from.documentKind && p.fields.some((f) => fieldsOf(from).has(f)));
      if (prerequisite) edges.push({ from: from.id, to: to.id, type: 'prerequisite', rule: rule!.id });
      if (from.tier < to.tier && [...fieldsOf(from)].some((f) => fieldsOf(to).has(f))) edges.push({ from: from.id, to: to.id, type: 'tier' });
    }
  }

  const rank = (s: CorrectionStep) => [s.tier, analysis.documents.findIndex((d) => d.id === s.document), s.rule ? rulesById.get(s.rule.id)!.priority : Number.MAX_SAFE_INTEGER, s.id] as const;
  const compare = (a: CorrectionStep, b: CorrectionStep) => {
    const [ra, rb] = [rank(a), rank(b)];
    for (let i = 0; i < ra.length; i++) if (ra[i] !== rb[i]) return ra[i]! < rb[i]! ? -1 : 1;
    return 0;
  };
  const topo = (es: Edge[]): CorrectionStep[] | null => {
    const indegree = new Map(nodes.map((n) => [n.id, 0]));
    for (const e of es) indegree.set(e.to, indegree.get(e.to)! + 1);
    const ready = nodes.filter((n) => indegree.get(n.id) === 0);
    const out: CorrectionStep[] = [];
    while (ready.length) {
      ready.sort(compare);
      const n = ready.shift()!;
      out.push(n);
      for (const e of es.filter((x) => x.from === n.id)) {
        indegree.set(e.to, indegree.get(e.to)! - 1);
        if (indegree.get(e.to) === 0) ready.push(steps.get(e.to)!);
      }
    }
    return out.length === nodes.length ? out : null;
  };

  const warnings: RoadmapWarning[] = [];
  let order = topo(edges);
  if (!order) {
    // M18-FR-05 · drop prerequisite edges among the nodes caught in the cycle; tier edges cannot cycle.
    const ordered = new Set<string>();
    const partial = topoPartial(nodes, edges);
    for (const id of partial) ordered.add(id);
    const stuck = new Set(nodes.map((n) => n.id).filter((id) => !ordered.has(id)));
    const dropped = edges.filter((e) => e.type === 'prerequisite' && stuck.has(e.from) && stuck.has(e.to));
    warnings.push({ kind: 'rule_cycle', rules: [...new Set(dropped.map((e) => e.rule!))].sort() });
    edges = edges.filter((e) => !dropped.includes(e));
    order = topo(edges)!;
  }

  // M18-FR-04a · reasons
  for (const s of order) {
    const incoming = edges.filter((e) => e.to === s.id);
    const outgoing = edges.filter((e) => e.from === s.id);
    s.dependsOn = [...new Set(incoming.map((e) => steps.get(e.from)!.document))];
    s.reason = incoming.some((e) => e.type === 'prerequisite')
      ? 'prerequisite'
      : incoming.length
        ? 'foundational_first'
        : outgoing.some((e) => e.type === 'prerequisite')
          ? 'prerequisite_for_others'
          : outgoing.length
            ? 'foundational_first'
            : 'independent';
  }

  // M18-FR-06 / FR-07
  const unconfirmed = analysis.fields.filter((f) => f.review.length > 0 && f.target?.status === 'suggested').map((f) => f.field);
  return {
    steps: [...(unconfirmed.length ? [{ kind: 'confirm_targets' as const, fields: unconfirmed }] : []), ...order, { kind: 'recheck' as const }],
    warnings,
  };
}

/** Kahn's algorithm without ordering preferences, returning the node ids that could be ordered. */
function topoPartial(nodes: CorrectionStep[], edges: Edge[]): string[] {
  const indegree = new Map(nodes.map((n) => [n.id, 0]));
  for (const e of edges) indegree.set(e.to, indegree.get(e.to)! + 1);
  const ready = nodes.filter((n) => indegree.get(n.id) === 0).map((n) => n.id);
  const out: string[] = [];
  while (ready.length) {
    const id = ready.shift()!;
    out.push(id);
    for (const e of edges.filter((x) => x.from === id)) {
      indegree.set(e.to, indegree.get(e.to)! - 1);
      if (indegree.get(e.to) === 0) ready.push(e.to);
    }
  }
  return out;
}

/** For display: the catalogue tier and authority of a document kind. */
export function documentInfo(kb: KnowledgeBase, kind: DocumentKind, jurisdiction: string) {
  return { tier: catalogueEntry(kb, kind).tier, authority: authorityFor(kb, kind, jurisdiction) };
}
