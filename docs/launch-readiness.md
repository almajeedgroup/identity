# Launch readiness

*As of 5 October 2026, after increment 6d.*

## The short answer

**The software is feature-complete for the PRD's P0 and P1 scope**, with one exception: online payments, which wait for ADR-016. Desk payments with receipts are built. Every increment is specified, tested and traceable.

**It cannot go to the public yet.** What is left is mostly outside the code: people to appoint, legal sign-off, verified correction rules, an SMS provider, hosting in India, and a security test. Citizens cannot even sign in until an SMS provider is connected.

**Recommended path:**

1. Clear the blockers below.
2. Run a **closed pilot** at one help desk. Staff validate every report by hand (PRD §36).
3. Then launch to the public.

If the decisions in section 2 are taken this week:

| Milestone | Earliest |
|---|---|
| Closed pilot starts | About 6 weeks after the decisions (mid-November 2026) |
| Public launch | After a 4–6-week pilot that meets its exit criteria (around January 2027) |

## 1. What is built and verified

| Area | Specs | State |
|---|---|---|
| Quick Check (on the device, anonymous) | M01, M02 | Built |
| Full Check: sign-in, consent per purpose, typed and uploaded documents with OCR, comparison, targets, disputes, correction plan, withdrawal and deletion | F05, F06, F07, M16, M17, M18 | Built |
| Assistance cases: request, queue with SLA and priority, claim, checklist, notes, filing, completion, citizen tracker | M04, M09 | Built |
| Notifications: in-app list and opt-in SMS (quiet hours, retries) | F08 | Built; **SMS needs a provider** |
| Service fees: agreement, desk payment, receipts, waivers, refunds, revenue | M19 | Built; **online checkout waits for ADR-016** |
| Family profiles: up to 8 members, separate data, relationship names as information | M07 | Built |
| Staff console: authenticator sign-in, dashboard, customers, rules admin with second-person publishing, audit log with hash-chain check, team, cases, revenue | F05, M13, M15 | Built |
| Languages: English, Kannada, Hindi, Urdu (right to left) | F04 | Built; **3 languages are drafts** |

**Quality gates at this commit** (the CI pipeline runs all of these):

- typecheck;
- 287 unit and example tests;
- 113 database tests on PostgreSQL 16;
- i18n key parity;
- Aadhaar number scan;
- content check;
- spec traceability;
- production build;
- 42 Playwright acceptance tests on a budget-phone profile, including accessibility scans (WCAG 2.2 AA, no serious violations).

## 2. Blockers before any real citizen uses it (pilot included)

| # | Blocker | Why it blocks | Owner | Lead time | Ref |
|---|---|---|---|---|---|
| B1 | **Appoint a product owner and a privacy and grievance officer** | Every spec needs their approval. The privacy notice must name a grievance contact. | Leadership | Days | DEC-2 |
| B2 | **Legal review of the privacy notice, consent texts and terms** under the DPDP Act 2023 and its Rules. Covers minors and guardians (Q-06), how long payment records are kept (Q-32), and the "not a government office" disclaimers. | Personal data of citizens, including children | Privacy officer + lawyer | 2–3 weeks | F06, Q-06, Q-32 |
| B3 | **Choose the web address and confirm the name** | Needed for the SMS sender header, the DLT templates and the TLS certificate | Leadership | Days | DEC-5 |
| B4 | **SMS provider with DLT registration** (entity, sender header, templates for the sign-in code and the four case SMS). Then add the provider adapter: about 1–2 days of code behind the existing `OtpSender` interface. | **Sign-in uses SMS codes.** Without this, no citizen can sign in. | Ops + developer | 1–3 weeks (DLT approval) | ADR-005, F05, F08 |
| B5 | **Hosting in an India region:** managed PostgreSQL with daily backups and a tested restore, an encrypted file store, HTTPS, logs and uptime alerts. Production secrets (`DATA_KEYS`, `DATA_KEY_CURRENT`, `OTP_PEPPER`, `DATABASE_URL`) must be in a secrets manager; the app refuses to start without them. | Data residency, recovery targets (Q-25) | Developer + ops | 1–2 weeks | ADR-004, F12 |
| B6 | **Verify the 14 unverified correction rules** (forms, fees, links, documents) on the official portals. Record each verification and publish through the two-person rule in the staff console. | Wrong guidance harms citizens. The app currently labels every step "not yet verified". | Content lead + publisher | 1–2 weeks | M13, F02 |
| B7 | **Choose the pilot location and help-desk hours.** Set `CASE_HOLIDAYS` for the SLA calendar. | SLA clock and desk scheduling | Field coordinator | Days | DEC-3, Q-08 |
| B8 | **Create staff accounts and train them.** Use `npm run staff:create`, set up authenticator apps, and walk through the case and payment flows. Remove the seed admin from production (`SEED_ADMIN_*` must not be set). | Staff will handle citizens' documents | Field coordinator | 1 week | M15 |
| B9 | **Make the GitHub repository private** (or remove the DPR PDF from it). It is public and contains the DPR; the confidential Developer PRD was never committed. | Internal planning documents and budgets are visible to anyone | Repo owner | Minutes | — |

