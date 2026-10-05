# M13 · Rules admin (knowledge-base management)

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P0 (PRD) — the rules-database admin; the wider Content Manager (guides, explainers, bundles) stays P1 |
| **Spec owner** | Content lead + tech lead |
| **Approvers** | Product owner · Content lead · Privacy & grievance officer |
| **DPR trace** | §05 (content manager), §10 (rules kept current), §12 · **PRD** §14 (rule structure), §15 ("admin-managed rules database … update rules without releasing a new version"), §19 (rule/knowledge-base management), §27 (rules database admin), §28 (source and last-verified date), §29 (configurable pricing), §33 ("rules can be updated without changing application code") |
| **Depends on** | [F02](../F02-content-model/spec.md) v0.3, [F01](../F01-domain-model/spec.md) v0.5, [F05](../F05-auth/spec.md), [M15](../M15-access-audit/spec.md) v0.3 |
| **Version** | 0.2 |

> **Approval note.** Built ahead of approval (DEC-2) in increment 5. Q-21 (build or adopt a CMS) is answered for the rules database: built in-app on the versioned `kb_items` table, because rules are structured data validated by F02, not pages. ADR-003 stays open for guides and explainers (P1).

## 1. Summary

Correction rules, authorities, official sources, the document catalogue, place and address dictionaries and 1dentity's service prices live in the database as **versioned items** (F01-FR-11). Staff with the right role change them in the browser: an editor writes a new version, a publisher publishes it, anyone with editing rights records when it was last checked against the official source. Citizens see a change only once it is published, and every step is audited. Nothing needs a code release.

## 2. Users and scenarios

- A content editor learns that the PAN correction fee changed; they create a new version of the rule with the new fee and the official source.
- A publisher — a different person, because a fee changed — reviews the difference and publishes it; citizens' roadmaps show the new fee within a minute.
- An editor checks the UIDAI page each month and records that the Aadhaar rule was verified today.
- An admin sets the price of 1dentity's assisted help (PRD §29), separate from government fees (C-01).

## 3. User stories

### US1 — See every item and its state *(must)*

- **M13-AC-1.1** — *Given* the knowledge base, *when* a staff member with `rules.read` opens the rules admin, *then* every item is listed by kind with its effective version and status, the newest version if it differs, its owner, and its freshness (`unverified`, `fresh`, `stale`, `rechecking`, F02-FR-05); staff without `rules.read` get "not found" and an `access.denied` event.

### US2 — Change by versions, never in place *(must)*

- **M13-AC-2.1** — *Given* an item, *when* an editor saves a change, *then* a new **draft** version is stored with a note, author and time; earlier versions are unchanged, and the effective knowledge base is unchanged (drafts are never used, F01-FR-11).
- **M13-AC-2.2** — *Given* a draft that would make the knowledge base invalid (F02 validation: schema, cross-references, official-link allowlist, rule history), *when* saved or published, *then* it is refused with the validation messages.
- **M13-AC-2.3** — *Given* two versions, *when* compared, *then* the changed paths are listed with their old and new values (`M13-EX-diff`).
- **M13-AC-2.4** — *Given* an older version, *when* an editor rolls back to it, *then* a new draft is created from its content; nothing is overwritten.

### US3 — Publish with a second person for fees and links *(must)*

- **M13-AC-3.1** — *Given* a draft, *when* a staff member with `rules.publish` publishes it, *then* it becomes the effective version, the publisher and time are recorded, citizens' reports use it within 60 seconds, and a `kb.<kind>.published` audit event is written; editors without `rules.publish` cannot publish.
- **M13-AC-3.2** — *Given* a draft that changes a fee, an amount, a URL or the list of sources (`M13-EX-second-person`), *when* its own author tries to publish it, *then* publishing is refused; another publisher can publish it (Q-18).
- **M13-AC-3.3** — *Given* an item, *when* a publisher withdraws it, *then* a withdrawn version is added, the item disappears from the effective knowledge base (F01-FR-11), and the reason is recorded.

### US4 — Last verified *(must)*

- **M13-AC-4.1** — *Given* the effective version of an item with metadata, *when* an editor records that it was verified on a date against a named source, *then* that version's last-verified date, verifier and source are stored, the content is unchanged, and citizens' roadmaps show "Last verified by 1dentity on …" once the rule is also published (M18-AC-2.1).
- **M13-AC-4.2** — *Given* a new version is published, *when* shown, *then* it is "not yet verified" until someone records a verification for it — a verification belongs to the content that was checked.

