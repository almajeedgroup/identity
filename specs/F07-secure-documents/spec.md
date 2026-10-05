# F07 · Secure document handling

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P0 (PRD) |
| **Spec owner** | Tech lead |
| **Approvers** | Privacy & grievance officer · QA & security tester |
| **DPR trace** | §08 (object storage AES-256, signed URLs, auto-purge), §09 · **PRD** §9 (document number encrypted/masked), §10 (keep the original file separate), §23 (encrypt at rest, no public URLs) |
| **Depends on** | [F01](../F01-domain-model/spec.md) v0.3, [M15](../M15-access-audit/spec.md), ADR-013 |
| **Version** | 0.2 |

> **Approval note.** Built ahead of approval. The production object store (S3-compatible, India region) waits for ADR-004; development and tests use an encrypted local store behind the same interface.

## 1. Summary

Uploaded documents and the most sensitive values are **encrypted by the application** before they are stored, are **never reachable by a public URL**, and every view is audited.

## 3. User stories

### US1 — Encrypted at rest *(must)*

- **F07-AC-1.1** — *Given* a file or a sensitive value, *when* stored, *then* the stored bytes are AES-256-GCM ciphertext in the envelope of `F07-EX-envelope`; decrypting with the right key returns the original; a modified ciphertext or the wrong key fails loudly.
- **F07-AC-1.2** — *Given* a key rotation, *when* a new key id becomes current, *then* new data uses it and data written under older key ids still decrypts.
- **F07-AC-1.3** — *Given* production (`APP_ENV=production`), *when* the data key is missing or not 32 bytes, *then* the app refuses to start; development generates a local key file that is never committed.

### US2 — No public URLs *(must)*

- **F07-AC-2.1** — *Given* an uploaded file, *when* anyone other than its owner (or staff with permission in a case, P1) requests it, *then* the response is "not found" and an `access.denied` audit event is written; the owner's view writes `document.file_viewed`.
- **F07-AC-2.2** — *Given* a file response, *when* sent, *then* it carries `Cache-Control: private, no-store` and is never served from a public path.

### US3 — Only real documents *(must)*

- **F07-AC-3.1** — *Given* an upload, *when* its first bytes are not JPEG, PNG or PDF (`F07-EX-types`), or it is larger than 10 MB, *then* it is refused, whatever its name or declared type.

## 4. Functional requirements

- **F07-FR-01** — Envelope: `v1.<key id>.<12-byte IV, base64url>.<16-byte tag, base64url>.<ciphertext, base64url>` for values; files use the same fields in a binary header.
- **F07-FR-02** — Keys come from `DATA_KEYS` (comma-separated `id:base64` pairs) and `DATA_KEY_CURRENT`; never from the database.
- **F07-FR-03** — Storage keys are random UUIDs — never derived from names or document numbers.
- **F07-FR-04** — Object store interface: `put`, `get`, `delete`, `exists`. Local encrypted store now; S3-compatible after ADR-004.
- **F07-FR-05** — Values encrypted by the application: document numbers (except Aadhaar, which keeps only the last four digits, C-03), OCR raw text, TOTP secrets, uploaded files.

## 5. Executable examples

```yaml
id: F07-EX-envelope
pattern: "^v1\\.[a-z0-9-]+\\.[A-Za-z0-9_-]{16}\\.[A-Za-z0-9_-]{22}\\.[A-Za-z0-9_-]*$"
```

```yaml
id: F07-EX-types
accepted:
  - { name: jpeg, firstBytesHex: "ffd8ffe0", mime: image/jpeg }
  - { name: png,  firstBytesHex: "89504e470d0a1a0a", mime: image/png }
  - { name: pdf,  firstBytesHex: "255044462d", mime: application/pdf }
refused:
  - { name: gif,  firstBytesHex: "47494638" }
  - { name: exe,  firstBytesHex: "4d5a" }
  - { name: html, firstBytesHex: "3c68746d6c" }
maxBytes: 10485760
```

## 6. Data and privacy

Files and encrypted values follow the retention of what they belong to (Q-26 for uploads; F06 for deletion on request).

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-04 | Seed in `backlog.md` | — |
| 0.2 | 2026-10-05 | Full spec for the PRD P0 build | *Pending* |
