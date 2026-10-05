# ADR-013 · Application-level encryption for sensitive values and files

**Status:** Accepted (provisional) · **Date:** 2026-10-05 · **Specs:** F07, F05, M17

## Context
PRD §23 requires encryption in transit and at rest and treating identity data as highly sensitive. Disk encryption of the managed database protects against stolen disks, not against database dumps, backups or over-broad access.

## Decision
- Document numbers (except Aadhaar, which keeps only four digits), OCR raw text, TOTP secrets and uploaded files are encrypted by the application with **AES-256-GCM** before storage.
- Keys come from the environment (`DATA_KEYS` = `id:base64` pairs, `DATA_KEY_CURRENT`), later from the cloud key manager (ADR-004). Ciphertexts carry their key id, so keys rotate without re-encrypting everything at once.
- Development generates a local key file in `.data/` (ignored by git); production refuses to start without valid keys.

## Consequences
- A database dump alone does not reveal identifiers or documents.
- Encrypted columns cannot be searched; nothing needs to search them.
