# ADR-001 · One Next.js codebase for three surfaces

**Status:** Accepted (provisional) · **Date:** 2026-10-04 · **Specs:** F12

## Context
DPR §05 describes three apps — citizen app, staff and volunteer console, admin and insights — sharing one secure back end. DPR §08 recommends Next.js (React) + TypeScript with "one codebase for citizens and staff". The team is small (DPR §11).

## Decision
Build one Next.js (App Router) application in `apps/web`. The three surfaces are separate route groups (citizen routes under `/[locale]/…`; console and admin routes added with F05/M15), sharing `packages/*`. Node.js API routes serve the back end; NestJS only if services outgrow route handlers (DPR §08).

## Consequences
- One deployment, one dependency tree, one design system.
- Console and admin must be isolated by authentication and authorisation (F05, M15), not by separate deployments. If isolation needs grow (e.g. a separate admin domain), revisit.
