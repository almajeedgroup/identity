# Spec backlog — seeded from DPR v1.0

Each entry below is the **seed** for one spec: what the DPR already commits to, the first acceptance scenarios, and the open questions. When a spec is started, copy [`_templates/spec.md`](./_templates/spec.md) into `specs/<ID>-<slug>/spec.md` and expand the seed. The seed is not the spec: anything here can change during *Specify* and *Clarify*.

**Legend**: `P1/P2/P3` = DPR phase · *Full / Lite / Content* = spec size · *Build* = sprint or month (see [`docs/sdd-plan.md` §7](../docs/sdd-plan.md#7-delivery-plan--the-spec-runway)) · `Q-xx` / `DEC-x` = [`open-questions.md`](./open-questions.md).

**Contents**

- [Foundation specs F01–F12](#foundation-specs)
- [Module specs M01–M15](#module-specs) — citizen app M01–M08 · console M09–M12 · admin M13–M15
- [Document and journey content specs D01–D14](#document-and-journey-content-specs)
- [Integration and scale specs X01–X02](#integration-and-scale-specs-phase-3)
- [Operational specs O01–O04](#operational-specs)

---

## Foundation specs

### F01 · Domain model, glossary and case lifecycle
`P1 · Full · Build S1 · Depends on: constitution · DPR §05, §06, §07, §09`

**Intent.** One shared vocabulary and data model for the citizen app, the console and the admin surface.

**Seed requirements**
- Glossary covering: citizen, account holder, *applicant* (the person a case is about — may differ from the account holder), family member, document type, field, issue, mismatch, update due, health score, case, case ID, service, appointment, slot, centre, desk, camp, token, volunteer, doorstep team, supervisor, coordinator, content editor, language reviewer, publisher, admin, privacy & grievance officer.
- Core entities: `Account`, `Applicant`, `Centre` (exists from day one so Phase 3 partner centres extend rather than rework the model), `Desk`, `Case`, `CaseEvent`, `Appointment`, `Slot`, `Camp`, `Token`, `StaffUser`, `Role`, `Assignment`, `Upload`, `ConsentRecord`, `Notification`, `AuditEvent`, `RightsRequest`, `SurveyResponse`. Content entities are defined in F02.
- **Case state machine**, reconciling the citizen tracker and the staff queue in the DPR screen concepts:

  | Internal state | Citizen sees (DPR §07 "My case") | Staff sees (DPR §07 queue) |
  |---|---|---|
  | `new` | Request received | New |
  | `awaiting_citizen` *(SLA paused)* | We need something from you | Awaiting citizen |
  | `visit_booked` | Appointment booked | Visit booked |
  | `in_progress` | Documents checked | In progress |
  | `filed` | Filed on official portal · acknowledgement shared | Filed |
  | `with_authority` | With the authority · usually 2–3 weeks | With authority |
  | `completed` | Completed | Completed |
  | `closed_not_proceeding`, `withdrawn` | Closed / Withdrawn | Closed / Withdrawn |

- Case IDs are human-readable (e.g. `ID-24318`) and are never, on their own, enough to access a case.
- Every entity and field carries a **retention class** (see F06).

**Acceptance seeds**
- *Given* a case in `filed`, *when* staff record that the application is with the authority, *then* the citizen timeline shows "With the authority · usually 2–3 weeks".
- *Given* a case in `new`, *when* anyone attempts to move it straight to `completed`, *then* the transition is rejected.
- *Given* a case ID, *when* someone who is not the account holder or an authorised staff member requests it, *then* no case data is returned.

**Open questions:** Q-05 (account holder vs applicant), Q-08 (what pauses the SLA).

---

### F02 · Document rules and content model
`P1 · Full · Build S1 · Depends on: F01 · DPR §04, §05, §06, §09, §12`

**Intent.** The schema for everything the Content Manager (M13) edits and the rules engine (`packages/rules`) evaluates. This is where the spec/content boundary (plan §4.3) is defined.

**Seed requirements**
- Content types: document type; field; Health Check question; rule; issue type; correction path (steps, evidence checklist, channel); fee; form; official link; filing script (for M10); journey (ordered multi-document path, D04); explainer and scam alert (M08).
- Every content item has: owner, source reference, version, **last-verified date**, **effective-from / effective-to** dates, status (draft, in review, published, withdrawn), and translations in en, kn, hi, ur.
- Rule types supported at P1: *field matches reference document* (with a name normaliser, see M02), *field present*, *DOB is year-only*, *update due N years after last update*, *mobile linked*, *time-bound offer* (e.g. free until a date). Added at P2: *age-triggered* (child biometrics at 5 and 15), *expiry date* (passport, licence).
- **Official-domain allowlist** (government domains plus named authorised agencies such as Protean and UTIITSL), maintained by admins with a two-person change rule.
- Content is delivered to the browser as a **versioned, cacheable bundle per language**, so the Health Check and guides work on the device and offline.
- Fees are stored with an "as of" date and shown with it.

**Acceptance seeds**
- *Given* a rule "online POI/POA document update free until 14 June 2027", *when* that date passes, *then* guides stop saying "free" without a code release, and the content owner is alerted beforehand.
- *Given* an editor adds a link to a domain not on the allowlist, *when* they try to publish, *then* publishing is blocked with an explanation.
- *Given* any published guide, *when* a citizen opens it, *then* its "last verified" date is visible.

**Open questions:** Q-18 (approval workflow), Q-21 (build vs adopt a CMS).

---

### F03 · Urbanist UI design system and status system
`P1 · Full · Build S1 → S2 · Depends on: — · DPR §07`

**Intent.** Tokens, typography, components and screen patterns that make every surface look and behave consistently, accessibly and calmly.

**Seed requirements**
- Colour tokens (DPR §07): Ink 900 `#0F1B2D` (text, dark surfaces) · Emerald 600 `#0E7C66` (brand, primary actions) · Mint 300 `#6EE7C8` (highlights on dark) · Emerald 50 `#E7F5F1` (tinted surfaces) · Mist 50 `#F5F7F6` (app background) · Amber 400 `#F5A524` (status: update due) · Coral 500 `#E5484D` (status: mismatch, error) · Sky 500 `#2F6FED` (info, in progress, links) · Slate 500 `#5B6B7A` (secondary text) · Line 200 `#DCE3E1` (borders).
- Type: Urbanist variable 100–900 with Noto Sans Kannada, Noto Sans Devanagari, Noto Naskh Arabic. Scale: Display/H1 32/800 · H2 22/700 · Body 16/500 · Caption 13/600.
- Status system: **Valid · Update due · Mismatch · In progress** — always colour + icon + word.
- Components: primary and secondary buttons; labelled field ("NAME AS ON AADHAAR"); document status card; health-score dial; action-plan step; case timeline; bottom navigation (Home, Guides, Cases, Family); language switcher; official-link badge; OTP warning; disclaimer footer; large-text toggle; console queue table with filter chips.
- Screen patterns from DPR §07: Home & Health Score, Mismatch report, Case tracker, Staff case queue — plus the five key wireframes from Phase 0.
- **Contrast finding to resolve in this spec:** measured against WCAG 2.2 AA (4.5:1 for body text), several DPR tokens cannot be used as text colours on light backgrounds as they stand:

  | Token as text | On white | On Mist 50 |
  |---|---|---|
  | Amber 400 | 2.04 : 1 ✗ | 1.90 : 1 ✗ |
  | Coral 500 | 3.91 : 1 ✗ | 3.64 : 1 ✗ |
  | Sky 500 (links) | 4.55 : 1 ✓ (barely) | 4.23 : 1 ✗ |
  | Emerald 600 | 5.13 : 1 ✓ | 4.77 : 1 ✓ |
  | Slate 500 | 5.48 : 1 ✓ | 5.10 : 1 ✓ |

  Ink 900 text on an Amber 400 fill is 8.47 : 1 ✓. Proposed fix: keep Amber and Coral as fills and icons with Ink text, and add darker *text* variants for status words and links (e.g. Amber 700, Coral 700, Sky 600) that pass on both white and Mist 50.

**Acceptance seeds**
- *Given* the token set, *when* the contrast test runs, *then* every text/background pair used in components meets AA.
- *Given* any status chip, *when* rendered in greyscale, *then* the status is still identifiable by icon and word.
- *Given* large-text mode, *when* enabled with one tap, *then* body text scales and no layout breaks on a 360 px-wide screen.

**Open questions:** none blocking; the contrast fix needs designer sign-off.

---

### F04 · Internationalisation and RTL
`P1 · Full · Build S1 · Depends on: F03 · DPR §07`

**Seed requirements**
- Locales: `en`, `kn`, `hi`, `ur`. The first screen offers a language choice; the choice persists without an account.
- Urdu: fully mirrored layout, including directional icons, timelines and progress steps.
- Formats: dates as DD-MM-YYYY (as on the documents); Indian digit grouping (₹1,20,000); people's names are shown as entered, never translated or transliterated.
- Translation keys only — no hard-coded citizen-facing strings; pseudo-locale for testing from S1.
- WhatsApp and SMS templates exist in all four languages (F08).
- Fonts are subset per script to protect page weight (C-10).

**Acceptance seeds**
- *Given* Urdu is selected, *when* any citizen screen renders, *then* the layout is mirrored and text is right-aligned.
- *Given* a citizen-facing key is missing in any locale, *when* CI runs, *then* the build fails.
- *Given* an amount of 120000 rupees, *when* shown in any locale, *then* it is formatted with Indian grouping.

**Open questions:** Q-16 (staff console language), Q-23 (digits in kn/hi/ur).

---

### F05 · Authentication and sessions
`P1 · Full · Build S1 · Depends on: F01, M15 · DPR §08, §09`

**Seed requirements**
- **Citizens** can use the Health Check, guides and Hub **without an account**. Opening a case, booking or tracking requires login with a **one-time code sent to the citizen's own mobile** (ADR-005). This login code is never visible to staff (C-02).
- **Staff and volunteers** log in with password + **mandatory 2FA**; roles come from M15.
- **Help-desk tablet**: short idle lock; a volunteer can create a case *for* a citizen (assisted creation) with consent captured at the desk; staff never sign in *as* a citizen.
- Citizens without a phone, or sharing a family phone, can still be helped (Q-05).
- Rate limiting and lockout on code requests; sessions revocable by M15.

**Acceptance seeds**
- *Given* a citizen who is not logged in, *when* they tap "Request help", *then* they are asked to verify their mobile number before any personal data is collected.
- *Given* a staff account without 2FA, *when* it signs in, *then* console access is refused until 2FA is set up.
- *Given* a help-desk tablet left idle beyond the set limit, *when* someone touches it, *then* the session is locked.

**Open questions:** Q-05, ADR-005.

---

### F06 · Privacy, consent and data lifecycle
`P1 · Full · Build S1 (policy, consent records) → S4 (rights flows) · Depends on: F01 · DPR §09`

**Seed requirements**
- Purpose registry: case handling; WhatsApp/SMS updates; (P2) reminders; (P2) family profile.
- Consent notices per purpose, in the citizen's language, recorded as `ConsentRecord` (notice version, time, language, channel, assisted-by).
- Withdrawal and erasure as easy as giving consent; requests to access and correct data; a named **grievance officer** shown on the privacy page and footer.
- One **retention schedule** as configuration (not code): uploaded documents purged **30 days after case closure**; case records **anonymised after 12 months**; other items per Q-14 and Q-15.
- **Minors**: handling of under-18s (Q-06), relevant to personas such as Ayesha (17) and to child biometric reminders (P2).
- Legal review before launch (DPR §09) is a Phase 1 exit criterion.

**Acceptance seeds**
- *Given* a case is closed, *when* 30 days pass, *then* its uploaded documents are deleted and the deletion is logged (implemented in M15).
- *Given* a citizen withdraws consent on an open case, *when* they confirm, *then* processing stops, the case is closed as `withdrawn`, and deletion is scheduled.
- *Given* a consent notice is updated, *when* a citizen next opens a case, *then* they see and accept the new version.

**Open questions:** Q-06, Q-14, Q-15.

---

### F07 · Secure document handling
`P1 · Full · Build S3 · Depends on: F01, F06, M15 · DPR §08, §09`

**Seed requirements**
- In-app upload only (camera or file), from the citizen app and the help-desk tablet; no personal phones for document photos (C-06).
- JPEG, PNG and PDF; size limits; client-side compression for budget phones.
- AES-256 at rest; malware scan; no public buckets; access only via **short-lived signed URLs** issued after an authorisation check.
- **Every view writes an audit event.** Download disabled for volunteers by default.
- Masked-Aadhaar guidance before every Aadhaar upload; handling of unmasked copies per Q-07.
- Purge 30 days after case closure, with a deletion log entry per object.

**Acceptance seeds**
- *Given* a volunteer not assigned to a case, *when* they request one of its documents, *then* access is denied and the denial is audited.
- *Given* a signed URL older than its lifetime, *when* it is used, *then* it fails.
- *Given* a closed case reaches day 30, *when* the purge job runs, *then* every object is deleted and logged.

**Open questions:** Q-07.

---

### F08 · Notifications — WhatsApp and SMS
`P1 · Full · Build S3 (may slip to S4) · Depends on: F01, F04, F06 · DPR §05, §06, §08`

**Seed requirements**
- WhatsApp Business Platform through an approved provider (ADR-009); DLT-registered SMS templates as fallback.
- The in-app timeline is the source of truth; messages are notifications of it.
- Opt-in captured per channel with consent (F06).
- P1 templates, each in four languages: case received (with case ID); documents needed; appointment confirmed and reminder (with QR); filed (acknowledgement shared); with the authority; completed; two-question closing survey (F11).
- Messages carry the minimum: no Aadhaar digits, no document images, no official-portal links that could be confused with scam links (link to Identity's own domain instead).
- Delivery status tracked; retry; SMS fallback for critical templates; quiet hours.
- Sender name and registration depend on DEC-5.

**Acceptance seeds**
- *Given* a citizen opted in to WhatsApp in Kannada, *when* their case moves to `filed`, *then* they receive the "filed" template in Kannada.
- *Given* a WhatsApp message fails, *when* the template is marked critical, *then* an SMS is sent instead.
- *Given* a citizen opted out, *when* their case changes, *then* no message is sent and the timeline still updates.

**Open questions:** Q-13, ADR-009, DEC-5.

---

### F09 · PWA, performance and offline
`P1 · Full · Build S2 · Depends on: F02, F03 · DPR §07`

**Seed requirements**
- Installable PWA.
- Service worker caches the per-language content bundle, guides and Hub text, so **guides and the Health Check work offline** once loaded.
- No offline queueing of document uploads (avoids documents lingering on shared phones).
- Performance budget on a reference budget-phone profile (Q-17), e.g. limits on JavaScript size and largest-contentful-paint for citizen entry pages.
- Hub videos lazy-loaded at low bitrate with captions.

**Acceptance seeds**
- *Given* a citizen has opened a guide once, *when* they go offline, *then* the guide still opens with its "last verified" date and an offline notice.
- *Given* the device is offline, *when* the citizen taps "Request help", *then* they see an offline message with the help-desk phone number.
- *Given* the reference profile, *when* Lighthouse CI runs, *then* the citizen home and guide pages meet the budget.

**Open questions:** Q-17.

---

### F10 · Trust and safety cues
`P1 · Lite · Build S2 · Depends on: F03, F04 · DPR §06, §07, §09`

**Seed requirements**
- The DPR §09 disclaimer, verbatim, in four languages: in the footer of every page and in first-run onboarding.
- "Official link" badge on every outbound link, plus a leaving-Identity interstitial that shows the destination domain and the OTP warning.
- OTP warning ("Identity will never ask for your OTP, PIN or password") on outbound links, the case tracker and the Filing Assistant.
- "Last verified" date on every guide and fee.
- Verified volunteer IDs: a citizen can check a volunteer is genuine (Q-24).
- No government emblems or look-alike styling (C-01).

**Acceptance seeds**
- *Given* any page on any surface, *when* it renders, *then* the disclaimer is present.
- *Given* an outbound official link, *when* tapped, *then* an interstitial shows the domain and the OTP warning before leaving.

**Open questions:** Q-24, DEC-5.

---

### F11 · Measurement and KPI events
`P1 · Full · Build S4 · Depends on: F01, F08, ADR-008 · DPR §10, §12`

**Seed requirements**
- Year-1 targets (DPR §12, to be confirmed after the pilot): 15,000 Health Checks completed · 4,000 correction cases resolved · ≤ 3 working days from request to application filed · 24 camps · 150 certified volunteers · ≥ 4.5/5 satisfaction · 100% of uploaded documents deleted on schedule · 0 personal-data breaches.
- Anonymous events: Health Check started/completed, with counts of issues by type but **no entered values, identifiers or stored IP addresses** (C-04, C-14).
- Case metrics from case lifecycle timestamps (request → filed in working days; resolved count).
- Help-desk walk-ins logged by volunteers in the console.
- Two-question WhatsApp survey closes every case.
- Deletion-job results feed the "deleted on schedule" KPI.
- Pilot measures: time saved, errors, satisfaction (O01).

**Acceptance seeds**
- *Given* a citizen completes a Health Check, *when* the event is recorded, *then* it contains no field values and no identifier.
- *Given* a case reaches `filed`, *when* metrics are computed, *then* request-to-filed working days is available for that case in aggregate reports.

**Open questions:** Q-19, Q-08.

---

### F12 · Platform, environments and delivery
`P1 · Full · Build S1 · Depends on: ADR-001 to ADR-004 · DPR §08, §11`

**Seed requirements**
- India-region hosting; managed PostgreSQL; S3-compatible encrypted storage; CDN; **daily encrypted backups with tested restores** (recovery targets per Q-25).
- Environments: development, staging, production. **Production data is never copied** to other environments; synthetic data only.
- CI pipeline with the quality gates in plan §8.2; release notes list spec IDs and versions.
- Error tracking and logs with personal-data scrubbing; uptime monitoring; secrets management; dependency updates.

**Acceptance seeds**
- *Given* a backup, *when* the quarterly restore drill runs, *then* the service is restored within the agreed target.
- *Given* an error containing a phone number, *when* it is sent to error tracking, *then* the number is scrubbed.

**Open questions:** Q-25.

---

## Module specs

### Citizen app

### M01 · Health Check
`P1 · Full · Build S2 · Depends on: F02, F03, F04, F09, M02, D01–D03 · DPR §01, §05, §06, §07, §09`

**Intent.** A guided check of about 3 minutes that scores a citizen's document health and lists issues.

**Seed requirements**
- Works without login and **runs entirely on the device** (C-04).
- Asks which documents the person holds (Aadhaar, PAN, Voter ID at P1) and the key details as printed: name, DOB, gender, address locality, whether a mobile is linked to Aadhaar, and whether Aadhaar documents were updated in the last 10 years.
- Calls M02 to compare documents; applies D01–D03 rules (e.g. Aadhaar not updated in 10+ years → update due; mobile not linked → fix; year-only DOB → issue).
- Produces a **health score (0–100)** with a band label and an issue list using the status system (Q-01).
- Ends with one primary action ("Fix N issues →") and an alternative ("Book assisted help").
- Results kept on the device only, with "clear my data" (Q-04). When opening a case, the citizen chooses what to carry over.
- Can be done for oneself or someone else (Q-05).
- **Assisted mode:** a volunteer runs it on the desk tablet with the citizen; entered data is cleared when the session ends.

**Executable examples** (see plan §8.1)
- `M01-EX-fatima` — Aadhaar valid; PAN surname differs; Voter ID address update pending → **72**, "Good — 2 issues", 3 documents checked.
- `M01-EX-irfan` — PAN name variant; EPIC DOB differs; mobile not linked → **58**; all fixed → **100**.

**Acceptance seeds**
- *Given* no account, *when* a citizen completes the check, *then* a score and issues are shown, and no entered value leaves the device (network-capture test).
- *Given* the check is done on a shared help-desk tablet, *when* the session ends, *then* entered data is cleared.
- *Given* all details agree and nothing is due, *when* the check completes, *then* the score is 100 and every document shows "Valid".

**Success measures:** median completion time ≤ 3 minutes in the pilot; completion rate; Health Checks completed (KPI).
**Open questions:** Q-01, Q-04, Q-05.

---

### M02 · Mismatch Detector
`P1 · Full · Build S2 · Depends on: F02, D01–D04 · DPR §03, §05, §06`

**Intent.** Compare name, DOB, gender, address and mobile linkage across documents, explain each difference, and produce an ordered action plan.

**Seed requirements**
- Pure, deterministic function in `packages/rules`, run in the browser (ADR-002).
- Reference document is **Aadhaar** by default ("align every document with Aadhaar", DPR §03) — Q-02.
- Name comparison through a **normaliser**: case, spacing, punctuation, honorifics, initials vs full names, and common abbreviation and transliteration variants (Mohammed / Mohd. / Muhammad). Each comparison returns *match*, *variant* or *different*, with a plain-language reason (Q-03).
- DOB comparison handles full dates and **year-only DOB** (persona Ravi).
- Address compared at locality level, and only where the document carries an address.
- Per-field result: **OK**, **Mismatch** (naming the document), **Fix**, or **—** (not on this document).
- Action plan ordered by D04 journey dependencies (e.g. link mobile first, because OTPs unlock other services; Aadhaar before others). Each step shows the form, channel, fee (with "as of" date) and a link to the guide or booking.

**Executable examples**

| Example | Input | Expected |
|---|---|---|
| `M02-EX-irfan` | DPR §06 worked example (plan §8.1) | Name → PAN mismatch; DOB → EPIC mismatch; gender OK; address OK; mobile → Fix; plan order: mobile, PAN CR-01, Form 8 |
| `M02-EX-case` | "Mohammed Irfan" vs "MOHAMMED  IRFAN" | match |
| `M02-EX-abbrev` | "Mohammed Irfan" vs "Mohd. Irfan" | variant → mismatch |
| `M02-EX-initial` | "Mohammed Irfan" vs "M. Irfan" | variant → mismatch |
| `M02-EX-order` | "Mohammed Irfan" vs "Irfan Mohammed" | *to be decided — Q-03* |
| `M02-EX-surname` | "Fatima Shaikh" vs "Fatima Ansari" | different → mismatch |
| `M02-EX-yob` | Aadhaar year-only DOB vs full DOB on PAN | year-only issue on Aadhaar |

**Acceptance seeds**
- *Given* the `irfan` example, *when* compared, *then* the result table and the three-step action plan match the DPR exactly.
- *Given* any mismatch, *when* the citizen taps it, *then* they see why it was flagged in plain language.

**Open questions:** Q-02, Q-03.

---

### M03 · Smart Guides
`P1 · Full · Build S2 · Depends on: F02, F09, F10, M13, D01–D04 · DPR §01, §04, §05, §06`

**Seed requirements**
- Step-by-step guide per document and correction type: what you need (evidence checklist), where to go (official link or centre), which form, fee ("as of" date), how long it usually takes, common reasons for rejection.
- Two clear paths at the end: "Do it yourself — open guide" and "Book assisted help".
- Browse by problem ("my name is different") and by life event (marriage, moving house) via D04 journeys.
- "Last verified" date and official-link badges; works offline once loaded; shareable to WhatsApp as a link carrying no personal data.

**Acceptance seeds**
- *Given* a "PAN name" mismatch, *when* the citizen taps "Fix", *then* the PAN name-correction guide opens showing Form PAN CR-01, the fee with its "as of" date, and Protean and UTIITSL links.
- *Given* a guide's content is past its verification limit, *when* opened, *then* a "we are re-checking this guide" notice is shown.

**Open questions:** Q-12 (centre locator).

---

### M04 · Request Help
`P1 · Full · Build S3 · Depends on: F01, F05, F06, F07, F08 · DPR §01, §05, §06, §07`

**Intent.** Open a case, upload securely, get a case ID and WhatsApp updates, and follow progress.

**Seed requirements**
- Open a case (login via F05) from a Health Check issue, a guide, or by browsing services.
- Choose the applicant (self or someone else, Q-05) and the preferred help mode: desk, WhatsApp video, doorstep, camp.
- Consent (F06) and WhatsApp opt-in (F08) before submission. Optional, explicit carry-over of Health Check details.
- Secure upload (F07) driven by the service's checklist, with masked-Aadhaar guidance.
- Case ID shown on screen and sent by message.
- **Case tracker** as in DPR §07: timeline, volunteer's first name and initial ("Sana M."), help desk, expected time with the authority, OTP warning.
- The citizen can add information or documents when the case is `awaiting_citizen`, and can withdraw the case.
- Free of charge in P1 (DEC-4).

**Acceptance seeds**
- *Given* a logged-in citizen who has consented, *when* they submit, *then* a case ID is shown and a "case received" message is sent in their language.
- *Given* consent has not been given, *when* they try to submit, *then* submission is not possible.
- *Given* a case moves to `filed`, *when* the citizen opens the tracker, *then* the timeline shows the filing date and "acknowledgement shared".

**Open questions:** Q-05, Q-07, DEC-4.

---

### M05 · Book Appointment
`P1 · Full · Build S3 · Depends on: F01, F05, F08 · DPR §01, §03, §04, §05`

**Seed requirements**
- **Help-desk slots** per desk, matching desk hours (DEC-3), including **evening slots** (persona Ravi).
- **Doorstep visit requests** for the elderly, people with disabilities and the bedridden; coordinator approves and assigns the doorstep team (Q-10).
- **Camp tokens** for the pilot camp (Q-11); full camp management is M11 (P2).
- **QR code** confirmation; check-in by scanning the QR at the desk; reschedule and cancel; no-show recorded.
- Confirmation and reminder messages through F08.
- Walk-ins registered by staff.
- External centres (Aadhaar enrolment, PAN centres): deep-link to official locators rather than booking them in-app (Q-12).

**Acceptance seeds**
- *Given* open slots, *when* a citizen books one, *then* they get a QR confirmation on screen and by message.
- *Given* a slot is full, *when* a citizen views slots, *then* it is not offered.
- *Given* a booked citizen arrives, *when* their QR is scanned at the desk, *then* the appointment is marked attended.

**Open questions:** Q-10, Q-11, Q-12, DEC-3.

---

### M06 · Reminders *(P2)*
`P2 · Full · Build month 4 · Depends on: F02 (P2 rule types), F06, F08, M07 · DPR §01, §03, §05, §06`

**Seed requirements**
- Alerts before expiries (passport, driving licence), for the **10-year Aadhaar document refresh**, for **child biometric updates at 5 and 15**, for time-bound offers (free online Aadhaar document update until 14 June 2027), and for electoral roll revision windows.
- Per person, including family members (M07); explicit opt-in; snooze and stop.
- Schedules are computed from minimal metadata (dates only; no document numbers).
- Delivered by WhatsApp or SMS in the citizen's language.

**Acceptance seeds**
- *Given* a child turning 5 within 30 days, *when* reminders run, *then* the guardian receives a child-biometric reminder.
- *Given* a citizen taps "stop", *when* the next reminder is due, *then* none is sent.

**Open questions:** Q-06 (children's data).

---

### M07 · Family Profile *(P2)*
`P2 · Full · Build month 4 · Depends on: F05, F06, M01 · DPR §05`

**Seed requirements**
- Track up to **8 family members' document status — metadata only** (which documents, status, key dates). No document images or numbers.
- Consent for adding another adult; children under the guardian (Q-06).
- Per-member Health Check; remove a member and all their data.

**Acceptance seeds**
- *Given* 8 members, *when* adding a ninth, *then* it is refused with an explanation.
- *Given* a member is removed, *when* confirmed, *then* all of that member's metadata is deleted.

**Open questions:** Q-04, Q-06.

---

### M08 · Hub and Scam Alerts
`P1 · Lite · Build S2 · Depends on: F02, F09, F10, M13 · DPR §02, §05, §06`

**Seed requirements**
- Explainers, short videos and fraud warnings in four languages, managed in M13 with "last verified" dates.
- Scam alerts (fake "update" links, OTP fraud) surfaced on home and in relevant guides.
- Videos captioned in four languages and low-bitrate; text works offline.
- Share to WhatsApp.

**Acceptance seeds**
- *Given* an active scam alert, *when* a citizen opens home, *then* it is visible in their language.

---

### Staff and volunteer console

### M09 · Case Queue and SLA
`P1 · Full · Build S3 · Depends on: F01, F05, F07, M15 · DPR §05, §07, §12`

**Seed requirements**
- Desk-scoped queue sorted by **priority** (elderly, disability, deadlines) **then SLA** (Q-09).
- Filter chips with counts: All · Elderly · Deadline this week · Unassigned.
- Columns: case, citizen (**masked**, e.g. "Yusuf H."), service, priority, SLA ("Day 2 of 3", "Due today"), assigned to, status.
- Claim, assign and reassign (supervisor); escalation to the supervisor when SLA is at risk.
- SLA = working days from request to filing, target ≤ 3; paused while `awaiting_citizen` (Q-08).
- Case detail: unmasking a name requires a reason and writes an audit event; per-service "documents checked" checklist; notes with automatic Aadhaar masking (C-03).
- Assisted case creation for walk-ins on the desk tablet (F05).
- Volunteers see only their assigned cases in full; supervisors see their team's.

**Acceptance seeds**
- *Given* a mix of cases, *when* the queue loads, *then* it is ordered by priority then SLA, and names are masked.
- *Given* a volunteer opens a case not assigned to them, *when* they try to view documents, *then* access is denied.
- *Given* a request made on a Friday, *when* a public holiday falls on Monday, *then* the SLA day count skips it.

**Open questions:** Q-08, Q-09.

---

### M10 · Filing Assistant
`P1 · Full · Build S4 · Depends on: M09, M13, D01–D03 (filing scripts), F07, F08 · DPR §05, §06, §09`

**Seed requirements**
- **Portal-by-portal scripts** (myAadhaar, Protean, UTIITSL, Voters' Service Portal / ECINET), step by step, from D-series content.
- Pre-filing checklist per service.
- Steps that need a government OTP are marked **"Citizen does this"**; there is **no field anywhere for an OTP, PIN or password** (C-02).
- Record the authority's acknowledgement / application reference and attach the acknowledgement; mark the case `filed`, which notifies the citizen.
- Guidance for portal downtime and escalation.
- Usable at the desk tablet or while on a WhatsApp video call with the citizen.

**Acceptance seeds**
- *Given* a PAN name-correction case, *when* the volunteer opens the Filing Assistant, *then* the Form PAN CR-01 script for the chosen agency is shown.
- *Given* a step requires an OTP, *when* it is reached, *then* the screen tells the volunteer to hand over to the citizen and offers no OTP input.
- *Given* an acknowledgement number is recorded, *when* saved, *then* the case moves to `filed` and the citizen is notified.

---

### M11 · Camp Manager *(P2)*
`P2 · Full · Build month 5 · Depends on: M05, M09, M12 · DPR §04, §05, §12`

**Seed requirements**
- Events at masjids, colleges and neighbourhoods; registrations and capacity; tokens; **on-site intake** (fast case creation); **token display** board (names masked); camp volunteer roster; camp report (counts) feeding the "24 camps" KPI.

**Acceptance seeds**
- *Given* a camp at capacity, *when* someone registers, *then* they are offered a waitlist or another camp.

---

### M12 · Volunteer Hub *(P2)*
`P2 · Full · Build month 5 · Depends on: M15 · DPR §05, §09, §12`

**Seed requirements**
- Onboarding with identity verification and a signed confidentiality undertaking; training modules; **certification before any access to case data**; rosters; code of conduct; offboarding that removes access the same day.
- Feeds the "150 trained and certified volunteers" KPI.
- Replaces the P1 manual attestation in M15 (Q-20).

**Acceptance seeds**
- *Given* an uncertified volunteer, *when* they sign in, *then* no case data is accessible.

---

### Admin and insights

### M13 · Content Manager
`P1 · Full · Build S1 · Depends on: F02, F04, M15 · DPR §05, §06, §10, §12`

**Seed requirements**
- Create and edit every F02 content type, with **versions, diffs and rollback**.
- Workflow: draft → per-language review → publish (Q-18); changes to fees and links need a second person to verify.
- "Last verified" with verifier and source; effective dates and scheduled publishing; staleness view per owner; **one owner per document**.
- Allowlist enforcement for links; preview in every language including RTL.
- Publishing produces the per-language content bundle (F02, F09).
- Import of the Phase 0 guides/forms/fees inventory.

**Acceptance seeds**
- *Given* an editor changes the PAN fee, *when* they submit, *then* a second person must verify it, and citizens see the new fee only after publishing.
- *Given* an item passes its verification limit, *when* the daily check runs, *then* its owner is alerted.

**Open questions:** Q-18, Q-21.

---

### M14 · Impact Dashboard *(P2)*
`P2 · Full · Build month 6 · Depends on: F11, M09, M11, M12 · DPR §05, §12`

**Seed requirements**
- Cases by type, area and turnaround; outcomes; camps; volunteers; satisfaction; deletion compliance.
- **Donor-ready reports** (format depends on DEC-6).
- **Aggregates only**; small numbers suppressed so individuals cannot be identified; no drill-down to cases.

**Acceptance seeds**
- *Given* a filter that yields fewer than the suppression threshold, *when* shown, *then* the count is hidden.

---

### M15 · Access and Audit
`P1 · Full · Build S1 (roles, 2FA, audit) → S4 (deletion jobs) · Depends on: F01, F05, F06 · DPR §05, §09`

**Seed requirements**
- Roles and permission matrix: volunteer, doorstep team, supervisor, coordinator, content editor, language reviewer, publisher, admin, privacy & grievance officer.
- Staff lifecycle: invite → identity verified → training and undertaking attested (manual in P1, Q-20) → active → suspended → offboarded (same day).
- 2FA enforced.
- **Append-only, tamper-evident audit log**: sign-ins, document views, unmasking, exports, role changes, content publishing, deletion-job runs. Audit viewer for the privacy officer.
- **Data-deletion jobs** implementing the F06 schedule: purge documents 30 days after closure; anonymise cases after 12 months; produce the "deleted on schedule" report.
- Monthly access review.

**Acceptance seeds**
- *Given* a volunteer is offboarded, *when* the action is saved, *then* all their sessions end immediately.
- *Given* a document is viewed, *when* the audit log is queried, *then* it shows who, when and which document.
- *Given* the deletion job runs, *when* the report is generated, *then* it shows 100% of due documents deleted, or lists the exceptions.

**Open questions:** Q-14, Q-15, Q-20.

---

## Document and journey content specs

Content specs define each document's **structure**: fields, rule instances, correction paths, evidence checklists, filing scripts and official links. Values are entered and maintained in M13. All fees are "as of October 2026" and **must be re-verified before launch** (DPR §04, §13).

### D01 · Aadhaar
`P1 · Content · Entry S1–S3 · DPR §02, §03, §04`
- Authority: UIDAI. Channels: myAadhaar portal; Aadhaar enrolment and update centres.
- Corrections: name, DOB, gender, address, mobile, email, photo and biometrics; 10-year document update.
- Fees and rules: online POI/POA document update **free until 14 June 2027** (time-bound rule); demographic update at a centre **₹75**; biometric update **₹125**.
- Rules: documents not updated in 10+ years → update due; mobile not linked → fix (blocks OTP-based services); year-only DOB → issue; child biometrics at 5 and 15 (P2 reminders).
- Masked-Aadhaar guidance; filing script for the myAadhaar document update.

### D02 · PAN
`P1 · Content · Entry S1–S3 · DPR §02, §03, §04`
- Authority: Income Tax Department, via Protean eGov and UTIITSL (online or PAN centres).
- Corrections: name, DOB, father's name, photo/signature, address; reprint.
- Forms: **PAN CR-01** (individuals) / **CR-02** (others), from 1 April 2026. Fee about **₹101–107** with a physical card; less for e-PAN only.
- Context: PAN–Aadhaar linking fails when name or DOB differ (tax-filing season).
- Filing scripts for both Protean and UTIITSL.

### D03 · Voter ID (EPIC)
`P1 · Content · Entry S1–S3 · DPR §02, §03, §04`
- Authority: Election Commission of India. Channels: Voters' Service Portal, ECINET app, Booth Level Officer (BLO).
- Forms: **Form 8** (correction, shifting, replacement EPIC); **Form 6** (new voter). **Free.**
- Roll-check guidance; BLO contact information; Karnataka Special Intensive Revision context (began 30 June 2026; schedule later revised — re-verify).

### D04 · Cross-document journeys
`P1 · Content · Entry S2–S3 · DPR §03, §06`

Ordered, multi-document paths used by M02 (action-plan order) and M03 (browse by life event):

| Journey | Persona | Order (seed) |
|---|---|---|
| Name change after marriage | Fatima | Aadhaar → PAN (CR-01) → Voter ID (Form 8) → bank KYC; evidence: marriage certificate |
| Address change after moving | Suresh | Aadhaar first → Voter ID (Form 8) → others |
| DOB correction / year-only DOB | Ravi | Evidence (birth certificate, SSLC marks card) → Aadhaar → PAN → insurance and pension records |
| Mobile linking for OTPs | Haji Yusuf | Nearest Aadhaar centre (₹75) → then online services become usable |
| Name alignment before a deadline | Ayesha | Aadhaar ↔ marks card ↔ bank before the scholarship deadline |
| Name variants and transliteration | — | Align all documents to Aadhaar spelling |

### D05–D09 · Phase 2 documents
`P2 · Content · Months 4–6 · DPR §04`
- **D05** Ration card — Karnataka Food & Civil Supplies Department.
- **D06** Birth and death certificates — local registrar / Civil Registration System.
- **D07** Income, caste and residence certificates — Nadakacheri / Seva Sindhu.
- **D08** Passport — Passport Seva (guidance and checklists; expiry rule for M06).
- **D09** Driving licence — Parivahan Sarathi (expiry rule for M06).

### D10–D14 · Phase 3 documents
`P3 · Content · Months 7–12 · DPR §04`
- **D10** Scholarship document readiness — NSP and Karnataka SSP (names must match across Aadhaar, bank and marks cards).
- **D11** e-Shram card for unorganised workers.
- **D12** Ayushman Bharat (PM-JAY) card guidance.
- **D13** UDID disability card guidance.
- **D14** Senior-citizen and pension document checks (life certificates, mobile linking for OTPs).

---

## Integration and scale specs (Phase 3)

### X01 · DigiLocker / API Setu
`P3 · Spike → Full · Months 8–10 · DPR §08, §10`
- Start with a **research spike**: eligibility, which data could be fetched with the citizen's consent, and whether it is compatible with C-04 (on-device Health Check) and C-02.
- A full spec is written only if Identity is eligible and the privacy officer agrees.

### X02 · Partner centres
`P3 · Full · Months 7–9 · DPR §10`
- Desks at masjids, colleges and NGOs: centre onboarding; centre-scoped roles, queues, slots and dashboards; no data sharing between centres by default; partner agreements.
- Builds on the `Centre` entity in F01.

---

## Operational specs

### O01 · Pilot plan and measurement
`P1 · Lite · Weeks 12–14 · DPR §10, §12`
- About **200 citizens** at the IIC help desk and **one camp**.
- Baseline gathered in Phase 0 (current time per case, rejection/error rate, satisfaction) so "time saved" and "errors" can be measured.
- Measures: time saved, errors, satisfaction, Health Checks, cases, request-to-filed days.
- Every finding is logged against a spec ID; P1 specs amended before public launch; year-1 KPI targets re-baselined.
- **Launch readiness checklist** (month 4): VAPT findings closed; legal review done; four languages signed off; content verified; incident drill done (O02); support rota in place.

### O02 · Incident response and breach runbook
`P1 · Lite · S4 · DPR §09, §12`
- Detection, triage, containment, recovery; named roles.
- Affected citizens and the Data Protection Board informed promptly; **detailed report within 72 hours**.
- Drill before the pilot and yearly.

### O03 · Content verification operations
`P1 · Lite · S4, then monthly · DPR §05, §10, §12`
- Monthly "last verified" review; one owner per document; evidence of the source checked.
- Staleness thresholds and escalation; emergency change process when a rule or fee changes suddenly; translation turnaround targets.

### O04 · DPDP readiness check
`P2 · Lite · Month 7 · DPR §02, §09, §10`
- Checklist mapped to F06, F07, M15 and O02: consent records, rights handling, grievance officer, breach reporting, retention evidence.
- Processor agreements with vendors that handle personal data (cloud, WhatsApp provider, SMS gateway).
- Timed for when most data-fiduciary obligations under the DPDP Rules 2025 apply (around May 2027, per the DPR).
