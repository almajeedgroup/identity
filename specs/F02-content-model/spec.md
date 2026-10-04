# F02 · Document rules and content model

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 |
| **Spec owner** | Tech lead + content lead |
| **Approvers** | Product owner · Content lead |
| **DPR trace** | §04 (service scope, fees as of Oct 2026), §05 (Content Manager), §06 ("Official links only"), §10 (monthly "last verified" review), §12 (risk: rules change) |
| **Depends on** | [F01](../F01-domain-model/spec.md) |
| **Version** | 0.2 |

> **Approval note.** Built ahead of approval. This version covers the content types the Health Check needs (P1 increment 1). Guides, filing scripts, journeys and Hub explainers are added in later versions of this spec before M03, M08 and M10 are built.

## 1. Summary

Rules, forms and fees change often (DPR risk register: likelihood **High**). This spec defines the **content model**: the structure of everything the Content Manager (M13) edits and the rules engine evaluates, and the checks that keep it trustworthy — official links only, four languages, an owner and a "last verified" date on everything, and dates when a rule starts and stops applying. Values live in content; structure lives here (plan §4.3).

## 2. Users and scenarios

- **Content editors and language reviewers** keep fees, forms and links current.
- **Citizens** see the result in guides and action plans, with a date they can trust.
- **Developers** build features against a stable schema instead of hard-coding fees.

## 3. User stories

### US1 — Every item is accountable *(must)*

As a content editor, I want every rule, fee, form and link to carry an owner, a source, a version and a "last verified" date, so that citizens can see how current it is.

- **F02-AC-1.1** — *Given* a content item without an owner, source or version, *when* the bundle is validated, *then* validation fails and names the item.
- **F02-AC-1.2** — *Given* an item, *when* its freshness is computed for a date, *then* it is `unverified`, `fresh`, `stale` or `rechecking` as in `F02-EX-freshness`.
- **F02-AC-1.3** — *Given* an action shown to a citizen, *when* it has a last-verified date, *then* the date is shown; *when* it has none, *then* the citizen is told it is not yet verified and to confirm on the official site.

### US2 — Official links only *(must)*

- **F02-AC-2.1** — *Given* a link whose host is not on the official-domain allowlist, or that is not HTTPS, *when* the bundle is validated, *then* validation fails with the reason (`F02-EX-allowlist`).

### US3 — Rules with start and end dates *(must)*

- **F02-AC-3.1** — *Given* a fee valid until 14 June 2027, *when* fees are resolved for 14 June 2027, *then* it applies; *for 15 June 2027*, *then* it does not — with no code change (`F02-EX-effective-dates`).
- **F02-AC-3.2** — *Given* an item that stops applying within 30 days, *when* upcoming expiries are listed for the content owner, *then* it is included (`F02-EX-expiry-alert`).

### US4 — Four languages, always *(must)*

- **F02-AC-4.1** — *Given* any citizen-facing text in the bundle that lacks en, kn, hi or ur, *when* the bundle is validated, *then* validation fails.

### US5 — Works on the device *(must)*

- **F02-AC-5.1** — *Given* the seed bundle, *when* validated, *then* it passes, has a version, and every action referenced by the rules engine exists.

## 4. Functional requirements

### Common metadata

- **F02-FR-01** — Every content item MUST have `meta`: `owner` (role or name), `source` (where the value comes from), `version` (integer ≥ 1), `lastVerified` (date, optional until verified), `effectiveFrom` and `effectiveTo` (dates, optional), `status` (`draft`, `in_review`, `published`, `withdrawn`).
- **F02-FR-02** — Every citizen-facing text MUST be a **localised text** with non-empty `en`, `kn`, `hi` and `ur`.

### Content types in this version

| Type | Fields (besides `id` and `meta`) | Used by |
|---|---|---|
| **Document type** | `kind` (`aadhaar`, `pan`, `voter_id`), `label`, `authority`, `fieldsPrinted` (which of name, dob, gender, address) | M01, M02 |
| **Official link** | `url`, `label`, `authority` | Actions, guides |
| **Fee** | `label` (localised, e.g. "₹75 at a centre", "Free online") , optional `amountInr`, `meta` with effective dates | Actions |
| **Action** (correction path) | `document`, `fields` covered, `priority` (lower = earlier; reflects D04 journey order), `title`, `summary`, `form` (code, e.g. "PAN CR-01", or none), `where` (localised channel), `fees` (list, effective-dated), `links` (official link ids) | M02 action plan, M01 results |
| **Name-variant group** | `canonical`, `variants` (full spellings), `abbreviations` | M02 |

Planned for later versions: guide, evidence checklist, filing script, journey, explainer, scam alert, issue explanation.

### Validation

