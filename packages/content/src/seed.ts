/**
 * Seed content for D01 Aadhaar, D02 PAN and D03 Voter ID (P1).
 *
 * Values come from DPR v1.0 §04 and §06 ("fees as of October 2026 — re-verify before quoting").
 * None of them has been verified on the official portals yet, so no item carries a
 * `lastVerified` date (F02-FR-09). Kannada, Hindi and Urdu texts are draft translations
 * awaiting the language reviewers (F04-FR-07).
 */
import type { ContentBundle, Meta } from './schema';

const DPR_SOURCE = 'DPR v1.0 §04 (as of Oct 2026) — re-verify on the official portal';

function meta(owner: string, extra: Partial<Meta> = {}): Meta {
  return { owner, source: DPR_SOURCE, version: 1, lastVerified: null, status: 'in_review', ...extra };
}

const AADHAAR_OWNER = 'Content lead — D01 Aadhaar';
const PAN_OWNER = 'Content lead — D02 PAN';
const VOTER_OWNER = 'Content lead — D03 Voter ID';

const FREE = { en: 'Free', kn: 'ಉಚಿತ', hi: 'मुफ़्त', ur: 'مفت' };
const CENTRE_75 = { en: '₹75 at a centre', kn: 'ಕೇಂದ್ರದಲ್ಲಿ ₹75', hi: 'केंद्र पर ₹75', ur: 'مرکز پر ₹75' };
const VOTER_WHERE = {
  en: "Voters' Service Portal or your BLO",
  kn: 'ಮತದಾರರ ಸೇವಾ ಪೋರ್ಟಲ್ ಅಥವಾ ನಿಮ್ಮ BLO',
  hi: 'मतदाता सेवा पोर्टल या आपके BLO',
  ur: 'ووٹرز سروس پورٹل یا آپ کا BLO',
};

