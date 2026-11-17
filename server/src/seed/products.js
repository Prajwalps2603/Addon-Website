// Turns the catalogue entries (140 researched, 6 added in data/additions.js) into full product rows, with their variants, fitments,
// photos and price history.
import { slugify, uniqueSlug } from '../lib/ids.js';
import { SUBCATEGORY_COPY } from './content/copy.js';
import { BUILDS, DROP, PICKS } from './content/extras.js';
import { FITTING } from './content/fitting.js';
import { PRODUCT_OVERRIDES, SUBCATEGORY_LABELS } from './content/labels.js';
import { ago, between, choiceList, hash, listOf } from './shared.js';
import { buildSpecs } from './specs.js';
import { buildVariants, hasVariantPlan } from './variants.js';

const SLUG_LIMIT = 80;
const MERCHANDISE = 'addon-merchandise';
const CAR_CARE = 'car-care-utility';

const HOUSE_LINE = /^Addon (Aero|Cabin|Lightworks|Trackday|Spoke|Signal|Trail|Shine|Ready|Crew)\b/;
// What is left reads as the part itself. 'Cabin Glow' is the lighting range, so it stays.
const BRAND_PREFIX = /^Addon (?:(?:Aero|Cabin(?! Glow)|Lightworks|Trackday|Spoke|Signal|Trail|Shine|Ready|Crew) )?/;

const BODY_TYPE_PLURALS = { hatchback: 'hatchbacks', sedan: 'sedans', suv: 'SUVs', muv: 'MUVs', pickup: 'pickups', coupe: 'coupes' };

// Placeholders for the owner to replace: the reorder list groups products by this label.
const SUPPLIERS = {
  'exterior-styling': 'Sample supplier A (body and off-road parts)',
  '4x4-overland': 'Sample supplier A (body and off-road parts)',
  'interior-comfort': 'Sample supplier B (cabin and car care)',
  'car-care-utility': 'Sample supplier B (cabin and car care)',
  lighting: 'Sample supplier C (lighting and electronics)',
  'audio-tech': 'Sample supplier C (lighting and electronics)',
  performance: 'Sample supplier D (wheels and performance)',
  'wheels-tyres': 'Sample supplier D (wheels and performance)',
  'addon-merchandise': 'Sample supplier E (merchandise)',
};

const STOCK_RANGE = { small: [15, 60], medium: [10, 45], bulky: [8, 30], freight: [8, 16] };
const OUT_OF_STOCK_PRODUCTS = 6;
const LOW_STOCK_PRODUCTS = 8;

// Packed weight in grams when the spec table states none: a typical figure for the subcategory,
// or for the one product that is nothing like its neighbours (a harness listed beside bucket seats).
// The ship class says how a parcel travels, not what it weighs: a grille is 'bulky' because it is long.
const TYPICAL_WEIGHT = {
  grilles: 2600,
  'emblems-decals': 250,
  'plate-frames': 450,
  'exterior-trim': 800,
  'sun-control-films': 900,
  'wheel-covers': 1800,
  'steering-wheels': 3200,
  'gear-knobs': 300,
  'floor-mats': 5500,
  'seat-covers': 6500,
  'ambient-lighting': 700,
  'gauges-displays': 600,
  'key-covers': 60,
  'sunshades-organisers': 1100,
  headlights: 7500,
  'tail-lights': 4200,
  'led-bulbs': 350,
  'fog-projectors': 1800,
  drls: 400,
  'aux-lights': 2200,
  'accent-underbody': 800,
  'air-intakes': 1200,
  exhaust: 1100,
  suspension: 22000,
  brakes: 3500,
  'tuning-hardware': 600,
  'racing-seats': 15000,
  'wheel-hardware': 1300,
  'wheel-styling': 500,
  'tyre-inflators': 1300,
  tpms: 300,
  'head-units': 2800,
  speakers: 2400,
  'subwoofers-amps': 4500,
  'sound-damping': 6500,
  'dash-cams': 500,
  'parking-safety': 600,
  horns: 800,
  'chargers-mounts': 200,
  snorkels: 4500,
  'light-bars': 3200,
  'recovery-gear': 6000,
  'jerry-cans-storage': 5200,
  'side-steps-flares': 16000,
  detailing: 1200,
  'fluids-additives': 400,
  'emergency-gear': 1700,
  'car-covers': 2400,
  fragrances: 120,
  'cleaning-tools': 1100,
  'hoodies-jackets': 650,
  'tees-caps': 250,
  'key-chains': 80,
  bags: 900,
  'garage-decor': 1400,
  'ADN-INT-002': 400,
  'ADN-INT-004': 350,
  'ADN-INT-010': 2500,
  'ADN-INT-013': 1500,
  'ADN-INT-018': 2800,
  'ADN-LGT-009': 80,
  'ADN-LGT-014': 300,
  'ADN-PRF-005': 9500,
  'ADN-PRF-006': 600,
  'ADN-PRF-008': 9000,
  'ADN-PRF-009': 2800,
  'ADN-PRF-010': 2000,
  'ADN-PRF-011': 13000,
  'ADN-PRF-015': 2200,
  'ADN-WHL-011': 500,
  'ADN-AUD-010': 18000,
  'ADN-AUD-015': 1500,
  'ADN-TRL-016': 7000,
  'ADN-CAR-003': 2800,
  'ADN-CAR-006': 2600,
  'ADN-MER-004': 150,
};
// For a subcategory the table above does not know.
const WEIGHT_RANGE = { small: [150, 900], medium: [1200, 6000], bulky: [3000, 14000], freight: [18000, 45000] };

