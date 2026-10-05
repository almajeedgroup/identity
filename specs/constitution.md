# 1dentity Constitution

| | |
|---|---|
| **Version** | 1.1.0 (proposed) |
| **Status** | Draft — to be ratified in Phase 0, week 1 |
| **Ratified by** | Product owner · Privacy & grievance officer |
| **Source** | DPR v1.0, especially §06–§09; Developer PRD v1.0 §1, §9–§11, §23, §28 (see [`docs/prd-reconciliation.md`](../docs/prd-reconciliation.md)) |

These principles are **non-negotiable**. They apply to every spec, plan, line of code, content item and operational process in the 1dentity web app.

- Every `spec.md` must be consistent with them.
- Every `plan.md` contains a **Constitution check** table that states, for each principle, whether it applies and how it is satisfied.
- A deviation is allowed only as a written, time-limited **exception** in the plan, approved by the product owner **and** the privacy & grievance officer, with a removal date.
- Where a principle can be checked automatically, CI enforces it (see "Verified by").

---

## Trust

### C-01 · Facilitation, not impersonation
- 1dentity is a community help service of Islamic Information Centre. It is **not** a government office, it **cannot change government records**, and the app MUST say so on every page. Authorities alone accept, reject and make corrections.
- Every guide links **only to official portals** of the issuing authority or its authorised agencies.
- 1dentity MUST NOT collect official fees. Fees are paid by the citizen **directly to the authority**.
- Any 1dentity service fee is shown **separately** from government charges, and a government fee is never presented as a 1dentity fee. Prices are configured by admins, not hard-coded.
- The app MUST NOT use government emblems, or names, colours or layouts that could be mistaken for a government service.

*Why:* DPR §09 "Facilitation, not impersonation"; risk register "Brand misuse or confusion with a government office" (impact High); PRD §1, §16B, §23, §28, §29.
*Verified by:* disclaimer present in the layout of every surface (E2E); official-link allowlist validation in the Content Manager and in CI; no payment collection for official fees anywhere in the codebase.

### C-02 · Never handle government credentials
- The system MUST NEVER ask for, collect, store, transmit or log an **OTP, PIN or password for any government portal**.
- During assisted filing, **the citizen enters their own OTP** on the official portal.
- Every flow that leads to an official portal shows the warning: *"Identity will never ask for your OTP, PIN or password."*
- The only OTP the system handles is the one-time code for logging in to Identity itself (F05), which is never shown to staff.

*Why:* DPR §01, §05 (Filing Assistant), §09 "No OTPs, PINs or passwords".
*Verified by:* form-schema lint (no OTP/PIN/password fields outside F05 login); log scrubbing tests; volunteer training (M12).

### C-03 · Masked Aadhaar only
- Full 12-digit Aadhaar numbers are **never stored**. At most the **last four digits** are kept.
- Citizens are asked to share **masked Aadhaar**, in line with UIDAI guidance.
- Free-text fields (notes, messages) are scanned for Aadhaar-like numbers and masked before saving.
- OCR (M17) checks every upload: an Aadhaar image that shows a full number is **not stored**; the citizen is asked for masked Aadhaar or to type the details.
- Other identifiers (PAN, passport, EPIC, licence numbers) are **encrypted at rest** (AES-256-GCM) and **masked** in every view that does not need the full value.

*Why:* DPR §09 "Masked Aadhaar only".
*Verified by:* schema lint (Aadhaar fields limited to 4 digits); Verhoeff-valid 12-digit detection in free text, logs, fixtures and seed data; upload guidance and staff review step (F07, Q-07).

---

## Privacy

### C-04 · Collect only with consent, only for the purpose
- The anonymous **Quick Check** (M01) runs entirely in the citizen's browser. Nothing entered there is sent to the server.
- The **Full Check** (M16, M17) stores a profile and documents only for a citizen with an account, after they accept a consent notice for that purpose. Uploading a document is a separate, explicit act.
- Personal data is collected only with a clear consent notice **in the citizen's language**, for a stated purpose, and used only for that purpose.
- Withdrawing consent must be as easy as giving it.

