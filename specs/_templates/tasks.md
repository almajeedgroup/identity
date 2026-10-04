# <ID> · Tasks

**Conventions**

- `T###` task IDs, executed in order unless marked **[P]** (can run in parallel).
- Every task names the FR / AC / EX IDs it serves.
- Tests are written first and must fail before the implementation task starts.
- Keep tasks to one day or less.

## A · Setup

- [ ] T001 Create feature folder, flags and route stubs — <ID>-FR-01

## B · Tests first

- [ ] T010 [P] Export executable examples to fixtures — <ID>-EX-…
- [ ] T011 [P] Acceptance test for <ID>-AC-1.1 (failing)
- [ ] T012 [P] Contract test for <endpoint>

## C · Core implementation

- [ ] T020 … — <ID>-FR-02

## D · Integration

- [ ] T030 Audit events, retention class, notifications — <ID>-FR-…

## E · Language, accessibility, assisted mode

- [ ] T040 Strings in en/kn/hi/ur; Urdu RTL check
- [ ] T041 axe check and large-text mode on new screens
- [ ] T042 Assisted-mode path

## F · Verify and close

- [ ] T050 All acceptance criteria tagged and passing in CI
- [ ] T051 Update `spec.md` and `plan.md` to as-built; bump version; changelog
- [ ] T052 Demo against acceptance scenarios in the fortnightly review