// The catalogue gives install effort per subcategory. These parts are the easy half of a mixed
// subcategory (a steering cover listed beside a steering wheel swap, a strap beside a winch), so
// the subcategory figures would put "fitter advised, 2 hours" on a part that slips on by hand.
// They carry their own difficulty, time and, where the subcategory note is about the other half, note.
const INSTALL_CORRECTIONS = {
  'ADN-EXT-020': { difficulty: 1, proInstall: false, time: [0, 0], note: 'Nothing to fit. Hang it on a wall or stand it on a shelf.' },
  'ADN-INT-002': {
    difficulty: 2,
    proInstall: false,
    time: [20, 40],
    note: 'Stitched onto the rim with the needle and thread supplied. Patient work, but no tools and nothing comes off the car.',
  },
  'ADN-INT-004': {
    difficulty: 1,
    proInstall: false,
    time: [5, 10],
    note: 'Slips over the rim by hand. Leave it in the sun for ten minutes first and it stretches on more easily.',
  },
  'ADN-INT-013': { difficulty: 1, proInstall: false, time: [2, 5], note: 'Straps to the seat in a couple of minutes. No tools.' },
  'ADN-INT-015': { difficulty: 1, proInstall: false, time: [15, 30] },
  'ADN-INT-017': { difficulty: 1, proInstall: false, time: [10, 20] },
  'ADN-PRF-004': { difficulty: 1, proInstall: false, time: [15, 30] },
  'ADN-PRF-006': { difficulty: 1, proInstall: false, time: [15, 30] },
  'ADN-PRF-009': {
    difficulty: 2,
    proInstall: false,
    time: [20, 40],
    note: 'Bolts across the two strut top nuts under the bonnet. A spanner job, and no alignment is needed afterwards.',
  },
  'ADN-PRF-012': { difficulty: 1, proInstall: false, time: [15, 30] },
  'ADN-TRL-010': { difficulty: 1, proInstall: false, time: [0, 0] },
  'ADN-TRL-011': { difficulty: 1, proInstall: false, time: [0, 0] },
  'ADN-CAR-004': { difficulty: 1, proInstall: false, time: [5, 10], note: 'Nothing to fit. Pour it into the tank just before filling up.' },
};