*Why:* DPR §06, §09 data lifecycle "01 · Collect"; PRD §7, §23 ("obtain appropriate user consent before collecting/processing documents").
*Verified by:* E2E network-capture test on the Health Check flow; consent record required before a case is created; consent withdrawal flow tests.

### C-05 · Retention by default
- Uploaded documents are **purged 30 days after case closure**; uploads outside a case are purged 30 days after the citizen verifies their extraction (Q-26).
- A citizen can delete their documents, profile or whole account at any time from Settings.
- Case records are **anonymised after 12 months**.
- Deletion is automatic, scheduled, logged and verified. The target is **100% of uploaded documents deleted on schedule** (DPR §12).
- Every stored data item has a retention class recorded in the spec's *Data & privacy* table and in `data-model.md`.

*Why:* DPR §09 data lifecycle "04 · Delete"; KPI "100% uploaded documents deleted on schedule".
*Verified by:* retention-job tests; deletion reports in M15; monthly check in O03.

### C-06 · Least-privilege access
- A case and its documents are visible **only to the assigned volunteer and their supervisor** (plus roles explicitly granted in M15).
- Citizen names are **masked by default** in the staff console.
- **Every document view is recorded** in the audit log.
- Staff and volunteers use **2FA**. A volunteer's access is **removed on the day they leave**.
- Volunteers get access to case data only after **identity verification, a signed confidentiality undertaking, and training and certification**.
- No personal phones for document photos — **in-app upload only**.

*Why:* DPR §07 (case queue "names masked for privacy"), §09 security controls and volunteer code of conduct.
*Verified by:* authorisation tests per role; audit-event assertions on document access; offboarding test.

### C-07 · Secure and resident by design
- Data is hosted in an **India region**.
- **AES-256 at rest, TLS in transit.** Documents are never public; access is by **short-lived signed URLs**.
- A **security test (VAPT)** is run before launch and every year; critical and high findings block release.
- A written **incident plan**: affected citizens and the Data Protection Board are informed promptly, with a detailed report **within 72 hours**.
- Designed to meet the **DPDP Act 2023 and DPDP Rules 2025**: consent notices, purpose limits, withdrawal, erasure, and a named grievance officer. A legal review is completed before launch.

*Why:* DPR §08, §09.
*Verified by:* infrastructure configuration checks (F12); VAPT reports; O02 incident drill; O04 readiness check.

---

## People

### C-08 · Four languages, equal quality
- Every citizen-facing screen, message and guide is available in **English, ಕನ್ನಡ (Kannada), हिन्दी (Hindi) and اردو (Urdu)** at release. No citizen feature ships in fewer languages.
- Urdu uses a fully **mirrored right-to-left layout**.
- Fonts: Urbanist, paired with Noto Sans Kannada, Noto Sans Devanagari and Noto Naskh Arabic.

*Why:* DPR §07.
*Verified by:* locale completeness check; RTL snapshot tests; language-reviewer sign-off in the Definition of Done.

### C-09 · Accessible by default
- **WCAG 2.2 AA** contrast and behaviour, **48 px** touch targets, and a one-tap **large-text mode**.
- Status is always shown as **colour + icon + word — never colour alone**.
- Amber and coral are reserved strictly for status.

*Why:* DPR §07 "Accessible by default", status system.
*Verified by:* axe checks in CI; design-token contrast tests; manual screen-reader checks on key flows each release.

### C-10 · Mobile-first and light
- Fast on **budget phones and patchy networks**.
- Installable PWA; **guides work offline**.

*Why:* DPR §07 "Mobile-first & light", "Installable · guides work offline".
*Verified by:* performance budget on a throttled budget-phone profile; offline guide tests.

### C-11 · Assisted everywhere
- **Every citizen flow can be completed with a volunteer alongside** — at the help desk, on a WhatsApp video call, at a camp or at the doorstep.
- The citizen always keeps control of OTPs and payments (C-02).
- No service is available *only* to people with a smartphone.

*Why:* DPR §06 "Assisted mode", §07 "Assisted everywhere"; risk register "Low digital literacy / no smartphone".
*Verified by:* every spec has an *Assisted mode* subsection; Gate 1 checks it.

### C-12 · Plain language, one next step
- Short sentences, icons with labels.
- **Every screen ends with a single, clear primary action.**

