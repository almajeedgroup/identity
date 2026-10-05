/** F02 v0.3 · Rules knowledge base (PRD §14, §15). Structure here; values in the database (M13). */
import { z } from 'zod';
import { isIsoDate } from '../dates';
import { checkOfficialUrl } from '../officialLinks';
import { LocalizedText, Meta } from '../schema';

/** F02-FR-13 · The 11 PRD §6 documents, in catalogue order. */
export const DOCUMENT_KINDS = [
  'aadhaar',
  'pan',
  'passport',
  'voter_id',
  'driving_licence',
  'birth_certificate',
  'sslc',
  'puc',
  'caste_certificate',
  'income_certificate',
  'ration_card',
] as const;
export type DocumentKind = (typeof DOCUMENT_KINDS)[number];

/** Fields the Full Check compares (M02-FR-14…21). `relative_name` maps to a parent or spouse by relation. */
export const COMPARED_FIELDS = ['name', 'dob', 'gender', 'father_name', 'mother_name', 'spouse_name', 'place_of_birth', 'address'] as const;
export type ComparedField = (typeof COMPARED_FIELDS)[number];
export const PRINTED_FIELDS = [...COMPARED_FIELDS, 'relative_name'] as const;
export type PrintedField = (typeof PRINTED_FIELDS)[number];

export const ISSUE_TYPES = ['spelling', 'name_change', 'date', 'gender', 'relation', 'place', 'address'] as const;

const id = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'ids are lower-case words joined by hyphens');
/** F02-FR-10 · IN, IN-KA, IN-KA-BLR … */
export const JurisdictionCode = z.string().regex(/^IN(-[A-Z]{2}(-[A-Z0-9]{2,12})?)?$/, 'jurisdiction codes look like IN, IN-KA or IN-KA-BLR');

export const Jurisdiction = z.object({ code: JurisdictionCode, name: LocalizedText }).strict();

export const Authority = z
  .object({
    id,
    name: LocalizedText,
    jurisdiction: JurisdictionCode,
    department: z.string().trim().min(1).optional(),
    sources: z.array(id),
    meta: Meta,
  })
  .strict();
export type Authority = z.infer<typeof Authority>;

export const OfficialSource = z
  .object({
    id,
    title: LocalizedText,
    url: z.string().superRefine((url, ctx) => {
      const check = checkOfficialUrl(url);
      if (!check.ok) ctx.addIssue({ code: 'custom', message: `link rejected: ${check.reason}` });
    }),
    authority: id,
    kind: z.enum(['portal', 'form', 'notification', 'guidance']),
    meta: Meta,
  })
  .strict();
export type OfficialSource = z.infer<typeof OfficialSource>;

export const CatalogueDocument = z
  .object({
    kind: z.enum(DOCUMENT_KINDS),
    label: LocalizedText,
    tier: z.number().int().min(1).max(5),
    fields: z.array(z.object({ field: z.enum(PRINTED_FIELDS), optional: z.boolean().default(false) }).strict()).min(1),
    numberLabel: LocalizedText,
    /** C-03: Aadhaar numbers are never stored in full. */
    numberStorage: z.enum(['last4_only', 'encrypted']),
    authorities: z.array(z.object({ jurisdiction: JurisdictionCode, authority: id }).strict()).min(1),
  })
  .strict();
export type CatalogueDocument = z.infer<typeof CatalogueDocument>;

const isoDate = z.string().refine(isIsoDate, 'must be a valid YYYY-MM-DD date');

export const GovernmentFee = z
  .object({ id, label: LocalizedText, amountInr: z.number().nonnegative().optional(), meta: Meta })
  .strict();

export const CorrectionRule = z
  .object({
    id,
    document: z.enum(DOCUMENT_KINDS),
    jurisdiction: JurisdictionCode,
    authority: id,
    fields: z.array(z.enum(PRINTED_FIELDS)).min(1),
    issueTypes: z.array(z.enum(ISSUE_TYPES)).min(1),
    category: z.enum(['minor', 'major', 'update']),
    eligibility: LocalizedText.optional(),
    evidence: z.array(LocalizedText),
    requiredDocuments: z.array(LocalizedText),
    prerequisites: z.array(
      z.object({ document: z.enum(DOCUMENT_KINDS), fields: z.array(z.enum(PRINTED_FIELDS)).min(1), reason: LocalizedText }).strict(),
    ),
    route: z.object({ mode: z.enum(['online', 'offline', 'both']), form: z.string().trim().min(1).optional(), where: LocalizedText }).strict(),
    appointment: LocalizedText.optional(),
    steps: z.array(LocalizedText).min(1),
    tracking: LocalizedText.optional(),
    onRejection: LocalizedText.optional(),
    escalation: LocalizedText.optional(),
    /** Shown as "usually …", never as a promise (C-18). */
    typicalProcessing: LocalizedText.optional(),
    fees: z.array(GovernmentFee),
    sources: z.array(id).min(1),
    priority: z.number().int().min(0),
    internalNotes: z.string().optional(),
    history: z.array(z.object({ version: z.number().int().min(1), date: isoDate, change: z.string().trim().min(1), by: z.string().trim().min(1) }).strict()).min(1),
    meta: Meta,
  })
  .strict();
export type CorrectionRule = z.infer<typeof CorrectionRule>;

const word = z.string().regex(/^[a-z0-9]+$/, 'dictionary words are lower-case letters and digits');

export const VariantGroup = z.object({ canonical: word, variants: z.array(word).min(1) }).strict();
export const Abbreviation = z.object({ short: word, long: z.string().regex(/^[a-z0-9]+( [a-z0-9]+)*$/) }).strict();

export const ServicePrice = z
  .object({
    id,
    service: z.enum(['detailed_report', 'assistance']),
    document: z.enum(DOCUMENT_KINDS).optional(),
    amountInr: z.number().nonnegative(),
    meta: Meta,
  })
  .strict();
export type ServicePrice = z.infer<typeof ServicePrice>;

export const KnowledgeBase = z
  .object({
    version: z.string().trim().min(1),
    jurisdictions: z.array(Jurisdiction).min(1),
    authorities: z.array(Authority),
    sources: z.array(OfficialSource),
    catalogue: z.array(CatalogueDocument),
    rules: z.array(CorrectionRule),
    placeVariants: z.object({ meta: Meta, groups: z.array(VariantGroup) }).strict(),
    addressAbbreviations: z.object({ meta: Meta, entries: z.array(Abbreviation), ignore: z.array(word) }).strict(),
    servicePrices: z.array(ServicePrice),
  })
  .strict();
export type KnowledgeBase = z.infer<typeof KnowledgeBase>;
