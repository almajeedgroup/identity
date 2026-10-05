# M17 · Documents, upload, OCR and verification

| | |
|---|---|
| **Status** | In review |
| **Size** | Full |
| **Phase** | P0 (PRD) |
| **Spec owner** | Tech lead + privacy officer |
| **Approvers** | Product owner · Privacy & grievance officer · QA & security tester |
| **DPR trace** | §06 ("never ask for document photos" in the Quick Check), §09 (masked Aadhaar only) · **PRD** §6, §7 (steps 3–7), §9, §10, §27 (select, upload, OCR verification, document details), §28, §33 |
| **Depends on** | [F01](../F01-domain-model/spec.md) v0.4, [F02](../F02-content-model/spec.md) v0.3, [F07](../F07-secure-documents/spec.md), [M16](../M16-citizen-profile/spec.md), ADR-012 |
| **Version** | 0.1 |

> **Approval note.** Built ahead of approval (DEC-2) in increment 4 (`packages/ocr`, `packages/services`, `/[locale]/me/documents`). OCR is English-only in this version (Kannada data is available for P2).

## 1. Summary

In the Full Check a citizen adds each of their documents either by **typing the details** or by **uploading a photo or PDF**. Uploads are read by OCR on our own servers (ADR-012), but **nothing extracted is used until the citizen has seen and confirmed it** (C-17). Every field keeps its original, normalised and confirmed values (C-16). An Aadhaar image showing a full number is never stored (C-03).

## 3. User stories

### US1 — Add documents by typing *(must)*

- **M17-AC-1.1** — *Given* any of the 11 document types, *when* the citizen adds it, *then* the form asks for exactly the fields that document prints (F02 catalogue), the relation for a relative's name, and the document number — for Aadhaar, only the last four digits.
- **M17-AC-1.2** — *Given* a typed document, *when* saved, *then* each field's original and confirmed values are what was typed, the document number is encrypted (never stored in plain text), and the document counts in the Full Check at once.

### US2 — Upload with consent *(must)*

- **M17-AC-2.1** — *Given* a citizen who has not consented to uploads, *when* they try to upload, *then* they are asked first; uploading is a separate, explicit act (C-04).
- **M17-AC-2.2** — *Given* a JPG, PNG or PDF up to 10 MB, *when* uploaded, *then* the file is stored encrypted (F07), kept separate from the extracted data, and OCR runs; other files are refused (F07-AC-3.1).
- **M17-AC-2.3** — *Given* an upload whose text contains a full Aadhaar number (12 digits passing the checksum), *when* processed, *then* the file and its text are **discarded without being stored**, an audit event is written, and the citizen is asked for masked Aadhaar or to type the details (C-03).

### US3 — Read, then confirm *(must)*

- **M17-AC-3.1** — *Given* the example card texts in `M17-EX-extraction`, *when* fields are extracted, *then* the document type, fields and number are as listed, each with a confidence.
- **M17-AC-3.2** — *Given* a passport's machine-readable zone (`M17-EX-mrz`), *when* parsed, *then* name, date of birth, gender and number are read and the check digits are verified; a wrong check digit marks the zone unreadable.
- **M17-AC-3.3** — *Given* extracted fields, *when* shown, *then* each shows the value read, its confidence (fields under 80% are highlighted), and an editable box; the document is not used in any comparison until the citizen confirms it.
- **M17-AC-3.4** — *Given* the citizen changes an extracted value and confirms, *when* saved, *then* the original extracted value is kept unchanged beside the confirmed one (C-16).
- **M17-AC-3.5** — *Given* the uploaded document looks like a different type from the one chosen, *when* extraction finishes, *then* the citizen is told which type it looks like and can switch.

### US4 — PDFs *(should)*

- **M17-AC-4.1** — *Given* a PDF with a text layer, *when* uploaded, *then* its text is read directly; *given* a scanned PDF with no text, *then* the citizen is asked for a photo or to type the details.

### US5 — Manage documents *(must)*