export const seedBundle: ContentBundle = {
  version: '2026.10.0-seed',
  documents: [
    {
      id: 'aadhaar',
      kind: 'aadhaar',
      label: { en: 'Aadhaar', kn: 'ಆಧಾರ್', hi: 'आधार', ur: 'آدھار' },
      authority: { en: 'UIDAI', kn: 'UIDAI', hi: 'UIDAI', ur: 'UIDAI' },
      fieldsPrinted: ['name', 'dob', 'gender', 'address'],
      meta: meta(AADHAAR_OWNER),
    },
    {
      id: 'pan',
      kind: 'pan',
      label: { en: 'PAN', kn: 'ಪ್ಯಾನ್', hi: 'पैन', ur: 'پین' },
      authority: {
        en: 'Income Tax Department',
        kn: 'ಆದಾಯ ತೆರಿಗೆ ಇಲಾಖೆ',
        hi: 'आयकर विभाग',
        ur: 'محکمہ انکم ٹیکس',
      },
      fieldsPrinted: ['name', 'dob'],
      meta: meta(PAN_OWNER),
    },
    {
      id: 'voter-id',
      kind: 'voter_id',
      label: {
        en: 'Voter ID (EPIC)',
        kn: 'ಮತದಾರರ ಗುರುತಿನ ಚೀಟಿ (EPIC)',
        hi: 'मतदाता पहचान पत्र (EPIC)',
        ur: 'ووٹر آئی ڈی (EPIC)',
      },
      authority: {
        en: 'Election Commission of India',
        kn: 'ಭಾರತ ಚುನಾವಣಾ ಆಯೋಗ',
        hi: 'भारत निर्वाचन आयोग',
        ur: 'الیکشن کمیشن آف انڈیا',
      },
      fieldsPrinted: ['name', 'dob', 'gender', 'address'],
      meta: meta(VOTER_OWNER),
    },
  ],
  links: [
    {
      id: 'myaadhaar',
      url: 'https://myaadhaar.uidai.gov.in/',
      label: { en: 'myAadhaar portal', kn: 'myAadhaar ಪೋರ್ಟಲ್', hi: 'myAadhaar पोर्टल', ur: 'myAadhaar پورٹل' },
      authority: 'UIDAI',
      meta: meta(AADHAAR_OWNER),
    },
    {
      id: 'uidai',
      url: 'https://uidai.gov.in/',
      label: {
        en: 'UIDAI website — Aadhaar centres',
        kn: 'UIDAI ವೆಬ್‌ಸೈಟ್ — ಆಧಾರ್ ಕೇಂದ್ರಗಳು',
        hi: 'UIDAI वेबसाइट — आधार केंद्र',
        ur: 'UIDAI ویب سائٹ — آدھار مراکز',
      },
      authority: 'UIDAI',
      meta: meta(AADHAAR_OWNER),
    },
    {
      id: 'protean',
      url: 'https://www.protean-tinpan.com/',
      label: { en: 'Protean — PAN services', kn: 'Protean — ಪ್ಯಾನ್ ಸೇವೆಗಳು', hi: 'Protean — पैन सेवाएँ', ur: 'Protean — پین خدمات' },
      authority: 'Income Tax Department (authorised agency)',
      meta: meta(PAN_OWNER),
    },
    {
      id: 'utiitsl',
      url: 'https://www.pan.utiitsl.com/',
      label: { en: 'UTIITSL — PAN services', kn: 'UTIITSL — ಪ್ಯಾನ್ ಸೇವೆಗಳು', hi: 'UTIITSL — पैन सेवाएँ', ur: 'UTIITSL — پین خدمات' },
      authority: 'Income Tax Department (authorised agency)',
      meta: meta(PAN_OWNER),
    },
    {
      id: 'voters-service-portal',
      url: 'https://voters.eci.gov.in/',
      label: {
        en: "Voters' Service Portal",
        kn: 'ಮತದಾರರ ಸೇವಾ ಪೋರ್ಟಲ್',
        hi: 'मतदाता सेवा पोर्टल',
        ur: 'ووٹرز سروس پورٹل',
      },
      authority: 'Election Commission of India',
      meta: meta(VOTER_OWNER),
    },
  ],
  actions: [
    {
      id: 'aadhaar-link-mobile',
      document: 'aadhaar',
      fields: ['mobile_link'],
      priority: 10,
      title: {
        en: 'Link your mobile number to Aadhaar',
        kn: 'ನಿಮ್ಮ ಮೊಬೈಲ್ ಸಂಖ್ಯೆಯನ್ನು ಆಧಾರ್‌ಗೆ ಲಿಂಕ್ ಮಾಡಿ',
        hi: 'अपना मोबाइल नंबर आधार से लिंक करें',
        ur: 'اپنا موبائل نمبر آدھار سے لنک کریں',
      },
      summary: {
        en: 'Most online services send an OTP to this number. Visit an Aadhaar centre with your Aadhaar card.',
        kn: 'ಹೆಚ್ಚಿನ ಆನ್‌ಲೈನ್ ಸೇವೆಗಳು ಈ ಸಂಖ್ಯೆಗೆ OTP ಕಳುಹಿಸುತ್ತವೆ. ನಿಮ್ಮ ಆಧಾರ್ ಕಾರ್ಡ್‌ನೊಂದಿಗೆ ಆಧಾರ್ ಕೇಂದ್ರಕ್ಕೆ ಭೇಟಿ ನೀಡಿ.',
        hi: 'ज़्यादातर ऑनलाइन सेवाएँ इसी नंबर पर OTP भेजती हैं। अपना आधार कार्ड लेकर आधार केंद्र जाएँ।',
        ur: 'زیادہ تر آن لائن خدمات اسی نمبر پر OTP بھیجتی ہیں۔ اپنا آدھار کارڈ لے کر آدھار مرکز جائیں۔',
      },
      where: {
        en: 'Aadhaar enrolment and update centre',
        kn: 'ಆಧಾರ್ ನೋಂದಣಿ ಮತ್ತು ನವೀಕರಣ ಕೇಂದ್ರ',
        hi: 'आधार नामांकन और अपडेट केंद्र',
        ur: 'آدھار اندراج اور اپڈیٹ مرکز',
      },
      fees: [{ id: 'aadhaar-mobile-update-centre', label: CENTRE_75, amountInr: 75, meta: meta(AADHAAR_OWNER) }],
      links: ['uidai'],
      meta: meta(AADHAAR_OWNER),
    },
    {
      id: 'aadhaar-demographic-update',
      document: 'aadhaar',
      fields: ['name', 'dob', 'gender', 'address'],
      priority: 20,
      title: {
        en: 'Update your details on Aadhaar',
        kn: 'ಆಧಾರ್‌ನಲ್ಲಿ ನಿಮ್ಮ ವಿವರಗಳನ್ನು ನವೀಕರಿಸಿ',
        hi: 'आधार में अपने विवरण अपडेट करें',
        ur: 'آدھار میں اپنی تفصیلات اپڈیٹ کریں',
      },
      summary: {
        en: 'Take proof of the correct detail — for date of birth, a birth certificate or SSLC marks card. An address can also be updated online on myAadhaar.',
        kn: 'ಸರಿಯಾದ ವಿವರದ ಪುರಾವೆಯನ್ನು ತೆಗೆದುಕೊಂಡು ಹೋಗಿ — ಜನ್ಮ ದಿನಾಂಕಕ್ಕೆ ಜನನ ಪ್ರಮಾಣಪತ್ರ ಅಥವಾ SSLC ಅಂಕಪಟ್ಟಿ. ವಿಳಾಸವನ್ನು myAadhaar ನಲ್ಲಿ ಆನ್‌ಲೈನ್‌ನಲ್ಲೂ ನವೀಕರಿಸಬಹುದು.',
        hi: 'सही विवरण का प्रमाण साथ ले जाएँ — जन्मतिथि के लिए जन्म प्रमाणपत्र या SSLC अंकपत्र। पता myAadhaar पर ऑनलाइन भी अपडेट किया जा सकता है।',
        ur: 'درست تفصیل کا ثبوت ساتھ لے جائیں — تاریخ پیدائش کے لیے پیدائش کا سرٹیفکیٹ یا SSLC مارکس کارڈ۔ پتہ myAadhaar پر آن لائن بھی اپڈیٹ کیا جا سکتا ہے۔',
      },
      where: {
        en: 'Aadhaar centre, or myAadhaar for address',
        kn: 'ಆಧಾರ್ ಕೇಂದ್ರ, ಅಥವಾ ವಿಳಾಸಕ್ಕೆ myAadhaar',
        hi: 'आधार केंद्र, या पते के लिए myAadhaar',
        ur: 'آدھار مرکز، یا پتے کے لیے myAadhaar',
      },
      fees: [{ id: 'aadhaar-demographic-update-centre', label: CENTRE_75, amountInr: 75, meta: meta(AADHAAR_OWNER) }],
      links: ['uidai', 'myaadhaar'],
      meta: meta(AADHAAR_OWNER),
    },
    {
      id: 'aadhaar-document-update',
      document: 'aadhaar',
      fields: ['documents'],
      priority: 25,
      title: {
        en: 'Refresh your Aadhaar documents (10-year update)',
        kn: 'ನಿಮ್ಮ ಆಧಾರ್ ದಾಖಲೆಗಳನ್ನು ನವೀಕರಿಸಿ (10 ವರ್ಷದ ನವೀಕರಣ)',
        hi: 'अपने आधार दस्तावेज़ अपडेट करें (10 साल वाला अपडेट)',
        ur: 'اپنے آدھار دستاویزات اپڈیٹ کریں (10 سالہ اپڈیٹ)',
      },
      summary: {
        en: 'Upload current proof of identity and address on myAadhaar.',
        kn: 'myAadhaar ನಲ್ಲಿ ಪ್ರಸ್ತುತ ಗುರುತಿನ ಮತ್ತು ವಿಳಾಸದ ಪುರಾವೆಯನ್ನು ಅಪ್‌ಲೋಡ್ ಮಾಡಿ.',
        hi: 'myAadhaar पर पहचान और पते का मौजूदा प्रमाण अपलोड करें।',
        ur: 'myAadhaar پر شناخت اور پتے کا موجودہ ثبوت اپلوڈ کریں۔',
      },
      where: { en: 'myAadhaar portal', kn: 'myAadhaar ಪೋರ್ಟಲ್', hi: 'myAadhaar पोर्टल', ur: 'myAadhaar پورٹل' },
      fees: [
        {
          id: 'aadhaar-document-update-online-free',
          label: {
            en: 'Free online until 14-06-2027',
            kn: '14-06-2027 ರವರೆಗೆ ಆನ್‌ಲೈನ್‌ನಲ್ಲಿ ಉಚಿತ',
            hi: '14-06-2027 तक ऑनलाइन मुफ़्त',
            ur: '14-06-2027 تک آن لائن مفت',
          },
          amountInr: 0,
          meta: meta(AADHAAR_OWNER, { effectiveTo: '2027-06-14' }),
        },
      ],
      links: ['myaadhaar'],
      meta: meta(AADHAAR_OWNER),
    },
    {
      id: 'pan-correction',
      document: 'pan',
      fields: ['name', 'dob'],
      priority: 30,
      title: {
        en: 'Correct your PAN to match Aadhaar',
        kn: 'ಆಧಾರ್‌ಗೆ ಹೊಂದುವಂತೆ ನಿಮ್ಮ ಪ್ಯಾನ್ ಅನ್ನು ಸರಿಪಡಿಸಿ',
        hi: 'अपना पैन आधार के अनुसार सुधारें',
        ur: 'اپنا پین آدھار کے مطابق درست کریں',
      },
      summary: {
        en: 'Apply with Form PAN CR-01 through Protean or UTIITSL, with proof of the correct detail (after marriage: marriage certificate).',
        kn: 'ಸರಿಯಾದ ವಿವರದ ಪುರಾವೆಯೊಂದಿಗೆ (ಮದುವೆಯ ನಂತರ: ವಿವಾಹ ಪ್ರಮಾಣಪತ್ರ) Protean ಅಥವಾ UTIITSL ಮೂಲಕ ಫಾರ್ಮ್ PAN CR-01 ನೊಂದಿಗೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ.',
        hi: 'सही विवरण के प्रमाण (शादी के बाद: विवाह प्रमाणपत्र) के साथ Protean या UTIITSL के ज़रिए फ़ॉर्म PAN CR-01 से आवेदन करें।',
        ur: 'درست تفصیل کے ثبوت (شادی کے بعد: شادی کا سرٹیفکیٹ) کے ساتھ Protean یا UTIITSL کے ذریعے فارم PAN CR-01 سے درخواست دیں۔',
      },
      form: 'PAN CR-01',
      where: {
        en: 'Protean or UTIITSL — online or at a PAN centre',
        kn: 'Protean ಅಥವಾ UTIITSL — ಆನ್‌ಲೈನ್ ಅಥವಾ ಪ್ಯಾನ್ ಕೇಂದ್ರದಲ್ಲಿ',
        hi: 'Protean या UTIITSL — ऑनलाइन या पैन केंद्र पर',
        ur: 'Protean یا UTIITSL — آن لائن یا پین مرکز پر',
      },
      fees: [
        {
          id: 'pan-cr-01-physical-card',
          label: {
            en: 'About ₹101–107 with a physical card; less for e-PAN only',
            kn: 'ಭೌತಿಕ ಕಾರ್ಡ್‌ನೊಂದಿಗೆ ಸುಮಾರು ₹101–107; ಇ-ಪ್ಯಾನ್ ಮಾತ್ರಕ್ಕೆ ಕಡಿಮೆ',
            hi: 'फ़िज़िकल कार्ड के साथ लगभग ₹101–107; सिर्फ़ ई-पैन के लिए कम',
            ur: 'فزیکل کارڈ کے ساتھ تقریباً ₹101–107؛ صرف ای-پین کے لیے کم',
          },
          meta: meta(PAN_OWNER, { effectiveFrom: '2026-04-01' }),
        },
      ],
      links: ['protean', 'utiitsl'],
      meta: meta(PAN_OWNER),
    },
    {
      id: 'voter-correction',
      document: 'voter_id',
      fields: ['name', 'dob', 'gender'],
      priority: 40,
      title: {
        en: 'Correct your Voter ID details',
        kn: 'ನಿಮ್ಮ ಮತದಾರರ ಗುರುತಿನ ಚೀಟಿಯ ವಿವರಗಳನ್ನು ಸರಿಪಡಿಸಿ',
        hi: 'अपने मतदाता पहचान पत्र के विवरण सुधारें',
        ur: 'اپنے ووٹر آئی ڈی کی تفصیلات درست کریں',
      },
      summary: {
        en: "Apply with Form 8 (correction of entries) on the Voters' Service Portal or through your Booth Level Officer (BLO).",
        kn: 'ಮತದಾರರ ಸೇವಾ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಅಥವಾ ನಿಮ್ಮ ಬೂತ್ ಮಟ್ಟದ ಅಧಿಕಾರಿ (BLO) ಮೂಲಕ ಫಾರ್ಮ್ 8 (ವಿವರಗಳ ತಿದ್ದುಪಡಿ) ನೊಂದಿಗೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ.',
        hi: 'मतदाता सेवा पोर्टल पर या अपने बूथ लेवल अधिकारी (BLO) के ज़रिए फ़ॉर्म 8 (प्रविष्टियों में सुधार) से आवेदन करें।',
        ur: 'ووٹرز سروس پورٹل پر یا اپنے بوتھ لیول آفیسر (BLO) کے ذریعے فارم 8 (اندراجات کی درستی) سے درخواست دیں۔',
      },
      form: 'Form 8',
      where: VOTER_WHERE,
      fees: [{ id: 'voter-form-8-correction-free', label: FREE, amountInr: 0, meta: meta(VOTER_OWNER) }],
      links: ['voters-service-portal'],
      meta: meta(VOTER_OWNER),
    },
    {
      id: 'voter-shifting',
      document: 'voter_id',
      fields: ['address'],
      priority: 41,
      title: {
        en: 'Update the address on your Voter ID',
        kn: 'ನಿಮ್ಮ ಮತದಾರರ ಗುರುತಿನ ಚೀಟಿಯಲ್ಲಿ ವಿಳಾಸವನ್ನು ನವೀಕರಿಸಿ',
        hi: 'अपने मतदाता पहचान पत्र पर पता अपडेट करें',
        ur: 'اپنے ووٹر آئی ڈی پر پتہ اپڈیٹ کریں',
      },
      summary: {
        en: "Apply with Form 8 (shifting of residence) on the Voters' Service Portal or through your BLO. If your Aadhaar address is also old, update Aadhaar first.",
        kn: 'ಮತದಾರರ ಸೇವಾ ಪೋರ್ಟಲ್‌ನಲ್ಲಿ ಅಥವಾ ನಿಮ್ಮ BLO ಮೂಲಕ ಫಾರ್ಮ್ 8 (ವಾಸಸ್ಥಳ ಬದಲಾವಣೆ) ನೊಂದಿಗೆ ಅರ್ಜಿ ಸಲ್ಲಿಸಿ. ನಿಮ್ಮ ಆಧಾರ್ ವಿಳಾಸವೂ ಹಳೆಯದಾಗಿದ್ದರೆ, ಮೊದಲು ಆಧಾರ್ ನವೀಕರಿಸಿ.',
        hi: 'मतदाता सेवा पोर्टल पर या अपने BLO के ज़रिए फ़ॉर्म 8 (निवास स्थानांतरण) से आवेदन करें। अगर आधार पर भी पुराना पता है, तो पहले आधार अपडेट करें।',
        ur: 'ووٹرز سروس پورٹل پر یا اپنے BLO کے ذریعے فارم 8 (رہائش کی منتقلی) سے درخواست دیں۔ اگر آدھار پر بھی پرانا پتہ ہے تو پہلے آدھار اپڈیٹ کریں۔',
      },
      form: 'Form 8',
      where: VOTER_WHERE,
      fees: [{ id: 'voter-form-8-shifting-free', label: FREE, amountInr: 0, meta: meta(VOTER_OWNER) }],
      links: ['voters-service-portal'],
      meta: meta(VOTER_OWNER),
    },
  ],
  nameVariants: {
    meta: {
      owner: 'Content lead — D04 journeys',
      source: 'Seed list; extend from the Phase 0 help-desk sample (Q-03)',
      version: 1,
      lastVerified: null,
      status: 'in_review',
    },
    groups: [
      {
        canonical: 'mohammed',
        variants: ['mohammed', 'mohammad', 'muhammad', 'muhammed', 'mohamed', 'mohamad', 'mohammod'],
        abbreviations: ['mohd', 'md', 'muhd'],
      },
      { canonical: 'ahmed', variants: ['ahmed', 'ahmad', 'ahamed', 'ahmmed'], abbreviations: [] },
      { canonical: 'shaikh', variants: ['shaikh', 'sheikh', 'shaik', 'shekh', 'sheik'], abbreviations: ['sk'] },
      { canonical: 'syed', variants: ['syed', 'sayed', 'sayyed', 'sayyid', 'saiyed'], abbreviations: [] },
      { canonical: 'fatima', variants: ['fatima', 'fathima', 'fatema', 'fatma'], abbreviations: [] },
      { canonical: 'ayesha', variants: ['ayesha', 'aisha', 'ayisha', 'aysha', 'ayesa'], abbreviations: [] },
      { canonical: 'yusuf', variants: ['yusuf', 'yousuf', 'yusuff', 'yousaf', 'yusaf'], abbreviations: [] },
      { canonical: 'abdul', variants: ['abdul', 'abdool'], abbreviations: ['abd'] },
      { canonical: 'kumar', variants: ['kumar'], abbreviations: ['kr'] },
      { canonical: 'rahim', variants: ['rahim', 'raheem', 'rahem'], abbreviations: [] },
      { canonical: 'ibrahim', variants: ['ibrahim', 'ebrahim', 'ibraheem'], abbreviations: [] },
    ],
  },
};
