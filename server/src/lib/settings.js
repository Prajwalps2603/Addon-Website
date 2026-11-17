import * as z from 'zod';
import { toIso } from '../db/index.js';
import { badRequest } from './errors.js';
import { isValidGstin } from './india.js';
import { emailSchema, parse, pincodeSchema, stateSchema } from './validate.js';

function deepFreeze(value) {
  if (value !== null && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

// Reels on the store's Instagram (docs/COMPANY.md). There are no per-reel links or video files yet,
// so each points at the reels page until the owner adds them in Admin, Settings.
const REELS_PAGE = 'https://www.instagram.com/addonautomotive/reels/';
const reel = (n, title, car, kind) => ({ id: `reel-${String(n).padStart(2, '0')}`, title, car, kind, url: REELS_PAGE, video: '', poster: '' });

/**
 * What a new store starts with. The name, tagline, phones, WhatsApp, Instagram, hours, fitting
 * services and studio rules are Addon's own (docs/COMPANY.md). Email, address, GSTIN and the
 * grievance officer are not known yet and stay blank: the storefront hides anything blank, and
 * the owner fills them in Admin, Settings.
 * Only what the owner changes is stored (one JSON row per top-level key in the settings table),
 * so a default edited here still reaches stores that never touched that key, and a value already
 * saved in a database always wins over the default.
 */
export const DEFAULT_SETTINGS = deepFreeze({
  storeName: 'Addon Automotive',
  legalName: '',
  tagline: 'Upgrade your ride. Elevate your style.',
  phone: '+91 89211 68071',
  // Further numbers shown beside `phone`.
  phones: ['+91 80752 43040'],
  whatsapp: '918921168071',
  email: '',
  address: { line1: '', line2: '', city: '', state: '', pincode: '' },
  gstin: '',
  businessHours: 'Monday to Saturday 9:30 am to 8 pm; Sunday 10 am to 2 pm',
  grievanceOfficer: { name: '', designation: '', email: '', phone: '' },
  social: { instagram: 'https://www.instagram.com/addonautomotive', facebook: '', youtube: '' },
  studio: {
    enabled: true,
    address: '',
    mapUrl: '',
    slots: ['10:00', '11:30', '13:00', '14:30', '16:00', '17:30'],
    carsPerSlot: 2,
    // Sunday is a half day: no slot starts after this time. '' = Sundays run the full list.
    sundayLastSlot: '13:00',
    // 0 = Sunday ... 6 = Saturday.
    closedWeekdays: [],
    minNoticeMinutes: 60,
    maxDaysAhead: 60,
  },
  // Fitting services from the earlier site (the owner's sample prices). subcategorySlugs ties a
  // catalogue subcategory to the service that fits it, so a part knows its fitting charge.
  services: [
    {
      id: 'stereo-install',
      name: 'Android stereo installation',
      charge: 799,
      minutes: 90,
      blurb: 'Your Android stereo fitted and wired at our studio.',
      subcategorySlugs: ['head-units'],
    },
    {
      id: 'speaker-install',
      name: 'Speaker and woofer fitting',
      charge: 599,
      minutes: 60,
      blurb: 'Speakers, subwoofers and amplifiers fitted and wired at our studio.',
      subcategorySlugs: ['speakers', 'subwoofers-amps'],
    },
    {
      id: 'lighting',
      name: 'LED, fog and headlamp fitting',
      charge: 499,
      minutes: 60,
      blurb: 'LED bulbs, fog lamps, DRLs, headlights and tail lamps fitted at our studio.',
      subcategorySlugs: ['headlights', 'tail-lights', 'led-bulbs', 'fog-projectors', 'drls', 'aux-lights'],
    },
    {
      id: 'body-kit',
      name: 'Spoiler, skirts and body kit fitting',
      charge: 999,
      minutes: 120,
      blurb: 'Spoilers, side skirts, splitters and diffusers fitted at our studio.',
      subcategorySlugs: ['spoilers-wings', 'body-kits', 'front-splitters', 'rear-diffusers'],
    },
    {
      id: 'seat-cover',
      name: 'Seat cover fitting',
      charge: 399,
      minutes: 90,
      blurb: 'Seat covers fitted at our studio.',
      subcategorySlugs: ['seat-covers'],
    },
    {
      id: 'cool-film',
      name: 'Sun control film application',
      charge: 0,
      minutes: 120,
      blurb: 'Sun control film applied at our studio. Application is included with the film.',
      subcategorySlugs: [],
    },
    {
      id: 'wheels',
      name: 'Alloy wheel fitting and balancing',
      charge: 699,
      minutes: 60,
      blurb: 'Alloy wheels fitted and balanced at our studio.',
      subcategorySlugs: ['alloy-wheels'],
    },
    {
      id: 'consult',
      name: 'Free upgrade consultation',
      charge: 0,
      minutes: 30,
      blurb: 'Bring your car in and plan your upgrades with our team.',
      subcategorySlugs: [],
    },
  ],
  emi: {
    enabled: true,
    partner: 'Bajaj Finserv',
    minAmount: 3000,
    note: 'EMI is available through Bajaj Finserv. Ask us for the plans on your order.',
  },
  studioWork: [
    reel(1, 'Customised Fronx', 'Maruti Fronx', 'Full build'),
    reel(2, 'Fully customised Fronx', 'Maruti Fronx', 'Full build'),
    reel(3, 'Base model to automatic climate control', 'Hyundai Creta', 'Electronics'),
    reel(4, 'Side footsteps', 'Mahindra XUV700', 'Exterior'),
    reel(5, 'Rear diffuser', 'Maruti Baleno', 'Body kit'),
    reel(6, 'Tri-colour projector fog lamps', 'Maruti Wagon R', 'Lighting'),
    reel(7, 'Tri-colour projector fog lamps', 'Maruti Zen Estilo', 'Lighting'),
    reel(8, 'Diamond P80 + Black Rock subwoofer', 'Honda City', 'Audio'),
    reel(9, 'Global 50 sun control film', 'Toyota Fortuner', 'Films'),
    reel(10, 'Global 50 films', 'Kia Sonet', 'Films'),
    reel(11, 'Oncord + 4K dash cam installed', 'BMW X5', 'Electronics'),
    reel(12, 'Vextron speakers, 30% offer', '', 'Audio'),
  ],
  announcements: [
    'Free delivery on orders above ₹999',
    'Cash on delivery for a flat ₹49, on orders up to ₹25,000',
    'Returns accepted within 7 days of delivery',
    'Pick your car and every part tells you whether it fits',
  ],
  promos: [
    {
      id: 'build-bay',
      eyebrow: 'Build Bay',
      title: 'Dress your car before you spend a rupee',
      subtitle: 'Try wheels, a spoiler and lights on a side view of your car and watch the total as you go.',
      ctaLabel: 'Open Build Bay',
      ctaHref: '/build-bay',
      image: '',
      tone: 'dark',
      startsAt: null,
      endsAt: null,
    },
    {
      id: 'new-car',
      eyebrow: 'New car planner',
      title: 'New car on the way',
      subtitle: 'Tell us the car and your budget. We list what is worth fitting first and what can wait.',
      ctaLabel: 'Plan my kit',
      ctaHref: '/new-car',
      image: '',
      tone: 'yellow',
      startsAt: null,
      endsAt: null,
    },
    {
      id: 'friday-five',
      eyebrow: 'The Friday Five',
      title: 'A short price drop on five parts',
      subtitle: 'Up to five parts at a lower price for a few days, each with the reason we picked it.',
      ctaLabel: 'See the five',
      ctaHref: '/friday-five',
      image: '',
      tone: 'light',
      startsAt: null,
      endsAt: null,
    },
  ],
  shipping: {
    freeShippingThreshold: 999,
    flatFee: 79,
    bulkySurcharge: 199,
    freightSurcharge: 499,
    originPincode: '',
    dispatchDays: 1,
  },
  cod: { enabled: true, fee: 49, minOrder: 0, maxOrder: 25000, advancePercent: 0 },
  prepaidDiscountPercent: 2,
  payments: { upiId: '', upiPayeeName: '' },
  returns: {
    windowDays: 7,
    summary:
      'Send back any unused part in its original packing within the return window and we refund what you paid for it. Made-to-order items such as show plates are taken back only if they arrive damaged or different from what you ordered.',
  },
  fitPromise: {
    enabled: true,
    summary:
      'When we mark a part as a verified fit for your car and it does not fit, we take it back and pay the return shipping. You then choose a full refund or the part that does fit.',
  },
  notifications: { orderEmail: '' },
  invoice: { prefix: 'ADN', footerNote: '' },
  searchSynonyms: [
    { says: 'dikki', means: 'boot' },
    { says: 'dicky', means: 'boot' },
    { says: 'diggi', means: 'boot' },
    { says: 'stepney', means: 'spare wheel' },
    { says: 'silencer', means: 'exhaust' },
    { says: 'muffler', means: 'exhaust' },
    { says: 'free flow', means: 'exhaust' },
    { says: 'jali', means: 'grille' },
    { says: 'jaali', means: 'grille' },
    { says: 'monogram', means: 'emblem' },
    { says: 'sticker', means: 'decal' },
    { says: 'bass tube', means: 'subwoofer' },
    { says: 'woofer', means: 'subwoofer' },
    { says: 'music system', means: 'head unit' },
    { says: 'stereo', means: 'head unit' },
    { says: 'android player', means: 'head unit' },
    { says: 'tweeter', means: 'speaker' },
    { says: 'dumping sheet', means: 'damping sheet' },
    { says: 'matting', means: 'floor mat' },
    { says: 'foot mat', means: 'floor mat' },
    { says: 'body cover', means: 'car cover' },
    { says: 'gaadi cover', means: 'car cover' },
    { says: 'seat kavar', means: 'seat cover' },
    { says: 'steering kavar', means: 'steering cover' },
    { says: 'chabi cover', means: 'key cover' },
    { says: 'gear lever', means: 'gear knob' },
    { says: 'tyre pump', means: 'tyre inflator' },
    { says: 'air pump', means: 'tyre inflator' },
    { says: 'hawa machine', means: 'tyre inflator' },
    { says: 'puncture kit', means: 'tyre repair' },
    { says: 'mag wheel', means: 'alloy wheel' },
    { says: 'alloys', means: 'alloy wheel' },
    { says: 'wheel nut', means: 'lug nut' },
    { says: 'bumper guard', means: 'bull bar' },
    { says: 'front guard', means: 'bull bar' },
    { says: 'sump guard', means: 'skid plate' },
    { says: 'engine guard', means: 'skid plate' },
    { says: 'mud guard', means: 'mud flap' },
    { says: 'luggage carrier', means: 'roof rack' },
    { says: 'foot step', means: 'side step' },
    { says: 'paydan', means: 'side step' },
    { says: 'shocker', means: 'suspension' },
    { says: 'shock absorber', means: 'suspension' },
    { says: 'focus light', means: 'auxiliary light' },
    { says: 'fog light', means: 'fog lamp' },
    { says: 'back light', means: 'tail light' },
    { says: 'headlamp', means: 'headlight' },
    { says: 'white light', means: 'led bulb' },
    { says: 'batti', means: 'light' },
    { says: 'neon light', means: 'underglow' },
    { says: 'back camera', means: 'reverse camera' },
    { says: 'reverse sensor', means: 'parking sensor' },
    { says: 'dash camera', means: 'dash cam' },
    { says: 'mobile holder', means: 'phone mount' },
    { says: 'mobile stand', means: 'phone mount' },
    { says: 'perfume', means: 'fragrance' },
    { says: 'freshener', means: 'fragrance' },
    { says: 'sun curtain', means: 'sunshade' },
    { says: 'rain guard', means: 'visor' },
    { says: 'sheesha', means: 'mirror' },
    { says: 'hooter', means: 'horn' },
  ],
});

// The keys of PublicSettings that are stored as they are (promos, payments and hasDemoData are built per request).
const PUBLIC_KEYS = [
  'storeName',
  'legalName',
  'tagline',
  'phone',
  'phones',
  'whatsapp',
  'email',
  'address',
  'gstin',
  'businessHours',
  'grievanceOfficer',
  'social',
  'announcements',
  'shipping',
  'cod',
  'prepaidDiscountPercent',
  'returns',
  'fitPromise',
  'studio',
  'services',
  'emi',
  'studioWork',
  // The invoice page shows the footer note to customers too; the prefix is printed on every invoice.
  'invoice',
];

const line = (max) => z.string().trim().max(max);
const rupeeAmount = z.int().min(0).max(10_000_000);

// A field the owner may leave empty, or must fill in correctly.
function blankOr(schema, message) {
  return z.string().trim().transform((value, ctx) => {
    if (value === '') return '';
    const result = schema.safeParse(value);
    if (result.success) return result.data;
    ctx.issues.push({ code: 'custom', message, input: value });
    return z.NEVER;
  });
}

const optionalEmail = blankOr(emailSchema, 'Enter a valid email address, or leave it blank.');
const optionalPincode = blankOr(pincodeSchema, 'Enter a 6 digit PIN code, or leave it blank.');
const optionalLink = blankOr(z.httpUrl().max(300), 'Enter the full link starting with https://, or leave it blank.');
const displayPhone = line(30).regex(/^[0-9+\-() ]*$/, { error: 'Use digits, spaces and + - ( ) only.' });

const whatsappNumber = z.string().transform((value, ctx) => {
  const digits = value.replace(/\D/g, '').replace(/^0+/, '');
  if (digits === '') return '';
  if (/^[6-9]\d{9}$/.test(digits)) return `91${digits}`;
  if (/^[1-9]\d{10,14}$/.test(digits)) return digits;
  ctx.issues.push({
    code: 'custom',
    message: 'Enter the WhatsApp number with its country code, for example 919876543210.',
    input: value,
  });
  return z.NEVER;
});

const instant = z
  .preprocess(
    (value) => (value === '' || value === undefined ? null : value),
    z.iso.datetime({ offset: true, error: 'Enter a valid date and time.' }).nullable(),
  )
  .transform((value) => (value === null ? null : toIso(value)));

const promoSchema = z
  .object({
    id: line(60).default(''),
    eyebrow: line(40).default(''),
    title: line(80).min(1, { error: 'Give the banner a title.' }),
    subtitle: line(200).default(''),
    ctaLabel: line(40).default(''),
    ctaHref: line(200).regex(/^\/(?!\/)/, { error: 'Use a page on this site, starting with /' }),
    image: line(300)
      .regex(/^(|\/(?!\/).*|https:\/\/.+)$/, { error: 'Use an uploaded image, or leave it blank.' })
      .default(''),
    tone: z.enum(['yellow', 'dark', 'light']).default('dark'),
    startsAt: instant,
    endsAt: instant,
  })
  .refine((promo) => !promo.startsAt || !promo.endsAt || promo.endsAt > promo.startsAt, {
    path: ['endsAt'],
    error: 'The end must be after the start.',
  });

// Every promo needs an id the client can key on. Blank and repeated ids are replaced.
function withUniqueIds(promos) {
  const seen = new Set();
  return promos.map((promo, index) => {
    let id = promo.id;
    for (let n = 1; id === '' || seen.has(id); n += 1) id = `promo-${index + n}`;
    seen.add(id);
    return { ...promo, id };
  });
}

const clockTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, { error: 'Use a 24-hour time such as 10:00 or 17:30.' });
const mediaLink = line(300).regex(/^(|\/(?!\/)\S*|https:\/\/\S+)$/, { error: 'Use an uploaded file or a full https:// link, or leave it blank.' });

const studioSchema = z.object({
  enabled: z.boolean(),
  address: line(300),
  mapUrl: optionalLink,
  slots: z
    .array(clockTime)
    .min(1, { error: 'Add at least one slot time.' })
    .max(16)
    .transform((slots) => [...new Set(slots)].sort()),
  carsPerSlot: z.int().min(1).max(20),
  sundayLastSlot: z.union([z.literal(''), clockTime]),
  closedWeekdays: z
    .array(z.int().min(0).max(6))
    .max(6, { error: 'Keep the studio open on at least one day.' })
    .transform((days) => [...new Set(days)].sort()),
  minNoticeMinutes: z.int().min(0).max(7 * 24 * 60),
  maxDaysAhead: z.int().min(1).max(365),
});

const serviceSchema = z.object({
  id: line(40).regex(/^[a-z0-9][a-z0-9-]*$/, { error: 'Use lower-case letters, numbers and hyphens.' }),
  name: line(80).min(1, { error: 'Name the service.' }),
  charge: rupeeAmount,
  minutes: z.int().min(0).max(24 * 60),
  blurb: line(300),
  subcategorySlugs: z.array(line(80).min(1)).max(40),
});

const servicesSchema = z
  .array(serviceSchema)
  .max(40)
  .superRefine((services, ctx) => {
    const seen = new Set();
    services.forEach((service, index) => {
      if (seen.has(service.id)) ctx.addIssue({ code: 'custom', path: [index, 'id'], message: `Another service already uses the id "${service.id}".` });
      seen.add(service.id);
    });
  });

const emiSchema = z.object({ enabled: z.boolean(), partner: line(80), minAmount: rupeeAmount, note: line(300) });

const studioWorkSchema = z
  .array(
    z.object({
      id: line(60).default(''),
      title: line(120).min(1, { error: 'Give the job a title.' }),
      car: line(80).default(''),
      kind: line(40).default(''),
      url: optionalLink,
      video: mediaLink.default(''),
      poster: mediaLink.default(''),
    }),
  )
  .max(60)
  .transform((items) => {
    const seen = new Set();
    return items.map((item, index) => {
      let id = item.id;
      for (let n = 1; id === '' || seen.has(id); n += 1) id = `work-${index + n}`;
      seen.add(id);
      return { ...item, id };
    });
  });

const settingsSchema = z.object({
  storeName: line(80).min(1, { error: 'The store needs a name.' }),
  legalName: line(120),
  tagline: line(140),
  phone: displayPhone,
  phones: z.array(displayPhone.min(1)).max(4),
  whatsapp: whatsappNumber,
  email: optionalEmail,
  address: z.object({
    line1: line(120),
    line2: line(120),
    city: line(60),
    state: blankOr(stateSchema, 'Choose a State, or leave it blank.'),
    pincode: optionalPincode,
  }),
  gstin: z
    .string()
    .trim()
    .toUpperCase()
    .refine((value) => value === '' || isValidGstin(value), { error: 'Enter a valid 15 character GSTIN, or leave it blank.' }),
  businessHours: line(120),
  grievanceOfficer: z.object({ name: line(80), designation: line(80), email: optionalEmail, phone: displayPhone }),
  social: z.object({ instagram: optionalLink, facebook: optionalLink, youtube: optionalLink }),
  announcements: z.array(line(140).min(1)).max(8),
  promos: z.array(promoSchema).max(12).transform(withUniqueIds),
  shipping: z.object({
    freeShippingThreshold: rupeeAmount,
    flatFee: rupeeAmount,
    bulkySurcharge: rupeeAmount,
    freightSurcharge: rupeeAmount,
    originPincode: optionalPincode,
    dispatchDays: z.int().min(0).max(30),
  }),
  cod: z
    .object({
      enabled: z.boolean(),
      fee: rupeeAmount,
      minOrder: rupeeAmount,
      maxOrder: rupeeAmount,
      advancePercent: z.int().min(0).max(90),
    })
    .refine((cod) => cod.maxOrder === 0 || cod.maxOrder >= cod.minOrder, {
      path: ['maxOrder'],
      error: 'The upper limit must be above the lower limit. Use 0 for no upper limit.',
    }),
  prepaidDiscountPercent: z.number().min(0).max(50),
  payments: z.object({
    upiId: blankOr(
      z.string().regex(/^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z][a-zA-Z0-9.\-]{1,63}$/),
      'Enter a UPI ID such as shopname@okhdfcbank, or leave it blank.',
    ),
    upiPayeeName: line(80),
  }),
  returns: z.object({ windowDays: z.int().min(0).max(90), summary: line(600) }),
  fitPromise: z.object({ enabled: z.boolean(), summary: line(600) }),
  studio: studioSchema,
  services: servicesSchema,
  emi: emiSchema,
  studioWork: studioWorkSchema,
  notifications: z.object({ orderEmail: optionalEmail }),
  invoice: z.object({
    // Four characters at most keeps PREFIX/26-27/NNNNN inside the 16 characters GST allows.
    prefix: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,4}$/, { error: 'Use 1 to 4 letters or digits.' }),
    footerNote: line(300),
  }),
  searchSynonyms: z
    .array(z.object({ says: line(60).toLowerCase().min(1), means: line(80).toLowerCase().min(1) }))
    .max(500),
});

const isPlainObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);

// Objects merge key by key. Arrays and plain values are replaced whole.
function deepMerge(base, patch) {
  if (!isPlainObject(base) || !isPlainObject(patch)) return patch === undefined ? base : patch;
  const merged = { ...base };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined || key === '__proto__' || key === 'constructor') continue;
    merged[key] = deepMerge(base[key], value);
  }
  return merged;
}

function isLive(promo, now) {
  const starts = promo.startsAt ? Date.parse(promo.startsAt) : null;
  const ends = promo.endsAt ? Date.parse(promo.endsAt) : null;
  return (starts === null || starts <= now) && (ends === null || ends > now);
}

/** Builds ctx.settings. */
export function createSettings(ctx) {
  let cache = null;

  function load() {
    if (cache) return cache;
    const stored = {};
    for (const row of ctx.db.all('SELECT key, value FROM settings')) {
      if (!(row.key in DEFAULT_SETTINGS)) continue;
      try {
        stored[row.key] = JSON.parse(row.value);
      } catch {
        console.error(`[settings] Ignoring the stored value of "${row.key}": it is not valid JSON.`);
      }
    }
    const merged = deepMerge(DEFAULT_SETTINGS, stored);
    // Values read inside an open transaction may still be rolled back, so they are not remembered.
    if (!ctx.db.inTransaction) cache = merged;
    return merged;
  }

  // Razorpay keys live in the environment, never in the database, so these are worked out on every read.
  function paymentFlags(payments) {
    const { keyId, keySecret } = ctx.config.razorpay;
    const razorpay = Boolean(keyId && keySecret);
    return {
      razorpay,
      razorpayKeyId: razorpay ? keyId : '',
      upi: Boolean(payments.upiId),
      upiId: payments.upiId,
      upiPayeeName: payments.upiPayeeName,
    };
  }

  /**
   * Every setting, merged over the defaults: the stored keys plus payments.razorpay,
   * payments.razorpayKeyId and payments.upi. `promos` here is every promo, live or not.
   * Returns a fresh copy each time, so callers may change it freely.
   */
  function get() {
    const settings = structuredClone(load());
    settings.payments = paymentFlags(settings.payments);
    return settings;
  }

  /** PublicSettings: what GET /api/settings returns. Promos are filtered to those live at ctx.now(). */
  function publicSettings() {
    const settings = get();
    const now = Date.parse(ctx.now());
    const result = {};
    for (const key of PUBLIC_KEYS) result[key] = settings[key];
    result.promos = settings.promos.filter((promo) => isLive(promo, now));
    result.payments = settings.payments;
    result.hasDemoData = Boolean(ctx.db.get('SELECT EXISTS (SELECT 1 FROM products WHERE is_demo = 1) AS found').found);
    return result;
  }

  /** AdminSettings: the public settings plus the private ones and every promo. */
  function adminSettings() {
    const settings = get();
    return {
      ...publicSettings(),
      notifications: {
        orderEmail: settings.notifications.orderEmail,
        smtpConfigured: Boolean(ctx.config.smtp.host),
        razorpayConfigured: settings.payments.razorpay,
      },
      invoice: settings.invoice,
      searchSynonyms: settings.searchSynonyms,
      allPromos: settings.promos,
    };
  }

  /**
   * Applies a deep partial of AdminSettings: merged over the current values, validated as a
   * whole, then stored. Throws a 400 `validation_error` with `fields` when anything is wrong,
   * and stores nothing. Send the full promo list as `allPromos`. Read-only fields
   * (hasDemoData, payments.razorpay, notifications.smtpConfigured, ...) are ignored.
   * Returns the new settings, as get() does.
   */
  function update(partial) {
    if (!isPlainObject(partial)) throw badRequest('Send the settings to change as an object.');

    const patch = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (partial[key] !== undefined) patch[key] = partial[key];
    }
    if (partial.allPromos !== undefined) patch.promos = partial.allPromos;

    let next;
    try {
      next = parse(settingsSchema, deepMerge(load(), patch));
    } catch (err) {
      // Report promo problems under the name the caller used for the list.
      if (partial.allPromos !== undefined && err.fields) {
        err.fields = Object.fromEntries(
          Object.entries(err.fields).map(([key, message]) => [key.replace(/^promos(?=\.|$)/, 'allPromos'), message]),
        );
      }
      throw err;
    }
    const now = ctx.now();
    ctx.db.tx(() => {
      for (const key of Object.keys(patch)) {
        ctx.db.run(
          `INSERT INTO settings (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT (key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
          [key, JSON.stringify(next[key]), now],
        );
      }
    });
    cache = null;
    return get();
  }

  /** Forgets the cached settings. Only needed after writing to the settings table directly. */
  function invalidate() {
    cache = null;
  }

  return { get, public: publicSettings, admin: adminSettings, update, invalidate };
}