### US5 — Service prices *(must)*

- **M13-AC-5.1** — *Given* an admin or publisher, *when* they add or change a service price (`detailed_report` or `assistance`, optionally per document), *then* it follows the same draft → publish workflow, and the roadmap shows it in the 1dentity service box, never as a government fee (C-01).

## 4. Functional requirements

- **M13-FR-01** — Kinds: `rule`, `authority`, `source`, `catalogue`, `jurisdiction`, `place_variants`, `address_abbreviations`, `service_price`. Items are edited as validated JSON with a template per kind; structured forms per kind are P1.
- **M13-FR-02** — A new version gets the next version number, status `draft`, and — for items with metadata — `meta.version` set to that number; a rule also gets a history entry `{ version, date, change: <note>, by: <author name> }`.
- **M13-FR-03** — Workflow per version: `draft` → `published`, or a draft is discarded; `withdrawn` versions are added, never edited. Seed items stay `in_review` until first published (F01-FR-11).
- **M13-FR-04** — Validation: the candidate knowledge base (the effective one with the item replaced by the version) must pass `validateKnowledgeBase` (F02) before a draft is saved and again before it is published.
- **M13-FR-05** — Second-person rule: if the draft differs from the effective version in any path ending in `fees`, `amountInr`, `url` or `sources`, its author cannot publish it.
- **M13-FR-06** — Verification is stored on the version row (date, verifier, source id, time) and overlaid on `meta.lastVerified` when the knowledge base is loaded; it never creates a version.
- **M13-FR-07** — The web process caches the effective knowledge base for at most 30 seconds and drops the cache on every publish or withdrawal it makes.
- **M13-FR-08** — Audit events: `kb.<kind>.draft_saved`, `kb.<kind>.draft_discarded`, `kb.<kind>.published`, `kb.<kind>.withdrawn`, `kb.<kind>.verified`, each with kind, key and version — never content.
- **M13-FR-09** — Permissions (M15-EX-permissions): read `rules.read`; drafts, rollback, verification `rules.edit`; publish and withdraw `rules.publish`.

## 5. Executable examples

```yaml
id: M13-EX-diff
before: { fees: [{ id: pan-fee, amountInr: 101 }], route: { mode: online } }
after:  { fees: [{ id: pan-fee, amountInr: 107 }], route: { mode: both } }
expect:
  - { path: "fees[0].amountInr", before: 101, after: 107 }
  - { path: "route.mode", before: online, after: both }
```

```yaml
id: M13-EX-second-person
cases:
  - { change: "fees[0].amountInr", needsSecondPerson: true }
  - { change: "sources[1]", needsSecondPerson: true }
  - { change: "url", needsSecondPerson: true }
  - { change: "steps[0].en", needsSecondPerson: false }
  - { change: "internalNotes", needsSecondPerson: false }
```

## 6. Data and privacy

| Data item | Purpose | Basis | Stored where | Who can see it | Retention | Deleted by |
|---|---|---|---|---|---|---|
| Knowledge-base versions | Rules citizens rely on; history of what was shown | Legitimate operation | Database (`kb_items`) | Staff with `rules.read`; citizens see the effective content | Kept (content history, F02) | Never — withdrawn instead |
| Author, publisher, verifier ids | Accountability, second-person rule | Employment / volunteering | Database | Staff with `rules.read` | With the version | — |

No personal data about citizens is involved.

## 7. Language, accessibility and assisted mode

The staff console is in English in P0 (staff are trained; C-08 covers citizen-facing screens). Rule texts themselves carry all four languages and are validated for completeness by F02.

## 11. Out of scope

Structured per-kind forms, scheduled publishing, per-language review steps, staleness alerts by email, guides/explainers (P1, with ADR-003).

## 13. Open questions

| ID | Question | Proposed default | Blocking? |
|---|---|---|---|
| Q-18 | Content workflow | Draft → publish; a second person publishes changes to fees and links; per-language review joins with guides (P1) | No (applied) |
| Q-21 | Build or adopt | Build in-app for the rules database | No (applied for M13) |

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-05 | Full spec for the PRD P0 rules admin | *Pending* |