*Why:* DPR §07 "Plain language", "One next step".
*Verified by:* design review at Gate 1; language-reviewer sign-off.

---

## Content and engineering

### C-13 · Content is verifiable
- Every rule, fee, form and official link has a **named owner, a source, a version and a "last verified" date**, shown to citizens.
- Rules can be **effective-dated** (for example, a fee waiver that ends on a known date).
- Content is reviewed **monthly**; stale content is flagged and, past a limit, withdrawn or marked as "re-checking".
- Fees are always shown "as of" their verification date.

*Why:* DPR §05 Content Manager, §06 "Official links only", §10 "monthly 'last verified' review", risk register "Rules, forms or fees change" (likelihood High).
*Verified by:* content schema validation; freshness check in CI and in M13; O03 routine.

### C-14 · No advertising trackers; aggregates only in reports
- No advertising or third-party tracking scripts. Analytics are privacy-friendly.
- Reports and dashboards use **only counts and averages**, never individual citizen data.

*Why:* DPR §08 "no advertising trackers", §12 "No individual citizen data is used in reports".
*Verified by:* Content Security Policy allowlist; bundle origin check; M14 aggregation tests.

### C-15 · Lean, maintainable stack
- TypeScript end to end: Next.js (React) + Tailwind with Urbanist tokens; Node.js route handlers and server actions (NestJS only if services grow); PostgreSQL with Drizzle ORM (ADR-011); S3-compatible storage; OCR behind a replaceable provider interface (ADR-012); WhatsApp Business Platform and DLT-registered SMS.
- Adding a new runtime, datastore or third-party service requires an **ADR**.
- Code, specs and ADRs must be understandable by a new small team at handover.

*Why:* DPR §08 recommended stack, §11 team, risk register "Funding gaps after launch".
*Verified by:* ADR review at Gate 2.

---

## Records and recommendations

### C-16 · Original data is preserved
- Every document field keeps three values side by side: **original** (as extracted or typed), **normalised** (for comparison) and **confirmed** (by the citizen). The original is **never overwritten**.
- Corrections create new versions; the uploaded file is kept separate from extracted data.

*Why:* PRD §9, §10, §28 ("never overwrite original document data").
*Verified by:* repository tests that updates append versions; database constraints; M17 acceptance tests.

### C-17 · The citizen decides
- Nothing extracted from a document is relied on until the citizen has **seen and confirmed** it.
- The system may **suggest** a target (master) value; it never sets or changes one silently.
- A citizen (or staff on their behalf, with a reason) can **dispute or override** a comparison result; every override is kept with an audit trail.
- Relationship-name differences are reported, never treated as proof that a relationship is invalid.

*Why:* PRD §7, §8, §10, §21, §28.
*Verified by:* M16 and M17 acceptance tests; audit events on every target change and override.

### C-18 · Recommendations, not rulings
- Similar-looking names are **never treated as legally identical**; fuzzy matching is never proof.
- Government procedures, fees and links are **never invented**. Every government-process recommendation shows its **source, last-verified date and rule version**; where no verified rule exists, the app says so and names the authority.
- Estimated processing times are never presented as guarantees.
- The report distinguishes **informational** differences from those **requiring correction**.

*Why:* PRD §11, §14, §16, §28, §34.
*Verified by:* M18 roadmap tests (every step carries source and version, or an explicit "not yet verified"); content checks (C-13).

---

## Governance

- **Amendments** require approval from the product owner and the privacy & grievance officer, and are recorded in the changelog below.
- **Versioning** (semantic):
  - MAJOR — a principle is removed or relaxed.
  - MINOR — a principle is added or materially strengthened.
  - PATCH — wording or clarification only.
- **Review:** at every phase stage gate and at the year-1 review.
- **Precedence:** where a spec and the constitution conflict, the constitution wins until the conflict is resolved by amending one of them.

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 1.0.0 | — | Initial version derived from DPR v1.0 | *Pending ratification* |
| 1.1.0 | 2026-10-05 | Developer PRD v1.0: product name 1dentity; C-01 service fees separate; C-03 OCR guard and encrypted identifiers; C-04 Quick Check vs Full Check; C-05 upload retention; C-15 Drizzle and OCR provider; new C-16, C-17, C-18 | *Pending ratification* |
