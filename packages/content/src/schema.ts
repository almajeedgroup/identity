/** F02 · Content model. Structure lives here; values live in content (plan §4.3). */
import { z } from 'zod';
import { isIsoDate } from './dates';
import { checkOfficialUrl } from './officialLinks';

export const LOCALES = ['en', 'kn', 'hi', 'ur'] as const;
export type Locale = (typeof LOCALES)[number];

export const DOC_KINDS = ['aadhaar', 'pan', 'voter_id'] as const;
export type DocKind = (typeof DOC_KINDS)[number];

/** Fields compared or checked by the rules engine (M02-FR-02, M02-FR-10). */
export const FIELDS = ['name', 'dob', 'gender', 'address', 'mobile_link', 'documents'] as const;
export type Field = (typeof FIELDS)[number];

const nonEmpty = z.string().trim().min(1);
const isoDate = z.string().refine(isIsoDate, 'must be a valid YYYY-MM-DD date');

/** F02-FR-02 — every citizen-facing text in all four languages. */
export const LocalizedText = z.object({ en: nonEmpty, kn: nonEmpty, hi: nonEmpty, ur: nonEmpty }).strict();
export type LocalizedText = z.infer<typeof LocalizedText>;

/** F02-FR-01 — accountability metadata on every item. */
export const Meta = z
  .object({
    owner: nonEmpty,
    source: nonEmpty,
    version: z.number().int().min(1),
    lastVerified: isoDate.nullable().optional(),
    effectiveFrom: isoDate.optional(),
    effectiveTo: isoDate.optional(),
    status: z.enum(['draft', 'in_review', 'published', 'withdrawn']),
  })
  .strict()
  .refine((m) => !m.effectiveFrom || !m.effectiveTo || m.effectiveFrom <= m.effectiveTo, {
    message: 'effectiveFrom must not be after effectiveTo',
  });
export type Meta = z.infer<typeof Meta>;

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are lower-case words joined by hyphens');

export const DocumentType = z
  .object({
    id,
    kind: z.enum(DOC_KINDS),
    label: LocalizedText,
    authority: LocalizedText,
    fieldsPrinted: z.array(z.enum(FIELDS)).min(1),
    meta: Meta,
  })
  .strict();
export type DocumentType = z.infer<typeof DocumentType>;

export const OfficialLink = z
  .object({
    id,
    url: z.string().superRefine((url, ctx) => {
      const check = checkOfficialUrl(url);
      if (!check.ok) ctx.addIssue({ code: 'custom', message: `link rejected: ${check.reason}` });
    }),
    label: LocalizedText,
    authority: nonEmpty,
    meta: Meta,
  })
  .strict();
export type OfficialLink = z.infer<typeof OfficialLink>;

export const Fee = z
  .object({
    id,
    label: LocalizedText,
    amountInr: z.number().nonnegative().optional(),
    meta: Meta,
  })
  .strict();
export type Fee = z.infer<typeof Fee>;

export const Action = z
  .object({
    id,
    document: z.enum(DOC_KINDS),
    fields: z.array(z.enum(FIELDS)).min(1),
    priority: z.number().int().min(0),
    title: LocalizedText,
    summary: LocalizedText,
    form: nonEmpty.optional(),
    where: LocalizedText,
    fees: z.array(Fee),
    links: z.array(id),
    meta: Meta,
  })
  .strict();
export type Action = z.infer<typeof Action>;

const nameToken = z.string().regex(/^[a-z]+$/, 'name tokens are lower-case latin letters');

export const NameVariantGroup = z
  .object({
    canonical: nameToken,
    variants: z.array(nameToken).min(1),
    abbreviations: z.array(nameToken).default([]),
  })
  .strict();
export type NameVariantGroup = z.infer<typeof NameVariantGroup>;

export const NameVariants = z.object({ meta: Meta, groups: z.array(NameVariantGroup) }).strict();
export type NameVariants = z.infer<typeof NameVariants>;

export const ContentBundle = z
  .object({
    version: nonEmpty,
    documents: z.array(DocumentType),
    links: z.array(OfficialLink),
    actions: z.array(Action),
    nameVariants: NameVariants,
  })
  .strict();
export type ContentBundle = z.infer<typeof ContentBundle>;