## 3. Blockers before the public launch (after the pilot)

| # | Blocker | Owner | Lead time | Ref |
|---|---|---|---|---|
| P1 | **Security test (VAPT)** by a CERT-In-empanelled auditor, with every high and critical finding fixed and retested | Developer + auditor | 2–3 weeks | F12 |
| P2 | **Incident response plan:** CERT-In reporting within 6 hours, breach notice to the Data Protection Board and the citizens affected, named contacts | Privacy officer | 1 week | F06 |
| P3 | **Language review** of Kannada, Hindi and Urdu by native reviewers, including the SMS texts (`apps/web/messages/STATUS.md`) | Language reviewers | 2 weeks | F04 |
| P4 | **Pilot exit criteria met** (proposed below) | Product owner | 4–6 weeks of pilot | PRD §36 |
| P5 | **GST decision** before charging any fee (Q-33). Until then, pilot assistance can be waived. | Finance lead | — | M19 |
| P6 | **Approve the specs** that are *In review*, recording the approvers in each spec's changelog | Product owner + privacy officer | Ongoing | DEC-2 |

**Proposed pilot exit criteria** (to be confirmed by the product owner):

- Staff checked every Full Check report by hand. The engine's findings matched theirs in at least 95% of fields, and every disagreement was understood and fixed or documented.
- No open high or critical security finding. No data incident.
- Sign-in SMS delivery of at least 98%, and case SMS sent outside quiet hours.
- At least 80% of assisted cases met their SLA.
- Citizens could follow their case without calling the desk, measured with a short exit question.

## 4. Can follow after launch

- Online checkout for service fees (ADR-016).
- A paid detailed report (Q-30).
- P2 modules: reminders (M06), the remaining DPR modules and reports.
- Moving family members to their own accounts (M07 out of scope).
- An optional cloud document-AI provider for OCR (Q-28, with its own ADR).

## 5. Launch-day checklist

- [ ] `APP_ENV=production`, production secrets set, `OTP_SENDER` set to the real provider, no `SEED_ADMIN_*`
- [ ] Database migrated (migrations `0000`–`0007` run on start), and a backup taken and restored once
- [ ] HTTPS only, with `APP_URL` set to the `https://` address (this turns on secure cookies)
- [ ] Knowledge base verified and published; the "not yet verified" warnings are gone where verification is recorded
- [ ] Grievance officer's contact shown in the privacy notice in all four languages
- [ ] Staff accounts with authenticator apps; admin roles limited to two people
- [ ] Uptime and error alerts going to a person on call
- [ ] Hourly housekeeping is running (upload purge, code pruning, case file purge, SMS delivery, notification purge). Check the logs after the first hour.