- **M17-AC-5.1** — *Given* a verified document, *when* the citizen edits it, *then* a new version is created and earlier versions remain.
- **M17-AC-5.2** — *Given* a document, *when* the citizen deletes it, *then* the document, its versions, fields, extractions and stored files are removed and an audit event records the deletion (ids only).
- **M17-AC-5.3** — *Given* an uploaded file, *when* its owner opens it, *then* it is served privately (F07-AC-2.1/2.2); anyone else gets "not found".

## 4. Functional requirements

- **M17-FR-01** — Document types and printed fields come from the knowledge-base catalogue (F02-FR-13); relative names carry a relation (`father`, `mother`, `husband`, `wife`, `other`).
- **M17-FR-02** — Document numbers: PAN `^[A-Z]{5}[0-9]{4}[A-Z]$`; EPIC `^[A-Z]{3}[0-9]{7}$`; passport `^[A-Z][0-9]{7}$`; other numbers free text. Stored encrypted with the last four characters kept for display; Aadhaar stores only the last four digits.
- **M17-FR-03** — **OCR pipeline — read first, store after**: sniff type → (PDF) text layer or (image) OCR provider → Aadhaar guard → document-type detection → field extraction; only then are the encrypted file, the encrypted raw text, the extracted fields with confidences and the engine version stored, and the document's status set to `needs_verification`. A rejected or textless upload leaves nothing behind.
- **M17-FR-04** — **Field extraction** is deterministic: label-based for printed cards (labels such as *Name*, *Father's Name*, *Date of Birth*/*DOB*, *Gender*/*Sex*, *Address*, *Place of Birth*), number patterns per type, the passport MRZ (ICAO 9303 TD3), and ALL-CAPS name lines for PAN. Each field's confidence is the mean word confidence from OCR (1.0 for text-layer PDFs).
- **M17-FR-05** — **Type detection** by keywords: `INCOME TAX DEPARTMENT` / `Permanent Account Number` → PAN; `Unique Identification Authority` / `Aadhaar` → Aadhaar; `ELECTION COMMISSION OF INDIA` → Voter ID; `P<IND` or `REPUBLIC OF INDIA` with `PASSPORT` → passport; `DRIVING LICENCE` → driving licence; `SECONDARY SCHOOL LEAVING` → SSLC; `PRE-UNIVERSITY` → PUC; `BIRTH` with `CERTIFICATE` → birth certificate; `CASTE CERTIFICATE` → caste; `INCOME CERTIFICATE` → income; `RATION CARD` → ration card.
- **M17-FR-06** — Verification screen: original (read-only), confidence, confirmed (editable); "Confirm these details" sets every field's confirmed value and the document's status to `verified`.
- **M17-FR-07** — Upload retention: `purgeAfter` = verification time + 30 days (Q-26).
- **M17-FR-08** — Audit events: `document.created`, `document.uploaded`, `document.upload_rejected_aadhaar`, `document.extracted`, `document.kind_changed`, `document.verified`, `document.edited`, `document.deleted`, `document.file_viewed`, `access.denied`.
- **M17-FR-09** — Switching the type of an unconfirmed upload (M17-AC-3.5) re-reads the stored OCR text as the new type and replaces the unconfirmed fields; the raw text — the true original — is kept.
- **M17-FR-10** — An edit keeps each unchanged value's original and provenance in the new version; a changed value starts a new original typed by the citizen.
- **M17-FR-11** — Files are served only at `/api/files/<upload id>` to the signed-in owner (F07-AC-2.1/2.2); the extracted document number is never stored in the extraction record, only encrypted on the document.

## 5. Executable examples

```yaml
id: M17-EX-extraction
cases:
  - name: PAN card
    text: |
      INCOME TAX DEPARTMENT GOVT. OF INDIA
      Permanent Account Number Card
      ABCPE1234F
      Name
      MOHAMMED IBRAHIM
      Father's Name
      ABDUL RAHEEM
      Date of Birth
      12/04/2002
    expect:
      kind: pan
      number: ABCPE1234F
      fields: { name: "MOHAMMED IBRAHIM", father_name: "ABDUL RAHEEM", dob: "12/04/2002" }
  - name: Masked Aadhaar
    text: |
      Government of India
      Unique Identification Authority of India
      Mohammed Ibrahim
      DOB: 12/04/2002
      Male
      XXXX XXXX 2346
    expect:
      kind: aadhaar
      last4: "2346"
      fields: { name: "Mohammed Ibrahim", dob: "12/04/2002", gender: "Male" }
  - name: Voter ID with a father's name
    text: |
      ELECTION COMMISSION OF INDIA
      IDENTITY CARD
      XYZ1234567
      Elector's Name : Mohammed Ibrahim
      Father's Name : Abdul Raheem
      Sex : Male
      Date of Birth : 12-04-2002
    expect:
      kind: voter_id
      number: XYZ1234567
      fields: { name: "Mohammed Ibrahim", relative_name: "Abdul Raheem", relative_type: father, gender: "Male", dob: "12-04-2002" }
  - name: SSLC marks card
    text: |
      KARNATAKA SECONDARY SCHOOL LEAVING CERTIFICATE EXAMINATION
      Candidate Name : MOHAMED IBRAHIM
      Father Name : ABDUL RAHIM
      Mother Name : AYESHA BANU
      Date of Birth : 12/04/2002
    expect:
      kind: sslc
      fields: { name: "MOHAMED IBRAHIM", father_name: "ABDUL RAHIM", mother_name: "AYESHA BANU", dob: "12/04/2002" }
```

```yaml
id: M17-EX-mrz
source: ICAO 9303 specimen layout with an Indian issuing state; the person is fictitious
lines:
  - "P<INDIBRAHIM<<MOHAMMED<<<<<<<<<<<<<<<<<<<<<<"
  - "N1234567<7IND0204129M3201015<<<<<<<<<<<<<<08"
expect:
  number: N1234567
  surname: IBRAHIM
  givenNames: MOHAMMED
  name: "MOHAMMED IBRAHIM"
  dob: "2002-04-12"
  gender: M
  checksOk: true
corrupted:
  - "P<INDIBRAHIM<<MOHAMMED<<<<<<<<<<<<<<<<<<<<<<"
  - "N1234567<8IND0204129M3201015<<<<<<<<<<<<<<08"
```

```yaml
id: M17-EX-aadhaar-guard
cases:
  - { text: "Aadhaar 2341 2341 2346 Mohammed", rejected: true }
  - { text: "XXXX XXXX 2346 Mohammed", rejected: false }
  - { text: "PAN ABCPE1234F phone 9876543210", rejected: false }
```

## 6. Data and privacy

| Data item | Purpose | Consent | Stored where | Who can see it | Retention | Deleted by |
|---|---|---|---|---|---|---|
| Typed and confirmed field values | Full Check | `full_check` | Database | Citizen; staff in a case (P1) | Until the citizen deletes them | Settings / document delete |
| Original extracted values | Keep what the document said (C-16) | `uploads` to create; kept with the confirmed document under `full_check` | Database | As above | As above | As above (unconfirmed uploads are also deleted when upload consent is withdrawn, F06-AC-3.2) |
| Uploaded file | Read the document; show it back | `uploads` | Encrypted object store | Citizen only (P0) | 30 days after verification (Q-26) | Retention job / delete |
| OCR raw text | Re-read without re-uploading; staff review (P1) | `uploads` | Database, encrypted | Nobody in the UI (P0) | With the upload | With the upload |
| Document number | Identify the document; mask in views | `full_check` | Database, encrypted (Aadhaar: last 4 only) | Citizen (masked) | With the document | With the document |

## 11. Out of scope

Kannada and other scripts in OCR (P2); scanned-PDF rendering; automatic redaction of Aadhaar numbers in images; family members' documents (P1).

## Changelog

| Version | Date | Change | Approved by |
|---|---|---|---|
| 0.1 | 2026-10-05 | First full spec from the Developer PRD | *Pending* |
