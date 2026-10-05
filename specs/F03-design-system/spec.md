# F03 · Urbanist UI design system and status system

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P1 |
| **Spec owner** | UI/UX designer |
| **Approvers** | Product owner · UI/UX designer |
| **DPR trace** | §07 (palette, type, status system, core components, UX principles, screen concepts) |
| **Depends on** | — |
| **Version** | 0.3 |

> **Approval note.** Built ahead of approval. The contrast fix in F03-FR-02 adds four text colours that are not in the DPR palette and needs the designer's sign-off.

## 1. Summary

The DPR defines the "Urbanist UI" design language: emerald for trust, deep ink for authority, amber and coral reserved for status. This spec turns it into **tokens**, a **status system** and **core components** that every surface uses, and fixes the places where DPR colours would fail WCAG 2.2 AA as text.

## 2. Users and scenarios

Every citizen, especially older people, people with low vision and people on small, dim, budget phones.

## 3. User stories

### US1 — Readable on any phone *(must)*

- **F03-AC-1.1** — *Given* every text/background pair the components use, *when* contrast is measured, *then* each is at least 4.5 : 1 (3 : 1 for large text and icons).

### US2 — Status I can read without colour *(must)*

- **F03-AC-2.1** — *Given* any status chip, *when* rendered, *then* it shows an icon and a word, and the icon is hidden from screen readers so the word is read once.

### US3 — Large text in one tap *(must)*

- **F03-AC-3.1** — *Given* the large-text toggle, *when* tapped, *then* text is enlarged across the app, the choice is remembered on the device, and the page does not scroll sideways on a 360 px-wide screen.

### US5 — Six comparison statuses *(must)*

- **F03-AC-5.1** — *Given* the six statuses of the Full Check (M02-FR-14), *when* shown, *then* each has its own colour family, icon and word (`F03-EX-severity`), and every text/tint pair passes AA.

### US4 — Easy to tap *(must)*

- **F03-AC-4.1** — *Given* buttons, links styled as buttons, and choice inputs, *when* measured, *then* each touch target is at least 48 × 48 px.

## 4. Functional requirements

- **F03-FR-01** — **DPR palette tokens**: Ink 900 `#0F1B2D` · Emerald 600 `#0E7C66` · Mint 300 `#6EE7C8` · Emerald 50 `#E7F5F1` · Mist 50 `#F5F7F6` · Amber 400 `#F5A524` · Coral 500 `#E5484D` · Sky 500 `#2F6FED` · Slate 500 `#5B6B7A` · Line 200 `#DCE3E1`.
- **F03-FR-02** — **Contrast fix** — text colours added for status words, icons and links, each ≥ 4.5 : 1 on white, Mist 50 and its own tint:

  | Token | Hex | Used for | On white | On Mist 50 |
  |---|---|---|---|---|
  | Emerald 700 | `#0B6B58` | "Valid" text and icon | 6.45 | 5.99 |
  | Amber 700 | `#9A5800` | "Update due" text and icon | 5.57 | 5.18 |
  | Coral 700 | `#B9282E` | "Mismatch" / error text and icon | 6.17 | 5.73 |
  | Sky 600 | `#1F5BD6` | Links, "In progress" | 5.96 | 5.54 |

  Status tints for chip backgrounds: Emerald 50 `#E7F5F1`, Amber 50 `#FEF3DC`, Coral 50 `#FDECEC`, Sky 50 `#EAF1FE`. Amber 400, Coral 500 and Sky 500 remain for fills, borders and large graphics.
- **F03-FR-03** — **Type**: Urbanist (variable) with Noto Sans Kannada, Noto Sans Devanagari and Noto Naskh Arabic, self-hosted (no runtime calls to third-party font servers, C-14). Scale: Display/H1 32/800 · H2 22/700 · Body 16/500 · Caption 13/600.
- **F03-FR-04** — **Status system**: `valid` (check icon, "Valid"), `update_due` (clock icon, "Update due"), `mismatch` (cross icon, "Mismatch"), `in_progress` (arrows icon, "In progress").
- **F03-FR-05** — **Core components** in this version: primary button, secondary button, text field with uppercase caption label, radio/checkbox choice cards, status chip, document status card, health-score dial, action-plan step, official-link badge, OTP warning, disclaimer footer, language switcher, large-text toggle.
- **F03-FR-06** — **Large-text mode** scales the root font size to 125% and is stored on the device.
- **F03-FR-07** — **One next step**: a screen has at most one primary button (C-12).
- **F03-FR-08** — **Severity tokens** (PRD §12): green = Emerald (exact match, formatting only) · yellow `#7A5C00` on `#FFF8D6` (likely the same) · orange `#A84300` on `#FFEEDF` (needs review) · red = Coral 700 on Coral 50 (major difference) · grey = Slate 500 on `#EEF1F3` (missing). Icons: check, check, approximately-equal, warning triangle, cross, dash.

## 5. Executable examples

```yaml
id: F03-EX-contrast
minimum: 4.5
pairs:
  - { text: ink900,     background: white }
  - { text: ink900,     background: mist50 }
  - { text: slate500,   background: white }
  - { text: slate500,   background: mist50 }
  - { text: white,      background: emerald600 }
  - { text: emerald700, background: emerald50 }
  - { text: amber700,   background: amber50 }
  - { text: coral700,   background: coral50 }
  - { text: sky600,     background: white }
  - { text: sky600,     background: mist50 }
  - { text: emerald700, background: white }
  - { text: amber700,   background: white }
  - { text: coral700,   background: white }
failing_dpr_text_uses:
  - { text: amber400, background: white }
  - { text: coral500, background: white }
  - { text: sky500,   background: mist50 }
```

```yaml
id: F03-EX-severity
minimum: 4.5
statuses:
  exact_match:           { colour: green,  text: emerald700, tint: emerald50, icon: check }
  formatting_variation:  { colour: green,  text: emerald700, tint: emerald50, icon: check }
  likely_equivalent:     { colour: yellow, text: yellow700,  tint: yellow50,  icon: approx }
  potential_discrepancy: { colour: orange, text: orange700,  tint: orange50,  icon: warning }
  major_discrepancy:     { colour: red,    text: coral700,   tint: coral50,   icon: cross }
  missing:               { colour: grey,   text: slate500,   tint: slate50,   icon: dash }
```

## 6. Data and privacy

The large-text and language choices are stored on the device only. No personal data.

## 7. Language, accessibility and assisted mode

Components mirror in right-to-left layouts; icons that point (arrows) flip in Urdu.

## 8. Non-functional requirements

Fonts subset per script and loaded only when that script is used.

## 9. Content dependencies

None.

## 10. Edge cases and failure modes

Fonts fail to load → system fonts are used without layout breakage.

## 11. Out of scope

Console-only components (queue table) — added before M09.

## 12. Success measures

No serious or critical automated accessibility violations on any shipped screen.

## 13. Open questions

None blocking. Designer to confirm the four added text colours.

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-04 | Full draft with contrast fix; built ahead of approval | *Pending* |
| 0.3 | 2026-10-05 | Severity tokens for the PRD's six comparison statuses | *Pending* |
