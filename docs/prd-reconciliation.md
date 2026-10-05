# Developer PRD v1.0 — reconciliation with the DPR and the SDD plan

| | |
|---|---|
| **Date** | 5 October 2026 |
| **Sources** | DPR v1.0 ([`Identity_WebApp_DPR_v1.0.pdf`](../Identity_WebApp_DPR_v1.0.pdf)) · **1dentity Developer PRD v1.0** (October 2026, marked *confidential*; **not stored in this repository** because the repository is public — cited below by section number, "PRD §n") |
| **Effect** | Constitution → v1.1.0 · new specs M16, M17, M18 · amended F01, F02, F03, M02 · new ADR-011, ADR-012, ADR-013 · plan §7 re-sequenced to the PRD's P0/P1/P2 |

## 1. Precedence

1. **Constitution** — wherever the PRD and the constitution differ on privacy, legal or trust behaviour, the stricter rule applies and the difference is recorded here.
2. **PRD** — the newer, developer-facing definition of product behaviour, scope and priorities.
3. **DPR** — the business case, design language, governance, roadmap and budget, and anything the PRD doesn't address.

## 2. What the PRD adds

| PRD area | Before (DPR / increment 1) | Now |
|---|---|---|
| Product name (cover, §1) | "Identity" | **"1dentity"**, a unit of Islamic Information Centre |
| Promise (§2) | Check → Understand → Get help → Track → Stay valid | **Detect → Verify → Prioritise → Plan → Guide → Assist → Track → Maintain** |
| Documents (§6) | Aadhaar, PAN, Voter ID at P1 | **11 at MVP**: + Passport, Driving Licence, Birth Certificate, SSLC/10th, PUC/12th, Caste, Income, Ration Card |
| Fields | Name, DOB, gender, locality, mobile link | + father's, mother's and spouse's names, place of birth, relative name, full address (house, street, locality, city, district, PIN) |
| Input (§7, §10) | Typed on the device only | Typed **or uploaded** (JPG, PNG, PDF) with **OCR**, always confirmed by the citizen |
| Profile (§8, §9) | None (device-only check) | Account, **master citizen profile** with **target values**; every document keeps original, normalised and confirmed values |
| Comparison (§11, §12) | Match / variant / different | **Six statuses**: exact match, formatting variation, likely equivalent, potential discrepancy, major discrepancy, missing |
| Ordering (§14) | Content priority (Aadhaar first) | **Dependency engine**: civil → education → identity/KYC → passport → secondary, plus rule prerequisites; every step shows reason, source and rule version |
| Knowledge base (§14, §15) | Actions with fees and links | **Versioned, admin-managed rules**: authorities, jurisdictions, official sources, evidence, prerequisites, steps, tracking, escalation, minor/major |
| Output (§13, §16, §30) | Score, cards, action plan | **Consistency report** and **correction roadmap** with a DIY path and an assistance path per issue |
| Assistance (§18, §19) | Request Help, case queue (DPR P1) | Case management with tasks, government vs service fees, payments (PRD P1) |
| Money (§29) | Fee policy open (DEC-4) | Free basic check; paid detailed report and paid assistance; **prices configurable by admins** |
| Admin (§19) | Content Manager, Access & Audit | + rules admin, customer list, workload, revenue, audit logs |

## 3. Conflicts and resolutions