// What the shop knows about the generation next to the one a part was made for. Each product's
// own cars get 'direct' rows from the catalogue; these add the 'with_work' and 'no' answers.
// car: [make slug, model slug, first year of the generation].
const NEIGHBOUR_FITMENTS = [
  {
    sku: 'ADN-INT-007',
    car: ['hyundai', 'creta', 2015],
    fitType: 'no',
    note: 'The 2015 to 2020 Creta has a different floor shape and hook positions. These mats are cut for the 2020 car onwards.',
  },
  {
    sku: 'ADN-EXT-013',
    car: ['maruti-suzuki', 'swift', 2024],
    fitType: 'no',
    note: 'The 2024 Swift has a new bumper and a different grille opening. This grille clips only into the 2018 to 2024 car.',
  },
  {
    sku: 'ADN-LGT-004',
    car: ['maruti-suzuki', 'swift', 2024],
    fitType: 'no',
    note: 'The 2024 Swift has a different tail lamp shape and connector.',
  },
  {
    sku: 'ADN-LGT-001',
    car: ['maruti-suzuki', 'swift', 2011],
    fitType: 'no',
    note: 'The 2011 to 2017 Swift has a different headlamp shape and mounting points.',
  },
  {
    sku: 'ADN-INT-011',
    car: ['maruti-suzuki', 'baleno', 2015],
    fitType: 'no',
    note: 'Seat shapes changed with the 2022 car. These covers will not sit flat on the earlier Baleno.',
  },
  {
    sku: 'ADN-EXT-021',
    car: ['bmw', '3-series', 2012],
    fitType: 'no',
    note: 'The F30 mirror housing is a different shape. These caps clip only onto the G20 mirror.',
  },
  {
    sku: 'ADN-TRL-016',
    car: ['mahindra', 'thar', 2010],
    fitType: 'no',
    note: 'The old Thar has different arch mounting points. These flares are for the 2020 car onwards.',
  },
  {
    sku: 'ADN-LGT-010',
    car: ['maruti-suzuki', 'dzire', 2017],
    fitType: 'with_work',
    note: 'Same fog lamp pocket as the Swift of those years. The Dzire bezel needs about 3 mm trimmed to clear the projector.',
  },
  {
    sku: 'ADN-AUD-002',
    car: ['hyundai', 'creta', 2015],
    fitType: 'with_work',
    note: 'The unit works, but the older dashboard needs its own fascia frame and harness, which are not in this box. Ask us before ordering.',
  },
  {
    sku: 'ADN-LGT-016',
    car: ['mahindra', 'thar', 2010],
    fitType: 'with_work',
    note: 'The pods and harness work, but the brackets are shaped for the 2020 windscreen hinge. A fabricator has to make brackets for the old Thar.',
  },
];

// ---------------------------------------------------------------------------
// Reading the title
// ---------------------------------------------------------------------------

function brandOf(product) {
  const line = product.title.match(HOUSE_LINE);
  if (line) return `Addon ${line[1]}`;
  return product.houseLine.includes(' and ') ? 'Addon' : product.houseLine;
}

const withoutBrackets = (text) => text.replace(/\s*\([^)]*\)/g, '');

// 'Addon Aero Side Skirt Extensions, Gloss Black (Pair) for Hyundai Creta (2020 onwards)' gives
//   head        'Addon Aero Side Skirt Extensions, Gloss Black (Pair)'
//   cars        'Hyundai Creta (2020 onwards)'   ('' when the title names no car or body type)
//   descriptor  'Side Skirt Extensions, Gloss Black'
//   notes       ['Pair']
function readTitle(product) {
  const namesCar = product.fitment.type === 'vehicle' || product.fitment.type === 'bodyType';
  const cut = namesCar ? product.title.lastIndexOf(' for ') : -1;
  const head = cut === -1 ? product.title : product.title.slice(0, cut);
  return {
    head,
    cars: cut === -1 ? '' : product.title.slice(cut + ' for '.length),
    descriptor: withoutBrackets(head).replace(BRAND_PREFIX, '').trim(),
    notes: [...head.matchAll(/\(([^)]+)\)/g)].map((match) => match[1]),
  };
}

// slugify() alone cuts at 80 characters wherever that falls, often in the middle of the car's name.
const slugOf = (text) => text.split(/\s+/).map(slugify).filter(Boolean).join('-');