- **F02-FR-03** — **Official-domain allowlist** (C-01). A link is allowed only if it is `https` and its host is, or is a subdomain of, `gov.in`, `nic.in`, or a named authorised agency domain. Seed agency list: `protean-tinpan.com`, `utiitsl.com`. Matching is on whole domain labels (`uidai.gov.in.evil.example` is rejected).
- **F02-FR-04** — Fees resolve against a date: a fee applies when `effectiveFrom ≤ date ≤ effectiveTo` (either end may be open). If no fee applies, the citizen sees "Check the current fee on the official site".
- **F02-FR-05** — **Freshness** *(Q-18 default)*: no `lastVerified` → `unverified`; under 35 days → `fresh`; 35–59 days → `stale` (owner alerted); 60 days or more → `rechecking` (citizens see "We are re-checking this").
- **F02-FR-06** — **Upcoming expiries**: items whose `effectiveTo` is within the next 30 days are listed for their owner.
- **F02-FR-07** — The bundle MUST have a `version` and MUST pass validation in CI before it can be shipped to devices.

### Delivery

- **F02-FR-08** — Content reaches the browser as a versioned bundle (in this version, compiled into the app; from M13 onward, published by the Content Manager) so that the Health Check needs no network.

### Seed content honesty

- **F02-FR-09** — Seed values taken from the DPR MUST cite "DPR v1.0 §04 (as of Oct 2026)" as their source and MUST NOT carry a `lastVerified` date until someone has checked them on the official portal (O03). Translations produced before language review are marked as drafts in the content changelog.

## 5. Executable examples

```yaml
id: F02-EX-effective-dates
fee: { effectiveTo: "2027-06-14" }
cases:
  - { asOf: "2027-06-14", applies: true }
  - { asOf: "2027-06-15", applies: false }
  - { asOf: "2026-11-02", applies: true }
feeWithStart: { effectiveFrom: "2026-04-01" }
casesWithStart:
  - { asOf: "2026-03-31", applies: false }
  - { asOf: "2026-04-01", applies: true }
```

```yaml
id: F02-EX-allowlist
allowed:
  - https://myaadhaar.uidai.gov.in/
  - https://uidai.gov.in/
  - https://voters.eci.gov.in/
  - https://www.incometax.gov.in/
  - https://www.protean-tinpan.com/
  - https://www.pan.utiitsl.com/
  - https://scholarships.gov.in/
rejected:
  - { url: "http://uidai.gov.in/",                 reason: not_https }
  - { url: "https://uidai.gov.in.evil.example/",   reason: not_official }
  - { url: "https://aadhaar-update-help.com/",     reason: not_official }
  - { url: "https://www.utiitsl.com.offers.in/",   reason: not_official }
  - { url: "https://govin.example.in/",            reason: not_official }
  - { url: "not a url",                            reason: invalid_url }
```

```yaml
id: F02-EX-freshness
cases:
  - { lastVerified: null,         asOf: "2026-11-02", expect: unverified }
  - { lastVerified: "2026-11-01", asOf: "2026-12-05", expect: fresh }
  - { lastVerified: "2026-11-01", asOf: "2026-12-06", expect: stale }
  - { lastVerified: "2026-11-01", asOf: "2026-12-30", expect: stale }
  - { lastVerified: "2026-11-01", asOf: "2026-12-31", expect: rechecking }
```

```yaml
id: F02-EX-expiry-alert
cases:
  - { effectiveTo: "2027-06-14", asOf: "2027-05-15", alert: true }
  - { effectiveTo: "2027-06-14", asOf: "2027-05-14", alert: false }
  - { effectiveTo: "2027-06-14", asOf: "2027-06-15", alert: false }
```

## 6. Data and privacy

Content contains no personal data. Content changes are attributed to staff accounts once M13 exists (audited by M15).

## 7. Language, accessibility and assisted mode

- All citizen-facing content in four languages (C-08); fees use Indian digit grouping (F04).
- "Last verified" and "not yet verified" are always shown in words, not only an icon.

## 8. Non-functional requirements

- The compiled seed bundle for P1 documents stays under 60 KB uncompressed.

## 9. Content dependencies

Seed values for D01–D03 from DPR §04 and §06, pending verification (O03).

## 10. Edge cases and failure modes

- Two fees apply on the same date (e.g. online and at a centre) → both are shown.
- A fee's end date passes while a citizen has the app open → resolved again on next load.

## 11. Out of scope

- The Content Manager screens and workflow (M13).
- Publishing bundles over the network (M13, F09).

## 12. Success measures

Zero citizen-visible items past the `rechecking` threshold; 100% of seed items verified before the pilot (O03).

## 13. Open questions

| ID | Question | Proposed default | Blocking? |
|---|---|---|---|
| Q-18 | Workflow and staleness thresholds | 35 / 60 days | No (applied) |
| Q-21 | Build or adopt a CMS | ADR-003, before M13 | Not for this version |

## 14. Gate 1 checklist — spec ready

- [x] Stories prioritised; each independently testable
- [x] Acceptance scenarios with IDs
- [x] Executable examples for every rule
- [x] Data and privacy: no personal data
- [x] Languages and accessibility described
- [x] Content dependencies listed
- [x] Out of scope explicit
- [x] No blocking `[NEEDS CLARIFICATION]` remains

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-04 | Full draft for the Health Check increment; built ahead of approval | *Pending* |