| # | Topic | DPR / constitution | PRD | Resolution |
|---|---|---|---|---|
| R-01 | Name | "Identity" | "1dentity" | Adopt **1dentity** in the product. Organisation spelled "Islamic Information **Centre**" as on the DPR cover (the PRD writes "Center") — confirm under DEC-5. |
| R-02 | Charging | Free; DEC-4 open | Free basic check, paid report and assistance, configurable prices | Adopt the PRD (resolves DEC-4). **1dentity never collects government fees**: the government fee is recorded, paid by the citizen to the authority, and always shown separately (C-01, PRD §28). Payments are P1. |
| R-03 | Where data lives | Health Check on the device only (C-04) | Accounts, uploads, OCR, stored profile | Two modes. **Quick Check** stays anonymous and on the device (M01). **Full Check** requires an account and explicit consent per purpose, then stores the profile and documents (M16, M17). C-04 amended. |
| R-04 | Aadhaar numbers | Never store a full Aadhaar number (C-03) | Document numbers "encrypted/masked where appropriate" | Keep **C-03**: full Aadhaar numbers are never stored; OCR rejects an image showing one and asks for masked Aadhaar. Other document numbers are encrypted (AES-256-GCM) and masked in every view. |
| R-05 | Reference | Aadhaar is the reference (Q-02) | The citizen chooses the target value | The citizen chooses and confirms; the engine only **suggests** (C-17). Q-02 superseded. |
| R-06 | Severity | Valid / Update due / Mismatch | Six statuses with colours | Full Check uses the PRD's six statuses; F03 adds severity tokens (green, yellow, orange, red, grey), always with icon + word. Quick Check keeps its score. |
| R-07 | Name variants | Variants flagged (Q-03) | Spelling variants need review; fuzzy match is never proof | Consistent. "Formatting variation" is limited to case, punctuation, spacing around punctuation and date formats. Spelling, abbreviation, initials and order are **potential discrepancies**. |
| R-08 | Order | Aadhaar-first journeys | Civil → education → identity → passport → secondary | PRD tiers are the default; rule prerequisites (e.g. link a mobile to Aadhaar before online updates) refine them. |
| R-09 | Unverified procedures | Seed content marked unverified | "Never fabricate procedures, fees or links" | For documents whose procedures are not yet captured from official sources, the roadmap shows the **authority and "procedure not yet verified"** and no invented steps, fees or links. |
| R-10 | Priorities | DPR P1/P2/P3 by module | PRD P0/P1/P2 | Build order follows the PRD (plan §7.7). Family profile moves from DPR P2 to P1. |
| R-11 | Languages | Four languages at launch (C-08) | Regional-language UI "later" | Keep **C-08** for citizen screens. Staff and admin screens are English (Q-16). Draft translations until reviewed. |
| R-12 | Stack | Next.js, PostgreSQL, Prisma | Stack left to the developer | Next.js + PostgreSQL kept; **Drizzle ORM** (ADR-011); local **Tesseract OCR** behind a provider interface (ADR-012). |
| R-13 | Retention | Uploads purged 30 days after case closure | "Define retention and deletion policies" | Default (Q-26): uploaded originals deleted **30 days after the citizen verifies the extraction** unless attached to an open assistance case; profile data kept until the citizen deletes it or their account; deletion available any time from Settings. |
| R-14 | Geography | Bengaluru pilot | Karnataka first, state-aware | Consistent: rules carry a jurisdiction (national, state, district). |

## 4. Spec changes

| Spec | Change | PRD |
|---|---|---|
| Constitution | v1.1.0 — C-01, C-03, C-04, C-15 amended; **C-16** original data is preserved, **C-17** the citizen decides, **C-18** recommendations, not rulings | §1, §9, §23, §28 |
| F01 | Domain model adds the PRD entities (§25) and the database schema | §8, §9, §25 |
| F02 | Content model becomes the **rules knowledge base**: authorities, jurisdictions, official sources, correction rules with full structure and versions | §14, §15 |
| F03 | Severity tokens and status words for the six statuses | §12 |
| F05 | Authentication — citizen one-time code, staff password + TOTP, sessions | §23, §24 |
| M02 | v1.0 — normalisation engine and six-status comparison across any number of documents and fields | §11, §12, §13 |
| **M16** | Citizen profile and target values (master profile, suggestions, confirmation, overrides with audit trail) | §8, §17, §28 |
| **M17** | Documents, upload, OCR and verification | §6, §9, §10 |
| **M18** | Correction roadmap and dependency engine (DIY and assistance paths) | §14, §16, §17, §30 |
| M13 | Rules admin (create, version, verify, publish) | §15, §19 |
| M15 | Access and audit — RBAC, MFA, hash-chained audit log | §19, §23 |

## 5. Decisions taken by default (reversible)

Recorded in [`specs/open-questions.md`](../specs/open-questions.md): DEC-4 (charging) resolved by the PRD; Q-02 superseded; new Q-26 (upload retention), Q-27 (who pays government fees), Q-28 (OCR engine), Q-29 (which statuses count as "issues").
