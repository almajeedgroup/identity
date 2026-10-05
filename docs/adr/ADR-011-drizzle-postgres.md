# ADR-011 · Drizzle ORM on PostgreSQL, with embedded PGlite for development and tests

**Status:** Accepted (provisional) · **Date:** 2026-10-05 · **Specs:** F01 v0.3 · **Amends:** constitution C-15 (Prisma → Drizzle)

## Context
The DPR suggested PostgreSQL with Prisma. The Developer PRD leaves the stack open but needs a relational model (§25), versioned database-driven rules (§24) and database-level guarantees (immutable originals, append-only audit). Builds must work offline and in restricted CI networks, and a small team must be able to run everything locally without installing a database server.

## Decision
- **PostgreSQL** remains the database (production: managed PostgreSQL 16+, India region — ADR-004).
- **Drizzle ORM** (TypeScript schema, SQL-first queries, generated SQL migrations) replaces Prisma: no binary engine downloads, no code generation step, plain SQL migrations reviewable in pull requests.
- **PGlite** (PostgreSQL compiled to WebAssembly) runs in-process when `DATABASE_URL` is not set: an in-memory database for tests, a file database under `.data/` for local development. Production always uses `DATABASE_URL` (refused otherwise when `APP_ENV=production`).
- Triggers enforce C-16 (original values immutable) and M15 (append-only audit) in the database itself.

## Consequences
- Tests run against real PostgreSQL semantics (triggers, JSONB, advisory locks) with zero setup; CI can also run against a PostgreSQL service.
- Two drivers share one schema; code depends only on Drizzle's common PostgreSQL API.
- PGlite is not for production traffic.
