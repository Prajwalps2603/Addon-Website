import { Router } from 'express';
import * as z from 'zod';
import { validationError } from '../../lib/validate.js';

// GET /settings, PUT /settings (mounted at /api/admin, admin only).
//
// The PUT body is a deep partial of AdminSettings. This module checks its shape first (no unknown
// keys, right types, the rules below), then hands it to ctx.settings.update, which merges it over the
// stored settings and validates the whole (pincodes, GSTIN, UPI id, lengths) before storing anything.
// Fields worked out from the environment or the database (Razorpay, SMTP, hasDemoData) are accepted,
// so the client can send back what it read, but they are never stored.

const text = z.string({ error: 'Enter text here.' });
const flag = z.boolean({ error: 'Choose yes or no.' });
const money = z.int({ error: 'Enter a whole number of rupees.' }).min(0, { error: 'Must be 0 or more.' });
const wholeNumber = z.int({ error: 'Enter a whole number.' }).min(0, { error: 'Must be 0 or more.' });
const percent = (whole) =>
  (whole ? z.int({ error: 'Enter a whole percent.' }) : z.number({ error: 'Enter a percent.' }))
    .min(0, { error: 'Use a percent from 0 to 100.' })
    .max(100, { error: 'Use a percent from 0 to 100.' });

const digitCount = (value) => value.replace(/\D/g, '').length;

// A phone number shown to customers: blank, or 10 to 13 digits written with spaces, + - ( ).
const phone = text.refine(
  (value) => value.trim() === '' || (/^[0-9+\-() ]+$/.test(value.trim()) && digitCount(value) >= 10 && digitCount(value) <= 13),
  { error: 'Enter a phone number with 10 to 13 digits, or leave it blank.' },
);

// WhatsApp: digits with the country code. Spaces, dashes and a leading + are tolerated and removed
// by the settings module, which also rejects a wrong length. Letters are refused here.
const whatsapp = text.refine((value) => /^\+?[0-9 \-]*$/.test(value.trim()), {
  error: 'Enter the WhatsApp number as digits with its country code, for example 919876543210.',
});

const instant = z.union([text, z.null()], { error: 'Enter a valid date and time, or leave it empty.' });

const promo = z.strictObject({
  id: text.optional(),
  eyebrow: text.optional(),
  title: text.optional(),
  subtitle: text.optional(),
  ctaLabel: text.optional(),
  ctaHref: text.optional(),
  image: text.optional(),
  // The brand moved from yellow to red; the settings module decides which tones it stores.
  tone: z.enum(['red', 'yellow', 'dark', 'light']).optional(),
  startsAt: instant.optional(),
  endsAt: instant.optional(),
});

const promoList = z.array(promo, { error: 'Send the banners as a list.' }).superRefine((promos, ctx) => {
  const seen = new Map();
  promos.forEach((item, index) => {
    const id = (item.id ?? '').trim();
    if (id === '') return;
    if (seen.has(id)) {
      ctx.addIssue({ code: 'custom', path: [index, 'id'], message: `Another banner already uses the id "${id}".` });
    } else {
      seen.set(id, index);
    }
  });
});

const studio = z.strictObject({
  enabled: flag.optional(),
  address: text.optional(),
  mapUrl: text.optional(),
  slots: z.array(text, { error: 'Send the slot times as a list.' }).optional(),
  carsPerSlot: wholeNumber.optional(),
  sundayLastSlot: text.optional(),
  closedWeekdays: z.array(wholeNumber, { error: 'Send the closed days as a list.' }).optional(),
  minNoticeMinutes: wholeNumber.optional(),
  maxDaysAhead: wholeNumber.optional(),
});

const service = z.strictObject({
  id: text.optional(),
  name: text.optional(),
  charge: money.optional(),
  minutes: wholeNumber.optional(),
  blurb: text.optional(),
  subcategorySlugs: z.array(text, { error: 'Send the subcategories as a list.' }).optional(),
});

const serviceList = z.array(service, { error: 'Send the services as a list.' }).superRefine((services, ctx) => {
  const seen = new Set();
  services.forEach((item, index) => {
    const id = (item.id ?? '').trim();
    if (id === '') return;
    if (seen.has(id)) ctx.addIssue({ code: 'custom', path: [index, 'id'], message: `Another service already uses the id "${id}".` });
    seen.add(id);
  });
});

const studioJob = z.strictObject({
  id: text.optional(),
  title: text.optional(),
  car: text.optional(),
  kind: text.optional(),
  url: text.optional(),
  video: text.optional(),
  poster: text.optional(),
});

const synonym = z.strictObject({
  says: text.refine((value) => value.trim() !== '', { error: 'Enter what shoppers type.' }),
  means: text.refine((value) => value.trim() !== '', { error: 'Enter what the catalogue calls it.' }),
});