// The whole title when it fits in 80 characters. When it does not, the slug keeps what a shopper
// searches for (the part and the car) and gives up detail in this order: finish and pack size,
// the years, the "with ..." clause, then the last cars of a long list.
function productSlug(ctx, product, title) {
  const name = withoutBrackets(title.head).split(', ')[0];
  const shortName = name.split(' with ')[0];
  const cars = withoutBrackets(title.cars);
  const forCars = (part, list) => (list ? `${part} for ${list}` : part);

  let slug = [product.title, forCars(name, title.cars), forCars(name, cars), forCars(shortName, cars)].map(slugOf).find((option) => option.length <= SLUG_LIMIT);
  if (!slug) {
    slug = slugOf(shortName);
    let list = `${slug}-for`;
    for (const car of cars.split(/,\s*|\s+and\s+/).map(slugOf).filter(Boolean)) {
      if (`${list}-${car}`.length > SLUG_LIMIT) break;
      list = `${list}-${car}`;
      slug = list;
    }
  }
  return uniqueSlug(ctx, 'products', slug);
}

// ---------------------------------------------------------------------------
// Fitting effort
// ---------------------------------------------------------------------------

function installOf(product, info) {
  const fix = INSTALL_CORRECTIONS[product.sku];
  const [timeMin, timeMax] = fix?.time ?? info.timeMinutes;
  return {
    difficulty: fix?.difficulty ?? product.installDifficulty,
    proInstall: fix?.proInstall ?? product.professionalAdvised,
    timeMin,
    timeMax,
    note: fix?.note ?? info.note,
  };
}

const span = (minutes) => (minutes < 120 ? `${minutes} min` : `${minutes / 60} hr`);

// '45 min to 90 min', '90 min to 2.5 hr', '4 to 8 hr', 'up to 5 min'.
function timeLabel({ timeMin, timeMax }) {
  if (timeMin === 0) return `up to ${span(timeMax)}`;
  if (timeMin >= 120) return `${timeMin / 60} to ${span(timeMax)}`;
  return `${span(timeMin)} to ${span(timeMax)}`;
}

function effortPhrase(product, install) {
  if (install.timeMax === 0) return 'no fitting needed';
  if (install.proInstall) return `a fitter's job of ${timeLabel(install)}`;
  if (install.timeMin === 0) return `${timeLabel(install)} to set up`;
  return `about ${timeLabel(install)} to ${product.subcategory === 'fluids-additives' ? 'use' : 'fit'}`;
}

// ---------------------------------------------------------------------------
// Copy
// ---------------------------------------------------------------------------

// A universal part that needs no real fitting (a shampoo, an inflator) works with any make or model.
// One that is fitted (a bulb, a gear knob) still has to match the car's socket or thread.
const worksWithAnyCar = (product, install) => install.timeMin === 0 || product.category === CAR_CARE;

function fitPhrase(product, { isShowPlate, install }) {
  switch (product.fitment.type) {
    case 'vehicle':
      return `made for the ${product.fitmentLabel}`;
    case 'bodyType':
      return `made for ${listOf(product.fitment.bodyTypes.map((bodyType) => BODY_TYPE_PLURALS[bodyType]))}`;
    case 'pcd':
      return `for cars with a ${product.fitment.pcd} bolt pattern`;
    default:
      if (isShowPlate) return 'a decorative plate for display only';
      return worksWithAnyCar(product, install) ? 'for any make or model' : 'a universal part, not tied to one model';
  }
}

function fitSentence(product, { isShowPlate, install, pcdExamples }) {
  switch (product.fitment.type) {
    case 'vehicle':
      return `It is made for the ${product.fitmentLabel}. Check the model year of your car before ordering: other generations differ.`;
    case 'bodyType':
      return `It is made for ${listOf(product.fitment.bodyTypes.map((bodyType) => BODY_TYPE_PLURALS[bodyType]))}, not for one particular model.`;
    case 'pcd': {
      const examples = pcdExamples.get(product.fitment.pcd) ?? [];
      const known = examples.length > 0 ? ` Cars we are sure of include the ${listOf(examples.slice(0, 3))}.` : '';
      return `It fits cars with a ${product.fitment.pcd} bolt pattern (PCD), as long as the offset and centre bore also suit.${known} Check your pattern before ordering.`;
    }
    case 'none':
      return 'It is merchandise, not a car part.';
    default:
      if (isShowPlate) return 'It is a display piece and is never fitted to a car.';
      return worksWithAnyCar(product, install)
        ? 'It works with any make or model.'
        : 'It is a universal part, not made for one model, so check its size and fixing against your car before ordering.';
  }
}

