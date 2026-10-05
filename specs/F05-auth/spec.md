# F05 · Authentication and sessions

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P0 (PRD) |
| **Spec owner** | Tech lead |
| **Approvers** | Product owner · Privacy & grievance officer · QA & security tester |
| **DPR trace** | §08 ("OTP for citizens · 2FA for staff"), §09 (security controls) · **PRD** §7 step 1, §23 ("MFA for staff/admin accounts"), §24 ("passwordless/OTP or strong authentication"), §27 (sign in, staff login) |
| **Depends on** | [F01](../F01-domain-model/spec.md) v0.3, [M15](../M15-access-audit/spec.md) |
| **Version** | 0.2 |

> **Approval note.** Built ahead of approval (DEC-2). The SMS provider (ADR-005) is not chosen; until it is, one-time codes go to a **development outbox** that refuses to run in production.

## 1. Summary

Citizens sign in with a **one-time code sent to their own mobile** — no password to forget. Staff sign in with **email, password and an authenticator-app code (TOTP)**; 2FA is mandatory and enrolled on first sign-in. Sessions are server-side, revocable and short for staff. The anonymous Quick Check never needs an account (C-04).

## 3. User stories

### US1 — Citizen sign-in with a one-time code *(must)*

- **F05-AC-1.1** — *Given* an Indian mobile number in any common format (`F05-EX-mobiles`), *when* a code is requested, *then* the number is normalised to `+91XXXXXXXXXX` and a 6-digit code is sent; invalid numbers are refused with a plain message.
- **F05-AC-1.2** — *Given* a code, *when* it is entered correctly within 10 minutes, *then* the citizen is signed in (a new account is created on first sign-in) and the code cannot be used again.
- **F05-AC-1.3** — *Given* wrong codes, *when* 5 attempts have failed or 10 minutes have passed, *then* the code no longer works; *given* more than 5 code requests for one number in an hour, or a request within 30 seconds of the last, *then* the request is refused.
- **F05-AC-1.4** — *Given* the system stores codes, *when* the database is read, *then* only a salted hash of each code is stored, never the code.

### US2 — Staff sign-in with mandatory 2FA *(must)*

- **F05-AC-2.1** — *Given* a staff account without 2FA, *when* they sign in with the right password, *then* they can do nothing except enrol an authenticator app; *given* 2FA is enrolled, *then* a valid TOTP code is required before any staff page opens.
- **F05-AC-2.2** — *Given* the RFC 6238 test vectors (`F05-EX-totp`), *when* codes are generated, *then* they match; codes from the previous and next 30-second window are accepted, and a code is never accepted twice.
- **F05-AC-2.3** — *Given* 5 failed password or TOTP attempts, *when* the next attempt is made within 15 minutes, *then* it is refused without checking the password.
- **F05-AC-2.4** — *Given* passwords, *when* stored, *then* only a scrypt hash with a per-user salt is kept; passwords shorter than 12 characters are refused.

### US3 — Sessions *(must)*

- **F05-AC-3.1** — *Given* a session, *when* it is idle or old beyond `F05-EX-sessions`, *then* it is refused and the person signs in again.
- **F05-AC-3.2** — *Given* a staff member is suspended or offboarded (M15), *when* their next request arrives, *then* all their sessions are already revoked.
- **F05-AC-3.3** — *Given* the session cookie, *when* inspected, *then* it is `HttpOnly`, `SameSite=Lax`, `Secure` on HTTPS, and holds a random token whose hash — not the token — is in the database.
- **F05-AC-3.4** — *Given* a citizen signs out, *when* the old cookie is replayed, *then* it is refused.

### US4 — Development outbox *(must)*

- **F05-AC-4.1** — *Given* `OTP_SENDER=dev-outbox`, *when* `APP_ENV=production`, *then* the app refuses to start; in other environments, codes are written to the development outbox for testers.

## 4. Functional requirements

- **F05-FR-01** — Mobile numbers: 10 digits starting 6–9, optionally prefixed by `+91`, `91` or `0`, with spaces or hyphens.
- **F05-FR-02** — One-time codes: 6 digits from a cryptographic random source; stored as `sha256(pepper ‖ challenge id ‖ code)`; valid 10 minutes; 5 attempts.
- **F05-FR-03** — Code delivery goes through an `OtpSender` interface (`dev-outbox` now; DLT SMS or WhatsApp authentication template after ADR-005). Messages never contain anything but the code and the service name.
- **F05-FR-04** — Staff passwords: scrypt (N = 2¹⁵, r = 8, p = 1, 64-byte key, 16-byte salt), minimum 12 characters; compared in constant time.
- **F05-FR-05** — TOTP: RFC 6238, SHA-1, 30-second step, 6 digits, ±1 step; the last accepted step is stored to stop replay; the secret is stored encrypted (ADR-013) and shown once at enrolment as text and QR code.
- **F05-FR-06** — Sessions: 32 random bytes, base64url, in cookie `identity_session`; database keeps `sha256(token)`, subject, kind, created, last seen, expiry, MFA flag, revoked time.
- **F05-FR-07** — Every sign-in, sign-out, failed attempt, lockout, enrolment and revocation writes an audit event (M15).
- **F05-FR-08** — Assisted creation of accounts at the desk is P1 (with M09); not in this version.

## 5. Executable examples

```yaml
id: F05-EX-mobiles
valid:
  - { input: "9876543210",      normalised: "+919876543210" }
  - { input: "+91 98765 43210", normalised: "+919876543210" }
  - { input: "091-9876543210",  normalised: "+919876543210" }
  - { input: "919876543210",    normalised: "+919876543210" }
invalid: ["12345", "5876543210", "98765432101", "+1 202 555 0100", "98765abcde"]
```

```yaml
id: F05-EX-totp
source: RFC 6238 Appendix B (SHA-1, secret "12345678901234567890"), truncated to 6 digits
secretAscii: "12345678901234567890"
cases:
  - { time: 59,          code: "287082" }
  - { time: 1111111109,  code: "081804" }
  - { time: 1111111111,  code: "050471" }
  - { time: 1234567890,  code: "005924" }
  - { time: 2000000000,  code: "279037" }
```

```yaml
id: F05-EX-sessions
citizen: { idleHours: 72, maxDays: 14 }
staff:   { idleMinutes: 30, maxHours: 12 }
```

## 6. Data and privacy

| Data item | Purpose | Basis | Stored where | Who can see it | Retention |
|---|---|---|---|---|---|
| Mobile number | Sign-in, contact | Account | Database | The citizen; staff in a case | Account lifetime |
| Code hashes, attempts | Sign-in security | Legitimate security need | Database | Nobody (hashes) | 24 hours, then deleted |
| Sessions (token hashes) | Keep people signed in | Account | Database | Nobody | Until expiry + 30 days |
| Staff password hash, TOTP secret (encrypted) | Staff sign-in | Employment / volunteering | Database | Nobody | Until offboarding + 30 days |

## 11. Out of scope

SMS/WhatsApp provider (ADR-005); single sign-on for staff; assisted account creation (P1).

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-05 | Full spec for the PRD P0 build | *Pending* |
