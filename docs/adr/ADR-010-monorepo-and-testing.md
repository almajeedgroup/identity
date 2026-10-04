# ADR-010 · Monorepo, testing and specs as fixtures

**Status:** Accepted (provisional) · **Date:** 2026-10-04 · **Specs:** F12

## Context
Spec-driven development needs tests to stay tied to specs (plan §8–§9), and a small team needs one place to work.

## Decision
- npm workspaces: `apps/web`, `packages/{domain,rules,content,ui}`; packages are consumed as TypeScript source (no build step), transpiled by Next.js and Vitest.
- Vitest for unit and example tests; Playwright for acceptance tests in `tests/acceptance`.
- Executable examples are fenced `yaml` blocks with an `id` inside `spec.md`; tests load them from the spec file at run time (`tools/spec`). There is no copied fixture to drift.
- Tests name the spec IDs they cover; `tools/trace.ts` builds `docs/traceability.md`.

## Consequences
- Changing an example in a spec immediately changes what the tests expect.
- Spec files must keep valid YAML in example blocks; CI fails otherwise.