// One sentence for cards and search results: what it is, what it fits, how much work it is.
function shortDescription(product, title, context) {
  if (product.fitment.type === 'none') return `${title.descriptor}: ${context.brand} merchandise, not a car part.`;
  return `${title.descriptor}: ${fitPhrase(product, context)}, ${effortPhrase(product, context.install)}.`;
}

// What the brackets in a title say: a pack size, or what a kit is made up of.
function noteSentence(note) {
  if (/^pair$/i.test(note)) return 'Sold as a pair.';
  if (/^each$/i.test(note)) return 'Sold singly.';
  const pack = note.match(/^(set|pack) of (\d+)$/i);
  if (pack) return `Sold as a ${pack[1].toLowerCase()} of ${pack[2]}.`;
  if (/^display use$/i.test(note)) return 'It is for display use only.';
  return `It includes ${listOf(note.toLowerCase().split(', '))}.`;
}

function aboutThisPart(product, title, context, variantPlan) {
  const lines = [`This listing is for the ${title.descriptor}.`, ...title.notes.map(noteSentence), fitSentence(product, context)];
  if (variantPlan) lines.push(`Choose the ${variantPlan.name.toLowerCase()} before adding it to the cart: ${choiceList(variantPlan.values)}.`);
  return lines.join(' ');
}

function aboutFitting(product, install) {
  if (install.timeMax === 0) {
    if (product.category === MERCHANDISE) return `No fitting needed. ${FITTING[product.subcategory].steps[0].en}`;
    return /^(No fitting|Not applicable)\.$/.test(install.note) ? 'No fitting needed.' : install.note;
  }
  const rating = `We rate it ${install.difficulty} out of 5 for difficulty`;
  return `${install.note} Allow ${timeLabel(install)}. ${install.proInstall ? `${rating} and advise a fitter.` : `${rating}.`}`;
}

// ---------------------------------------------------------------------------
// Stock, weight, fitment columns
// ---------------------------------------------------------------------------

// A few parts are sold out and a few are down to the last ones, so every stock state shows.
// Parts the content leans on (the drop, the picks, the house builds, featured and new parts) stay in stock.
function shelfPlan(products, labelOf) {
  const kept = new Set([
    ...DROP.items.map((item) => item.sku),
    ...BUILDS.flatMap((build) => build.skus),
    ...Object.values(PICKS).flatMap((tiers) => Object.values(tiers).map((pick) => pick.sku)),
  ]);
  const candidates = products
    .filter((product) => {
      const label = labelOf(product);
      return !kept.has(product.sku) && !hasVariantPlan(product.sku) && !label.isFeatured && !label.isNew && !label.customKind;
    })
    .sort((a, b) => hash(`${a.sku}:shelf`) - hash(`${b.sku}:shelf`));

  const plan = new Map();
  candidates.slice(0, OUT_OF_STOCK_PRODUCTS).forEach((product) => plan.set(product.sku, 0));
  candidates
    .slice(OUT_OF_STOCK_PRODUCTS, OUT_OF_STOCK_PRODUCTS + LOW_STOCK_PRODUCTS)
    .forEach((product) => plan.set(product.sku, between(`${product.sku}:last-few`, 1, 4)));
  return plan;
}

const toNearest = (grams, unit) => Math.max(unit, Math.round(grams / unit) * unit);

// Shipping weight. The weight in the spec table plus packing where it states one; otherwise the
// typical weight of such a part, give or take 12 percent; failing that, a figure for the ship class.
function weightGrams(product, specs) {
  const row = specs.find((spec) => /^(Weight|Seat weight|Rack weight)$/.test(spec.label));
  const stated = row?.value.match(/^([\d.]+) (kg|g)\b(.*)$/);
  if (stated) {
    const each = Number(stated[1]) * (stated[2] === 'kg' ? 1000 : 1);
    const count = stated[3].includes('per wheel') ? 4 : stated[3].includes('each') ? 2 : 1;
    return toNearest(each * count * 1.15, 50);
  }
  const typical = TYPICAL_WEIGHT[product.sku] ?? TYPICAL_WEIGHT[product.subcategory];
  if (typical) return toNearest((typical * between(`${product.sku}:weight`, 88, 112)) / 100, typical < 500 ? 10 : 50);
  const [min, max] = WEIGHT_RANGE[product.shipClass];
  return toNearest(between(`${product.sku}:weight`, min, max), 50);
}

