# F04 · Internationalisation and RTL

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 |
| **Spec owner** | Tech lead + content lead |
| **Approvers** | Product owner · Content lead |
| **DPR trace** | §07 ("Plain language, 4 languages", "full RTL layout for Urdu", "4 languages · mirrored layout for اردو") |
| **Depends on** | [F03](../F03-design-system/spec.md) |
| **Version** | 0.2 |

> **Approval note.** Built ahead of approval. Kannada, Hindi and Urdu strings in this increment are **draft translations awaiting review** by the language reviewers (DPR §11); they are not release-ready until signed off.

## 1. Summary

The app must work equally well in English, ಕನ್ನಡ, हिन्दी and اردو, with a mirrored layout for Urdu. This spec fixes how languages are chosen, remembered and checked, and how numbers, money and dates are shown.

## 2. Users and scenarios

Every citizen; especially those who do not read English comfortably.

## 3. User stories

### US1 — Choose my language first *(must)*

- **F04-AC-1.1** — *Given* a first visit to the site root, *when* the page loads, *then* four language choices are shown, each written in its own script.
- **F04-AC-1.2** — *Given* a citizen chose a language, *when* they return to the site root on the same device, *then* they are taken straight to that language.

### US2 — Urdu reads right to left *(must)*

- **F04-AC-2.1** — *Given* Urdu, *when* any page renders, *then* the document language is `ur` and the direction is right-to-left; for the other languages it is left-to-right.

### US3 — Nothing missing in any language *(must)*

- **F04-AC-3.1** — *Given* a message key present in one language file but missing or empty in another, *when* the i18n check runs, *then* it fails and names the key and language.

### US4 — Money, dates and counts look right *(must)*

- **F04-AC-4.1** — *Given* amounts and dates, *when* formatted in each language, *then* the results match `F04-EX-formats`.
- **F04-AC-4.2** — *Given* a count, *when* a message has singular and plural forms, *then* the correct form is used for each language.

## 4. Functional requirements

- **F04-FR-01** — Locales: `en`, `kn`, `hi`, `ur`. URLs carry the locale: `/en/…`, `/kn/…`, `/hi/…`, `/ur/…`.
- **F04-FR-02** — The site root shows the language chooser unless a choice is stored on the device; the choice is stored in browser storage (no cookie, no account).
- **F04-FR-03** — Every page has a language switcher that keeps the citizen on the same page.
- **F04-FR-04** — Messages live in one JSON file per locale; keys are identical across locales; `{name}` placeholders; plural variants as `key_one` / `key_other`, chosen with the language's plural rules.
- **F04-FR-05** — Digits are Western Arabic (0–9) in all languages, matching what is printed on cards and portals *(Q-23 default)*. Money uses Indian grouping (₹1,20,000). Dates are `DD-MM-YYYY`.
- **F04-FR-06** — People's names and localities are shown exactly as typed; never translated or transliterated.
- **F04-FR-07** — Translation status per language is recorded in `apps/web/messages/STATUS.md`; a language is release-ready only when its reviewer has signed off.

## 5. Executable examples

```yaml
id: F04-EX-formats
inr:
  - { amount: 75,     expect: "₹75" }
  - { amount: 120000, expect: "₹1,20,000" }
  - { amount: 730000, expect: "₹7,30,000" }
dates:
  - { date: "2027-06-14", expect: "14-06-2027" }
  - { date: "2026-11-02", expect: "02-11-2026" }
plurals:
  - { locale: en, count: 1, form: one }
  - { locale: en, count: 2, form: other }
  - { locale: hi, count: 1, form: one }
  - { locale: kn, count: 2, form: other }
  - { locale: ur, count: 1, form: one }
```

(The same `inr` and `dates` outputs apply in every locale.)

## 6. Data and privacy

The language choice is stored on the device only.

## 7. Language, accessibility and assisted mode

The `lang` attribute is always correct so screen readers use the right voice.

## 8. Non-functional requirements

Only the current locale's messages are sent to the browser.

## 9. Content dependencies

Language reviewers for kn, hi and ur (DPR §11).

## 10. Edge cases and failure modes

Unknown locale in the URL → 404 page with links to the four languages.

## 11. Out of scope

Staff console languages (Q-16); voice guidance.

## 12. Success measures

Share of Health Checks completed per language (F11).

## 13. Open questions

| ID | Question | Proposed default | Blocking? |
|---|---|---|---|
| Q-16 | Staff console language | English in P1 | No |
| Q-23 | Digits | Western Arabic | No (applied) |

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-04 | Full draft; built ahead of approval | *Pending* |
