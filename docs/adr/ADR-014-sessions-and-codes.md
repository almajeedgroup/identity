# ADR-014 · Server-side sessions; one-time codes through a sender interface

**Status:** Accepted (provisional) · **Date:** 2026-10-05 · **Specs:** F05

## Context
Citizens sign in with one-time codes (DPR §08, PRD §24); staff need MFA (PRD §23). The SMS/WhatsApp provider is undecided (ADR-005). Sessions must be revocable the moment a volunteer leaves (C-06).

## Decision
- **Server-side sessions**: a random token in an `HttpOnly`, `SameSite=Lax` cookie; only its SHA-256 hash is stored. Revocation is a database update.
- **Staff MFA** with TOTP authenticator apps (RFC 6238), enrolled on first sign-in; no SMS fallback for staff.
- **One-time codes** go through an `OtpSender` interface. Until ADR-005 is decided, `OTP_SENDER=dev-outbox` writes codes to a development outbox readable by testers; the app refuses this sender when `APP_ENV=production`.

## Consequences
- No JWTs to invalidate; one indexed lookup per request.
- Testers and automated tests can sign in without a real SMS provider.