function fitmentColumns(product, isShowPlate) {
  switch (product.fitment.type) {
    case 'vehicle':
      return { fitment_type: 'vehicle', body_types: [], pcd: '' };
    case 'bodyType':
      return { fitment_type: 'body_type', body_types: product.fitment.bodyTypes, pcd: '' };
    case 'pcd':
      return { fitment_type: 'pcd', body_types: [], pcd: product.fitment.pcd };
    case 'none':
      return { fitment_type: 'none', body_types: [], pcd: '' };
    case 'universal':
      // A show plate hangs on a wall. Calling it a universal fit would suggest it goes on a car.
      return { fitment_type: isShowPlate ? 'none' : 'universal', body_types: [], pcd: '' };
    default:
      throw new Error(`${product.sku}: unknown fitment type "${product.fitment.type}"`);
  }
}

function fitmentRows(product, vehicles) {
  if (product.fitment.type !== 'vehicle') return [];
  const rows = [];
  for (const car of product.fitment.vehicles) {
    const generations = vehicles.overlapping(car.make, car.model, car.yearFrom, car.yearTo);
    if (generations.length === 0) throw new Error(`${product.sku}: no ${car.make}/${car.model} generation covers ${car.yearFrom} to ${car.yearTo ?? 'now'}`);
    for (const generation of generations) {
      rows.push({
        vehicleId: generation.id,
        fitType: 'direct',
        note: '',
        // About half are marked as test-fitted by the shop, which is what the Fit Promise needs.
        isVerified: hash(`${product.sku}:${car.make}/${car.model}/${generation.year_from}:verified`) % 2 === 0,
      });
    }
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Photos
// ---------------------------------------------------------------------------

const PHOTO_STOP_WORDS = new Set(['addon', 'for', 'with', 'and', 'the', 'from', 'set', 'pair', 'kit', 'onwards', 'car']);

function keywords(text) {
  const words = String(text ?? '').toLowerCase().split(/[^a-z0-9]+/);
  return new Set(
    words.filter((word) => word.length > 2 && !PHOTO_STOP_WORDS.has(word)).map((word) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word)),
  );
}

/**
 * Two or three photos for every product whose art kind has a pool: Map of SKU to URLs, main photo first.
 * The main photo is the one whose description shares the most telling words with the title (a word
 * that only one photo of the pool uses counts for more than one they all use), and inside a pool
 * no photo leads a second product until every photo has led one.
 */
export function assignPhotos(products, photos) {
  const assigned = new Map();
  const byKind = new Map();
  for (const product of products) byKind.set(product.artKind, [...(byKind.get(product.artKind) ?? []), product]);

  for (const [artKind, group] of byKind) {
    const pool = photos.catalog[artKind] ?? [];
    if (pool.length === 0) continue;

    const shown = pool.map((photo) => keywords(photo.shows));
    const frequency = new Map();
    for (const words of shown) for (const word of words) frequency.set(word, (frequency.get(word) ?? 0) + 1);
    const scores = group.map((product) => {
      const wanted = keywords(product.title);
      return shown.map((words) => [...wanted].reduce((score, word) => (words.has(word) ? score + 1 / frequency.get(word) : score), 0));
    });

    const pairs = group.flatMap((_, p) => pool.map((__, f) => ({ p, f, score: scores[p][f] })));
    pairs.sort((a, b) => b.score - a.score || a.p - b.p || a.f - b.f);
    const lead = group.map(() => -1);
    const leads = pool.map(() => 0);
    for (let round = 1; lead.includes(-1); round += 1) {
      for (const { p, f } of pairs) {
        if (lead[p] !== -1 || leads[f] >= round) continue;
        lead[p] = f;
        leads[f] += 1;
      }
    }

    const used = [...leads];
    group.forEach((product, p) => {
      const count = Math.min(pool.length, between(`${product.sku}:photos`, 2, 3));
      const rest = pool
        .map((_, f) => f)
        .filter((f) => f !== lead[p])
        .sort((a, b) => used[a] - used[b] || scores[p][b] - scores[p][a] || a - b)
        .slice(0, count - 1);
      for (const f of rest) used[f] += 1;
      assigned.set(product.sku, [lead[p], ...rest].map((f) => pool[f].url));
    });
  }
  return assigned;
}

// ---------------------------------------------------------------------------
// Price history
// ---------------------------------------------------------------------------

// Three to five rows ending at today's price. Most parts have simply stayed at their usual price.
// About one in twelve came down to it and one in twelve went up to it, in one or two steps of
// roughly 4 percent that keep the price ending the way it does now (...99, ...49).
function priceHistory(product, { price, mrp, nowMs, isNew, steady }) {
  const rows = between(`${product.sku}:price-rows`, 3, 5);
  const firstDay = isNew ? between(`${product.sku}:listed`, 14, 24) : between(`${product.sku}:listed`, 78, 89);
  const lastDay = isNew ? between(`${product.sku}:repriced`, 3, 8) : between(`${product.sku}:repriced`, 9, 26);
  const trend = steady || isNew ? 2 : hash(`${product.sku}:price-trend`) % 12;
  const direction = trend === 0 ? 1 : trend === 1 ? -1 : 0;
  let step = Math.max(100, Math.round((price * 0.04) / 100) * 100);
  if (price < 1000) step = price < 500 ? 20 : 50;

  return Array.from({ length: rows }, (_, index) => {
    const stepsBack = Math.min(2, rows - 1 - index);
    const day = Math.round(firstDay - ((firstDay - lastDay) * index) / (rows - 1));
    return {
      // Never above the MRP: a part cannot have been sold for more than that.
      price: Math.min(mrp, price + direction * step * stepsBack),
      mrp,
      recordedAt: ago(nowMs, day, hash(`${product.sku}:price-hour:${index}`) % 10),
    };
  });
}

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

function insertRow(ctx, table, row) {
  const columns = Object.keys(row);
  const sql = `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${columns.map((column) => `:${column}`).join(', ')})`;
  return ctx.db.run(sql, row).lastInsertRowid;
}

/**
 * Inserts every catalogue product with its variants, fitments and price history.
 *   env: { catalog, photos, nowMs, categoryIds (Map of slug to id), vehicles (from seedVehicles) }
 * Returns { ids (Map of SKU to product id), products, variants, fitments, priceHistory, withPhotos }.
 */
export function seedProducts(ctx, { catalog, photos, nowMs, categoryIds, vehicles }) {
  const products = catalog.seedProducts;
  const labelOf = (product) => ({ ...SUBCATEGORY_LABELS[product.subcategory], ...PRODUCT_OVERRIDES[product.sku] });
  const subcategoryArtKind = new Map(catalog.categories.flatMap((category) => category.subcategories.map((sub) => [sub.slug, sub.artKind])));
  const pcdExamples = new Map(catalog.vehicles.pcdReference.map((entry) => [entry.pcd, entry.confidentExamples]));
  const dropSkus = new Set(DROP.items.map((item) => item.sku));
  const shelf = shelfPlan(products, labelOf);
  const pictures = assignPhotos(products, photos);

  const ids = new Map();
  const counts = { products: 0, variants: 0, fitments: 0, priceHistory: 0, withPhotos: 0 };

  for (const product of products) {
    const label = labelOf(product);
    const copy = SUBCATEGORY_COPY[product.subcategory];
    const fitting = FITTING[product.subcategory];
    const install = installOf(product, catalog.installInfo[product.subcategory]);
    const brand = brandOf(product);
    const isShowPlate = label.customKind === 'show-plate';
    const title = readTitle(product);
    const variantPlan = buildVariants(product);
    const specs = buildSpecs(product, catalog.specTemplates[product.subcategory], { warrantyMonths: label.warrantyMonths, variantPlan });
    const images = pictures.get(product.sku) ?? [];

    // With variants the product row carries the lowest variant price and the stock of them all.
    const cheapest = variantPlan?.variants.reduce((low, variant) => (variant.price < low.price ? variant : low));
    const price = cheapest?.price ?? product.sell;
    const mrp = cheapest?.mrp ?? product.mrp;
    const stock = variantPlan
      ? variantPlan.variants.reduce((sum, variant) => sum + variant.stock, 0)
      : (shelf.get(product.sku) ?? between(`${product.sku}:stock`, ...STOCK_RANGE[product.shipClass]));

    const history = priceHistory(product, { price, mrp, nowMs, isNew: Boolean(label.isNew), steady: dropSkus.has(product.sku) });
    const context = { brand, isShowPlate, install, pcdExamples };

    const productId = insertRow(ctx, 'products', {
      slug: productSlug(ctx, product, title),
      sku: product.sku,
      name: product.title,
      brand,
      category_id: categoryIds.get(product.subcategory),
      short_description: shortDescription(product, title, context),
      description: [copy.intro, aboutThisPart(product, title, context, variantPlan), aboutFitting(product, install)].join('\n\n'),
      price,
      mrp,
      cost_price: Math.round((price * between(`${product.sku}:cost`, 55, 68)) / 100),
      stock,
      supplier: SUPPLIERS[product.category],
      hsn_code: String(product.hsn).match(/\d+/)?.[0] ?? '',
      gst_rate: product.gstRatePct,
      weight_grams: weightGrams(product, specs),
      ship_class: product.shipClass,
      net_quantity: label.netQuantity,
      manufacturer: '',
      country_of_origin: 'India',
      images,
      art_kind: product.artKind === subcategoryArtKind.get(product.subcategory) ? null : product.artKind,
      finish_color: label.finishColor ?? '',
      highlights: copy.highlights,
      specs,
      box_contents: copy.boxContents,
      tags: label.tags,
      ...fitmentColumns(product, isShowPlate),
      legality: label.legality,
      legality_note: label.legalityNote,
      warranty_impact: label.warrantyImpact,
      warranty_note: label.warrantyNote,
      wiring: label.wiring,
      reversible: label.reversible,
      skip_if: label.skipIf,
      install_difficulty: install.difficulty,
      install_time_min: install.timeMin,
      install_time_max: install.timeMax,
      pro_install: install.proInstall,
      fitting_cost_min: label.fittingCostMin,
      fitting_cost_max: label.fittingCostMax,
      fitting_tools: fitting.tools,
      fitting_steps: fitting.steps,
      warranty_months: label.warrantyMonths,
      returnable: label.returnable,
      cod_eligible: label.codEligible,
      goals: label.goals,
      essential_rank: label.essentialRank,
      build_slot: label.buildSlot ?? null,
      build_style: label.buildStyle ?? null,
      custom_kind: label.customKind ?? null,
      is_featured: Boolean(label.isFeatured),
      is_new: Boolean(label.isNew),
      is_active: 1,
      is_demo: 1,
      created_at: history[0].recordedAt,
      updated_at: history.at(-1).recordedAt,
    });
    ids.set(product.sku, productId);
    counts.products += 1;
    if (images.length > 0) counts.withPhotos += 1;

    for (const variant of variantPlan?.variants ?? []) {
      insertRow(ctx, 'product_variants', {
        product_id: productId,
        name: variant.name,
        sku: variant.sku,
        price: variant.price,
        mrp: variant.mrp,
        stock: variant.stock,
        attributes: variant.attributes,
        sort_order: variant.sortOrder,
        is_active: 1,
      });
      counts.variants += 1;
    }

    for (const fitment of fitmentRows(product, vehicles)) {
      insertRow(ctx, 'product_fitments', {
        product_id: productId,
        vehicle_id: fitment.vehicleId,
        fit_type: fitment.fitType,
        note: fitment.note,
        is_verified: fitment.isVerified,
      });
      counts.fitments += 1;
    }

    for (const entry of history) {
      insertRow(ctx, 'price_history', { product_id: productId, price: entry.price, mrp: entry.mrp, recorded_at: entry.recordedAt });
      counts.priceHistory += 1;
    }
  }

  for (const { sku, car, fitType, note } of NEIGHBOUR_FITMENTS) {
    const vehicle = vehicles.startingIn(...car);
    if (!ids.has(sku) || !vehicle) throw new Error(`Neighbour fitment ${sku} on ${car.join('/')} does not match the catalogue`);
    insertRow(ctx, 'product_fitments', { product_id: ids.get(sku), vehicle_id: vehicle.id, fit_type: fitType, note, is_verified: 0 });
    counts.fitments += 1;
  }

  return { ids, ...counts };
}