export const settingsPatchSchema = z.strictObject(
  {
    storeName: text.optional(),
    legalName: text.optional(),
    tagline: text.optional(),
    phone: phone.optional(),
    phones: z.array(phone, { error: 'Send the other phone numbers as a list.' }).optional(),
    whatsapp: whatsapp.optional(),
    email: text.optional(),
    address: z
      .strictObject({
        line1: text.optional(),
        line2: text.optional(),
        city: text.optional(),
        state: text.optional(),
        pincode: text.optional(),
      })
      .optional(),
    gstin: text.optional(),
    businessHours: text.optional(),
    grievanceOfficer: z
      .strictObject({ name: text.optional(), designation: text.optional(), email: text.optional(), phone: phone.optional() })
      .optional(),
    social: z.strictObject({ instagram: text.optional(), facebook: text.optional(), youtube: text.optional() }).optional(),
    announcements: z.array(text, { error: 'Send the announcements as a list.' }).optional(),
    promos: promoList.optional(),
    allPromos: promoList.optional(),
    shipping: z
      .strictObject({
        freeShippingThreshold: money.optional(),
        flatFee: money.optional(),
        bulkySurcharge: money.optional(),
        freightSurcharge: money.optional(),
        originPincode: text.optional(),
        dispatchDays: wholeNumber.optional(),
      })
      .optional(),
    cod: z
      .strictObject({
        enabled: flag.optional(),
        fee: money.optional(),
        minOrder: money.optional(),
        maxOrder: money.optional(),
        advancePercent: percent(true).optional(),
      })
      .optional(),
    prepaidDiscountPercent: percent(false).optional(),
    payments: z
      .strictObject({
        upiId: text.optional(),
        upiPayeeName: text.optional(),
        // Read-only: worked out from the environment and upiId.
        razorpay: flag.optional(),
        razorpayKeyId: text.optional(),
        upi: flag.optional(),
      })
      .optional(),
    returns: z.strictObject({ windowDays: wholeNumber.optional(), summary: text.optional() }).optional(),
    fitPromise: z.strictObject({ enabled: flag.optional(), summary: text.optional() }).optional(),
    // The fitting studio: slot rules, the fitting services and their charges, EMI and recent work.
    studio: studio.optional(),
    services: serviceList.optional(),
    emi: z
      .strictObject({ enabled: flag.optional(), partner: text.optional(), minAmount: money.optional(), note: text.optional() })
      .optional(),
    studioWork: z.array(studioJob, { error: 'Send the studio work as a list.' }).optional(),
    notifications: z
      .strictObject({
        orderEmail: text.optional(),
        // Read-only: worked out from the environment.
        smtpConfigured: flag.optional(),
        razorpayConfigured: flag.optional(),
      })
      .optional(),
    invoice: z.strictObject({ prefix: text.optional(), footerNote: text.optional() }).optional(),
    searchSynonyms: z.array(synonym, { error: 'Send the search words as a list.' }).optional(),
    // Read-only: true while sample products remain.
    hasDemoData: flag.optional(),
  },
  { error: 'Send the settings to change as an object.' },
);

function plainMessage(issue) {
  if (issue.code === 'unrecognized_keys') return 'This setting does not exist.';
  if (issue.code === 'invalid_type') return 'This value is not valid.';
  if (issue.code === 'invalid_value') return 'Choose one of the listed options.';
  return undefined;
}

/** Checks the shape of a settings patch. Each unknown key is reported under its own dotted path. */
export function parseSettingsPatch(body) {
  const result = settingsPatchSchema.safeParse(body ?? {}, { error: plainMessage });
  if (!result.success) {
    const issues = result.error.issues.flatMap((issue) =>
      issue.code === 'unrecognized_keys'
        ? issue.keys.map((key) => ({ ...issue, path: [...issue.path, key], message: 'This setting does not exist.' }))
        : [issue],
    );
    throw validationError(issues);
  }

  const patch = result.data;
  delete patch.hasDemoData;
  if (patch.payments) {
    delete patch.payments.razorpay;
    delete patch.payments.razorpayKeyId;
    delete patch.payments.upi;
  }
  if (patch.notifications) {
    delete patch.notifications.smtpConfigured;
    delete patch.notifications.razorpayConfigured;
  }
  // AdminSettings.promos holds only the live banners: when the full list is sent, it is the one that counts.
  if (patch.allPromos !== undefined) delete patch.promos;
  return patch;
}

export default function adminSettingsRoutes(ctx) {
  const router = Router();

  router.get('/settings', (req, res) => {
    res.json(ctx.settings.admin());
  });

  router.put('/settings', (req, res) => {
    const patch = parseSettingsPatch(req.body);
    ctx.settings.update(patch);
    res.json(ctx.settings.admin());
  });

  return router;
}
