// Validates the seed content modules against catalog.json.
// Run: node server/src/seed/content/check.mjs
// Prints a summary and exits non-zero when anything is wrong.

import { readFileSync } from 'node:fs';
import { SUBCATEGORY_LABELS, PRODUCT_OVERRIDES } from './labels.js';
import { FITTING } from './fitting.js';
import { SUBCATEGORY_COPY } from './copy.js';
import { RELATIONS, PICKS, DROP, REPORTS, QUESTIONS, COUPONS, BUILDS } from './extras.js';
import { applyAdditions } from '../data/additions.js';

const catalog = applyAdditions(JSON.parse(readFileSync(new URL('../data/catalog.json', import.meta.url), 'utf8')));

const LEGALITY = ['road_legal', 'check_rules', 'off_road_only'];
const WARRANTY = ['none', 'possible', 'likely'];
const WIRING = ['none', 'plug_and_play', 'splice'];
const GOALS = ['new_car', 'sporty', 'comfort', 'sound', 'night', 'offroad', 'protection'];
const FITTED_BY = ['self', 'local_garage', 'dealer', 'not_fitted'];
const FIT_TYPES = ['direct', 'with_work', 'no'];
const RELATION_KINDS = ['requires', 'pairs_with'];
const PICK_TIERS = ['sensible', 'sweet_spot', 'all_out'];
const COUPON_TYPES = ['percent', 'flat', 'free_shipping'];
const BUILD_BODY_TYPES = ['hatchback', 'sedan', 'suv'];
const BUILD_STYLES = {
  wheels: ['five-spoke', 'multi-spoke', 'mesh', 'split-spoke', 'turbine', 'steelie'],
  spoiler: ['lip', 'ducktail', 'roof', 'gt-wing'],
  splitter: ['lip', 'race'],
  skirts: ['blade'],
  diffuser: ['fins'],
  exhaust: ['single', 'twin', 'quad'],
  roofRack: ['crossbars', 'basket', 'box'],
  lightBar: ['roof-bar', 'bumper-pods'],
  underglow: ['glow'],
  decal: ['stripe', 'side-graphic'],
  bullBar: ['bar'],
  sideStep: ['board'],
  snorkel: ['snorkel'],
  lowering: ['springs', 'coilover'],
};
const SUV_ONLY_SLOTS = ['bullBar', 'sideStep', 'snorkel'];
const COLOUR_SLOTS = ['wheels', 'underglow', 'decal'];
const LOWERING_HEIGHT = { springs: -1, coilover: -2 };
const LABEL_KEYS = [
  'legality', 'legalityNote', 'warrantyImpact', 'warrantyNote', 'wiring', 'reversible', 'skipIf',
  'fittingCostMin', 'fittingCostMax', 'goals', 'essentialRank', 'codEligible', 'returnable',
  'warrantyMonths', 'netQuantity', 'tags',
];
const OVERRIDE_ONLY_KEYS = ['buildSlot', 'buildStyle', 'finishColor', 'customKind', 'isFeatured', 'isNew'];
const MERCH_CATEGORY = 'addon-merchandise';

const HEX = /^#[0-9a-f]{6}$/i;
const DEVANAGARI = /[ऀ-ॿ]/;
const EMOJI = /\p{Extended_Pictographic}/u;

const failures = [];
const fail = (message) => failures.push(message);
const check = (condition, message) => {
  if (!condition) fail(message);
};
const isText = (value) => typeof value === 'string' && value.trim().length > 0;
const sentenceCount = (text) => text.split(/(?<=[.?])\s+/).filter(Boolean).length;

// ---- Catalogue lookups ------------------------------------------------------

const subcategories = catalog.categories.flatMap((category) =>
  category.subcategories.map((sub) => ({ slug: sub.slug, category: category.slug })),
);
const subSlugs = subcategories.map((sub) => sub.slug);
const categoryOfSub = new Map(subcategories.map((sub) => [sub.slug, sub.category]));
const merchSubs = new Set(subcategories.filter((sub) => sub.category === MERCH_CATEGORY).map((sub) => sub.slug));

const products = new Map(catalog.seedProducts.map((product) => [product.sku, product]));
const productsBySub = new Map(subSlugs.map((slug) => [slug, []]));
for (const product of catalog.seedProducts) productsBySub.get(product.subcategory)?.push(product);

const makeNames = new Map(catalog.vehicles.makes.map((make) => [make.slug, make.name]));
const models = new Map();
for (const make of catalog.vehicles.makes) {
  for (const model of make.models) models.set(`${make.slug}/${model.slug}`, model);
}
const pcdExamples = new Map(catalog.vehicles.pcdReference.map((row) => [row.pcd, row.confidentExamples]));

const skuExists = (sku, where) => check(products.has(sku), `${where}: unknown SKU ${sku}`);

check(subSlugs.length === 63, `catalog has ${subSlugs.length} subcategories, expected 63 (61 researched, 2 added)`);
check(products.size === 146, `catalog has ${products.size} seed products, expected 146 (140 researched, 6 added)`);
for (const slug of ['sun-control-films', 'wheel-covers']) check(subSlugs.includes(slug), `catalog is missing the added subcategory ${slug}`);

// ---- 1. Every subcategory is covered by all three keyed modules --------------

function checkKeys(name, object) {
  for (const slug of subSlugs) check(slug in object, `${name}: missing subcategory ${slug}`);
  for (const key of Object.keys(object)) check(categoryOfSub.has(key), `${name}: unknown subcategory key ${key}`);
}
checkKeys('SUBCATEGORY_LABELS', SUBCATEGORY_LABELS);
checkKeys('FITTING', FITTING);
checkKeys('SUBCATEGORY_COPY', SUBCATEGORY_COPY);

// ---- 2. Straight Label values -------------------------------------------------

function checkLabel(where, label) {
  check(LEGALITY.includes(label.legality), `${where}: legality "${label.legality}" is not valid`);
  check(WARRANTY.includes(label.warrantyImpact), `${where}: warrantyImpact "${label.warrantyImpact}" is not valid`);
  check(WIRING.includes(label.wiring), `${where}: wiring "${label.wiring}" is not valid`);
  check(typeof label.legalityNote === 'string', `${where}: legalityNote must be a string`);
  check(typeof label.warrantyNote === 'string', `${where}: warrantyNote must be a string`);
  check(label.legality === 'road_legal' || isText(label.legalityNote), `${where}: a ${label.legality} part needs a legalityNote`);
  check(label.warrantyImpact === 'none' || isText(label.warrantyNote), `${where}: warrantyImpact ${label.warrantyImpact} needs a warrantyNote`);
  for (const flag of ['reversible', 'codEligible', 'returnable']) {
    check(typeof label[flag] === 'boolean', `${where}: ${flag} must be a boolean`);
  }
  check(isText(label.skipIf) && label.skipIf.startsWith('Skip this if '), `${where}: skipIf must start with "Skip this if "`);
  check(
    Number.isInteger(label.fittingCostMin) && Number.isInteger(label.fittingCostMax) &&
      label.fittingCostMin >= 0 && label.fittingCostMax >= label.fittingCostMin,
    `${where}: fitting cost range is not valid`,
  );
  check(label.fittingCostMin > 0 || label.fittingCostMax === 0, `${where}: fittingCostMin 0 needs fittingCostMax 0`);
  check(Array.isArray(label.goals) && label.goals.every((goal) => GOALS.includes(goal)), `${where}: goals contain an unknown kit goal`);
  check(new Set(label.goals).size === label.goals.length, `${where}: goals repeat`);
  check(Number.isInteger(label.essentialRank) && label.essentialRank >= 0 && label.essentialRank <= 9, `${where}: essentialRank must be 0 to 9`);
  check(label.goals.length > 0 || label.essentialRank === 0, `${where}: a part with no goals must have essentialRank 0`);
  check(Number.isInteger(label.warrantyMonths) && label.warrantyMonths >= 0, `${where}: warrantyMonths must be a whole number`);
  check(isText(label.netQuantity), `${where}: netQuantity is empty`);
  check(
    Array.isArray(label.tags) && label.tags.length >= 3 && label.tags.length <= 6 && label.tags.every(isText),
    `${where}: needs 3 to 6 tags`,
  );
}

for (const slug of subSlugs) {
  const label = SUBCATEGORY_LABELS[slug];
  if (!label) continue;
  for (const key of LABEL_KEYS) check(key in label, `SUBCATEGORY_LABELS.${slug}: missing ${key}`);
  for (const key of Object.keys(label)) check(LABEL_KEYS.includes(key), `SUBCATEGORY_LABELS.${slug}: unexpected key ${key}`);
  checkLabel(`SUBCATEGORY_LABELS.${slug}`, label);
}

// Parts the brief names as never plainly road legal.
for (const slug of ['accent-underbody', 'light-bars', 'racing-seats']) {
  check(SUBCATEGORY_LABELS[slug]?.legality === 'off_road_only', `SUBCATEGORY_LABELS.${slug}: must be off_road_only`);
}
// Films are legal only inside the light limits, and the label must say what they are.
{
  const film = SUBCATEGORY_LABELS['sun-control-films'];
  check(film?.legality === 'check_rules', 'SUBCATEGORY_LABELS.sun-control-films: must be check_rules, never plainly road legal');
  for (const words of ['70 percent', '50 percent', 'Rule 100', 'Supreme Court', '2020']) {
    check(film?.legalityNote.includes(words), `SUBCATEGORY_LABELS.sun-control-films: legalityNote must mention ${words}`);
  }
}
for (const slug of ['exhaust', 'suspension', 'air-intakes', 'ambient-lighting', 'subwoofers-amps']) {
  check(SUBCATEGORY_LABELS[slug]?.warrantyImpact !== 'none', `SUBCATEGORY_LABELS.${slug}: warranty impact cannot be none`);
}

// ---- 3. Product overrides ------------------------------------------------------

const buildMapped = new Map();
let featured = 0;
let isNew = 0;
let showPlates = 0;

for (const [sku, override] of Object.entries(PRODUCT_OVERRIDES)) {
  const where = `PRODUCT_OVERRIDES.${sku}`;
  skuExists(sku, 'PRODUCT_OVERRIDES');
  const product = products.get(sku);
  if (!product) continue;
  for (const key of Object.keys(override)) {
    check(LABEL_KEYS.includes(key) || OVERRIDE_ONLY_KEYS.includes(key), `${where}: unexpected key ${key}`);
  }
  if (SUBCATEGORY_LABELS[product.subcategory]) {
    const merged = { ...SUBCATEGORY_LABELS[product.subcategory] };
    for (const key of LABEL_KEYS) if (key in override) merged[key] = override[key];
    checkLabel(`${where} (merged with ${product.subcategory})`, merged);
  }
  if ('buildSlot' in override || 'buildStyle' in override) {
    check(override.buildSlot in BUILD_STYLES, `${where}: buildSlot "${override.buildSlot}" is not a Build Bay slot`);
    check(BUILD_STYLES[override.buildSlot]?.includes(override.buildStyle), `${where}: buildStyle "${override.buildStyle}" is not valid for slot ${override.buildSlot}`);
    check(HEX.test(override.finishColor ?? ''), `${where}: a Build Bay part needs a finishColor hex`);
    buildMapped.set(sku, override);
  } else if ('finishColor' in override) {
    check(HEX.test(override.finishColor), `${where}: finishColor must be a hex colour`);
  }
  if ('customKind' in override) {
    check(override.customKind === 'show-plate', `${where}: unknown customKind ${override.customKind}`);
    showPlates += 1;
  }
  for (const flag of ['isFeatured', 'isNew']) {
    if (flag in override) check(override[flag] === true, `${where}: ${flag} must be true when present`);
  }
  if (override.isFeatured) featured += 1;
  if (override.isNew) isNew += 1;
}

check(showPlates === 1, `expected exactly one show-plate product, found ${showPlates}`);
check(PRODUCT_OVERRIDES['ADN-EXT-020']?.customKind === 'show-plate', 'ADN-EXT-020 must be the show-plate product');
check(featured >= 10 && featured <= 14, `expected about 12 featured products, found ${featured}`);
check(isNew >= 10 && isNew <= 14, `expected about 12 new products, found ${isNew}`);

// COD is off for freight, custom and very high value products.
for (const product of products.values()) {
  const label = { ...SUBCATEGORY_LABELS[product.subcategory], ...PRODUCT_OVERRIDES[product.sku] };
  if (product.shipClass === 'freight' || product.sell >= 20000 || label.customKind) {
    check(label.codEligible === false, `${product.sku}: freight, custom or high value, so codEligible must be false`);
  }
}

// Every alloy wheel maps to its own wheels style and finish.
const wheelSkus = (productsBySub.get('alloy-wheels') ?? []).map((product) => product.sku);
const wheelStyles = new Set();
const wheelFinishes = new Set();
for (const sku of wheelSkus) {
  const mapping = buildMapped.get(sku);
  check(mapping?.buildSlot === 'wheels', `${sku}: every alloy wheel needs a wheels Build Bay mapping`);
  if (mapping) {
    wheelStyles.add(mapping.buildStyle);
    wheelFinishes.add(mapping.finishColor.toLowerCase());
  }
}
check(wheelStyles.size === wheelSkus.length, 'alloy wheels must each use a different wheels style');
check(wheelFinishes.size === wheelSkus.length, 'alloy wheels must each use a different finish colour');

const expectedSlotBySub = {
  'front-splitters': 'splitter',
  'spoilers-wings': 'spoiler',
  'body-kits': 'skirts',
  'rear-diffusers': 'diffuser',
  exhaust: 'exhaust',
  'roof-racks': 'roofRack',
  'light-bars': 'lightBar',
  snorkels: 'snorkel',
};
for (const [slug, slot] of Object.entries(expectedSlotBySub)) {
  for (const product of productsBySub.get(slug) ?? []) {
    check(buildMapped.get(product.sku)?.buildSlot === slot, `${product.sku}: expected a ${slot} Build Bay mapping`);
  }
}

// ---- 4. Fitting cards -----------------------------------------------------------

let stepCount = 0;
for (const slug of subSlugs) {
  const card = FITTING[slug];
  if (!card) continue;
  const where = `FITTING.${slug}`;
  check(Array.isArray(card.tools) && card.tools.every(isText), `${where}: tools must be a list of non-empty strings`);
  check(Array.isArray(card.steps), `${where}: steps must be a list`);
  const steps = card.steps ?? [];
  stepCount += steps.length;
  if (merchSubs.has(slug)) {
    check(steps.length === 1, `${where}: merchandise takes a single care step, found ${steps.length}`);
  } else {
    check(steps.length >= 4 && steps.length <= 7, `${where}: needs 4 to 7 steps, found ${steps.length}`);
  }
  steps.forEach((step, index) => {
    check(isText(step.en), `${where} step ${index + 1}: English is empty`);
    check(isText(step.hi), `${where} step ${index + 1}: Hindi is empty`);
    check(DEVANAGARI.test(step.hi ?? ''), `${where} step ${index + 1}: Hindi is not in Devanagari`);
    check(!DEVANAGARI.test(step.en ?? ''), `${where} step ${index + 1}: English contains Devanagari`);
  });
}

// ---- 5. Copy ----------------------------------------------------------------------

for (const slug of subSlugs) {
  const copy = SUBCATEGORY_COPY[slug];
  if (!copy) continue;
  const where = `SUBCATEGORY_COPY.${slug}`;
  check(isText(copy.intro), `${where}: intro is empty`);
  const sentences = sentenceCount(copy.intro ?? '');
  check(sentences >= 2 && sentences <= 3, `${where}: intro should be 2 or 3 sentences, found ${sentences}`);
  check(
    Array.isArray(copy.highlights) && copy.highlights.length >= 4 && copy.highlights.length <= 5 && copy.highlights.every(isText),
    `${where}: needs 4 or 5 highlights`,
  );
  check(Array.isArray(copy.boxContents) && copy.boxContents.length > 0 && copy.boxContents.every(isText), `${where}: boxContents is empty`);
}

// ---- 6. Relations ------------------------------------------------------------------

const relationPairs = new Set();
for (const relation of RELATIONS) {
  const where = `RELATIONS ${relation.sku} -> ${relation.relatedSku}`;
  skuExists(relation.sku, where);
  skuExists(relation.relatedSku, where);
  check(relation.sku !== relation.relatedSku, `${where}: a product cannot relate to itself`);
  check(RELATION_KINDS.includes(relation.kind), `${where}: kind "${relation.kind}" is not valid`);
  check(isText(relation.note), `${where}: note is empty`);
  const pair = `${relation.sku}>${relation.relatedSku}`;
  check(!relationPairs.has(pair), `${where}: duplicate relation`);
  relationPairs.add(pair);
}
check(RELATIONS.length >= 35 && RELATIONS.length <= 50, `expected about 40 relations, found ${RELATIONS.length}`);

// ---- 7. Pick of Three ----------------------------------------------------------------

for (const [slug, picks] of Object.entries(PICKS)) {
  const where = `PICKS.${slug}`;
  const pool = productsBySub.get(slug);
  check(Boolean(pool), `${where}: unknown subcategory`);
  check((pool?.length ?? 0) >= 3, `${where}: only ${pool?.length ?? 0} products, picks need 3 or more`);
  check(Object.keys(picks).sort().join() === [...PICK_TIERS].sort().join(), `${where}: must have exactly sensible, sweet_spot and all_out`);
  const chosen = [];
  for (const tier of PICK_TIERS) {
    const pick = picks[tier];
    if (!pick) continue;
    skuExists(pick.sku, `${where}.${tier}`);
    check(products.get(pick.sku)?.subcategory === slug, `${where}.${tier}: ${pick.sku} is not in this subcategory`);
    check(isText(pick.reason), `${where}.${tier}: reason is empty`);
    chosen.push(pick.sku);
  }
  check(new Set(chosen).size === 3, `${where}: the three picks must be different products`);
  const price = (tier) => products.get(picks[tier]?.sku)?.sell ?? 0;
  check(price('sensible') <= price('sweet_spot') && price('sweet_spot') <= price('all_out'), `${where}: tiers should rise in price`);
}
for (const [slug, pool] of productsBySub) {
  if (pool.length >= 3) check(slug in PICKS, `PICKS: ${slug} has ${pool.length} products but no picks`);
}

// ---- 8. The Friday Five ----------------------------------------------------------------

check(DROP.title === 'The Friday Five', 'DROP: title must be "The Friday Five"');
check(isText(DROP.note), 'DROP: note is empty');
check(DROP.items.length === 5, `DROP: needs exactly 5 items, found ${DROP.items.length}`);
const dropCategories = new Set();
for (const item of DROP.items) {
  skuExists(item.sku, 'DROP');
  check(Number.isInteger(item.percentOff) && item.percentOff >= 8 && item.percentOff <= 20, `DROP ${item.sku}: percentOff must be 8 to 20`);
  check(isText(item.reason), `DROP ${item.sku}: reason is empty`);
  dropCategories.add(products.get(item.sku)?.category);
}
check(dropCategories.size === DROP.items.length, 'DROP: items must come from different categories');

// ---- 9. Sample fitted reports -------------------------------------------------------------

function vehicleMatchesProduct(report, product) {
  const text = report.vehicle;
  const year = Number((text.match(/\b(19|20)\d{2}\b/) ?? [])[0]);
  const fitment = product.fitment;
  if (fitment.type === 'vehicle') {
    return fitment.vehicles.some((vehicle) => {
      const model = models.get(`${vehicle.make}/${vehicle.model}`);
      const name = `${makeNames.get(vehicle.make)} ${model?.name.split(' / ')[0]}`;
      return text.startsWith(`${name} `) && year >= vehicle.yearFrom && year <= (vehicle.yearTo ?? 9999);
    });
  }
  if (fitment.type === 'pcd') return (pcdExamples.get(fitment.pcd) ?? []).some((name) => text.startsWith(`${name} `));
  return true;
}

for (const report of REPORTS) {
  const where = `REPORTS ${report.sku} by ${report.authorName}`;
  skuExists(report.sku, where);
  const product = products.get(report.sku);
  check(/^[A-Z][a-z]+ [A-Z]\.$/.test(report.authorName), `${where}: authorName should be a first name and an initial`);
  check(isText(report.vehicle), `${where}: vehicle is empty`);
  check(Number.isInteger(report.rating) && report.rating >= 1 && report.rating <= 5, `${where}: rating must be 1 to 5`);
  check(FITTED_BY.includes(report.fittedBy), `${where}: fittedBy "${report.fittedBy}" is not valid`);
  check(report.timeMinutes === null || (Number.isInteger(report.timeMinutes) && report.timeMinutes > 0), `${where}: timeMinutes must be a positive whole number or null`);
  check(report.difficulty === null || (Number.isInteger(report.difficulty) && report.difficulty >= 1 && report.difficulty <= 5), `${where}: difficulty must be 1 to 5 or null`);
  check((report.fittedBy === 'not_fitted') === (report.timeMinutes === null), `${where}: timeMinutes is null only when nothing was fitted`);
  check(typeof report.fittedOk === 'boolean', `${where}: fittedOk must be a boolean`);
  check(typeof report.issues === 'string', `${where}: issues must be a string`);
  check(report.fittedOk || isText(report.issues), `${where}: a report that did not fit first time must say what went wrong`);
  check(isText(report.body), `${where}: body is empty`);
  if (product) check(vehicleMatchesProduct(report, product), `${where}: "${report.vehicle}" is not a car this product fits`);
}
const reportedSkus = new Set(REPORTS.map((report) => report.sku));
check(REPORTS.length >= 40 && REPORTS.length <= 50, `expected about 45 reports, found ${REPORTS.length}`);
check(reportedSkus.size >= 20 && reportedSkus.size <= 30, `expected reports on about 25 products, found ${reportedSkus.size}`);

// ---- 10. Sample questions -------------------------------------------------------------------

const answeredFitTypes = new Set();
for (const question of QUESTIONS) {
  const where = `QUESTIONS ${question.sku} by ${question.authorName}`;
  skuExists(question.sku, where);
  check(['general', 'fitment'].includes(question.kind), `${where}: kind "${question.kind}" is not valid`);
  check(/^[A-Z][a-z]+ [A-Z]\.$/.test(question.authorName ?? ''), `${where}: authorName should be a first name and an initial`);
  check(isText(question.question), `${where}: question is empty`);
  check(isText(question.answer), `${where}: answer is empty`);
  if (question.kind === 'fitment') {
    check(FIT_TYPES.includes(question.answerFitType), `${where}: answerFitType "${question.answerFitType}" is not valid`);
    answeredFitTypes.add(question.answerFitType);
    const vehicle = question.vehicle ?? {};
    const model = models.get(`${vehicle.make}/${vehicle.model}`);
    check(Boolean(model), `${where}: unknown vehicle ${vehicle.make}/${vehicle.model}`);
    check(Boolean(model?.generations.some((generation) => generation.from === vehicle.yearFrom)), `${where}: no ${vehicle.make}/${vehicle.model} generation starts in ${vehicle.yearFrom}`);
  } else {
    check(!('vehicle' in question) && !('answerFitType' in question), `${where}: a general question carries no vehicle or fit verdict`);
  }
}
for (const fitType of FIT_TYPES) check(answeredFitTypes.has(fitType), `QUESTIONS: no fitment question is answered "${fitType}"`);
check(QUESTIONS.length >= 20 && QUESTIONS.length <= 28, `expected about 24 questions, found ${QUESTIONS.length}`);

// ---- 11. Coupons ------------------------------------------------------------------------------

// The owner's own four codes (docs/COMPANY.md), no invented ones.
const OWNER_COUPONS = {
  ADDON10: { type: 'percent', value: 10, minOrder: 2999, maxDiscount: 2000 },
  SOUND1500: { type: 'flat', value: 1500, minOrder: 9999, maxDiscount: null },
  FIRSTRIDE: { type: 'flat', value: 500, minOrder: 3999, maxDiscount: null },
  WHEELS30: { type: 'percent', value: 5, minOrder: 15000, maxDiscount: 3000 },
};
check(
  COUPONS.map((coupon) => coupon.code).sort().join() === Object.keys(OWNER_COUPONS).sort().join(),
  `COUPONS: expected exactly the owner's codes ${Object.keys(OWNER_COUPONS).join(', ')}`,
);
for (const coupon of COUPONS) {
  const owner = OWNER_COUPONS[coupon.code];
  if (!owner) continue;
  for (const [key, value] of Object.entries(owner)) check(coupon[key] === value, `COUPONS.${coupon.code}: ${key} should be ${value}, found ${coupon[key]}`);
}
check(new Set(COUPONS.map((coupon) => coupon.code.toUpperCase())).size === COUPONS.length, 'COUPONS: codes must be unique');
for (const coupon of COUPONS) {
  const where = `COUPONS.${coupon.code}`;
  check(/^[A-Z0-9]{4,16}$/.test(coupon.code), `${where}: code should be 4 to 16 capitals or digits`);
  check(COUPON_TYPES.includes(coupon.type), `${where}: type "${coupon.type}" is not valid`);
  check(isText(coupon.description), `${where}: description is empty`);
  check(Number.isInteger(coupon.value) && coupon.value >= 0, `${where}: value must be a whole number`);
  check(Number.isInteger(coupon.minOrder) && coupon.minOrder >= 0, `${where}: minOrder must be a whole number`);
  if (coupon.type === 'percent') {
    check(coupon.value >= 1 && coupon.value <= 100, `${where}: percent must be 1 to 100`);
    check(Number.isInteger(coupon.maxDiscount) && coupon.maxDiscount > 0, `${where}: a percent coupon needs a cap`);
  }
  if (coupon.type === 'flat') check(coupon.value > 0 && coupon.minOrder > coupon.value, `${where}: a flat coupon needs a minimum above its value`);
  check(coupon.isActive === true, `${where}: seed coupons should be active`);
}

// ---- 12. House builds ---------------------------------------------------------------------------

const buildBodyTypes = new Set();
for (const build of BUILDS) {
  const where = `BUILDS "${build.title}"`;
  const state = build.state ?? {};
  check(isText(build.title), `${where}: title is empty`);
  check(isText(build.vehicleLabel), `${where}: vehicleLabel is empty`);
  check(BUILD_BODY_TYPES.includes(state.bodyType), `${where}: bodyType "${state.bodyType}" is not valid`);
  buildBodyTypes.add(state.bodyType);
  check(HEX.test(state.paint ?? ''), `${where}: paint must be a hex colour`);
  check(Number.isInteger(state.rideHeight) && state.rideHeight >= -2 && state.rideHeight <= 2, `${where}: rideHeight must be -2 to 2`);
  check(Number.isInteger(state.wheelSize) && state.wheelSize >= 0 && state.wheelSize <= 2, `${where}: wheelSize must be 0 to 2`);
  check(typeof state.night === 'boolean', `${where}: night must be a boolean`);
  check(Number.isInteger(state.tint) && state.tint >= 0 && state.tint <= 60, `${where}: tint must be 0 to 60`);
  const partSkus = [];
  for (const [slot, part] of Object.entries(state.parts ?? {})) {
    check(slot in BUILD_STYLES, `${where}: "${slot}" is not a Build Bay slot`);
    check(BUILD_STYLES[slot]?.includes(part.style), `${where}: style "${part.style}" is not valid for ${slot}`);
    check(state.bodyType === 'suv' || !SUV_ONLY_SLOTS.includes(slot), `${where}: ${slot} is for SUVs only`);
    check(!(slot === 'spoiler' && part.style === 'roof' && state.bodyType === 'sedan'), `${where}: a roof spoiler does not suit a sedan`);
    check(COLOUR_SLOTS.includes(slot) ? HEX.test(part.color ?? '') : !('color' in part), `${where}: ${slot} ${COLOUR_SLOTS.includes(slot) ? 'needs' : 'takes no'} colour`);
    skuExists(part.sku, `${where} ${slot}`);
    const mapping = buildMapped.get(part.sku);
    check(Boolean(mapping), `${where}: ${part.sku} has no Build Bay mapping in PRODUCT_OVERRIDES`);
    check(mapping?.buildSlot === slot && mapping?.buildStyle === part.style, `${where}: ${part.sku} is mapped to ${mapping?.buildSlot}/${mapping?.buildStyle}, not ${slot}/${part.style}`);
    if (COLOUR_SLOTS.includes(slot)) check(mapping?.finishColor === part.color, `${where}: ${slot} colour should match the product finish`);
    partSkus.push(part.sku);
  }
  const lowering = state.parts?.lowering;
  check((lowering ? LOWERING_HEIGHT[lowering.style] : 0) === state.rideHeight, `${where}: rideHeight must come from the lowering part (springs -1, coilover -2, none 0)`);
  check(partSkus.length >= 3, `${where}: a house build needs at least 3 parts`);
  check([...build.skus].sort().join() === [...partSkus].sort().join(), `${where}: skus must list exactly the parts on the car`);
}
check(BUILDS.length === 5, `expected 5 house builds, found ${BUILDS.length}`);
for (const bodyType of BUILD_BODY_TYPES) check(buildBodyTypes.has(bodyType), `BUILDS: no ${bodyType} build`);
check(new Set(BUILDS.map((build) => build.title)).size === BUILDS.length, 'BUILDS: titles must be unique');

// ---- 13. Copy rules: no exclamation marks, no emoji ------------------------------------------------

function walkStrings(value, path, visit) {
  if (typeof value === 'string') visit(value, path);
  else if (Array.isArray(value)) value.forEach((item, index) => walkStrings(item, `${path}[${index}]`, visit));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) walkStrings(item, `${path}.${key}`, visit);
  }
}
let stringCount = 0;
const allContent = { SUBCATEGORY_LABELS, PRODUCT_OVERRIDES, FITTING, SUBCATEGORY_COPY, RELATIONS, PICKS, DROP, REPORTS, QUESTIONS, COUPONS, BUILDS };
walkStrings(allContent, 'content', (text, path) => {
  stringCount += 1;
  check(!text.includes('!'), `${path}: exclamation mark in copy`);
  check(!EMOJI.test(text), `${path}: emoji in copy`);
  check(text === text.trim(), `${path}: leading or trailing space`);
  check(!/\bRs\.?\s?\d/.test(text), `${path}: write rupees with the ₹ sign`);
});

// ---- Summary ----------------------------------------------------------------------------------------

const legalityCounts = Object.fromEntries(LEGALITY.map((value) => [value, 0]));
for (const product of products.values()) {
  const label = { ...SUBCATEGORY_LABELS[product.subcategory], ...PRODUCT_OVERRIDES[product.sku] };
  if (label.legality in legalityCounts) legalityCounts[label.legality] += 1;
}
const fittedOk = REPORTS.filter((report) => report.fittedOk).length;

console.log('Seed content check');
console.log(`  subcategories      ${subSlugs.length} in catalog; labels ${Object.keys(SUBCATEGORY_LABELS).length}, fitting ${Object.keys(FITTING).length}, copy ${Object.keys(SUBCATEGORY_COPY).length}`);
console.log(`  fitting steps      ${stepCount} (English and Hindi)`);
console.log(`  product overrides  ${Object.keys(PRODUCT_OVERRIDES).length} of ${products.size} products; Build Bay parts ${buildMapped.size}, featured ${featured}, new ${isNew}, show plates ${showPlates}`);
console.log(`  legality by product road_legal ${legalityCounts.road_legal}, check_rules ${legalityCounts.check_rules}, off_road_only ${legalityCounts.off_road_only}`);
console.log(`  relations          ${RELATIONS.length} (${RELATIONS.filter((relation) => relation.kind === 'requires').length} requires)`);
console.log(`  picks              ${Object.keys(PICKS).length} subcategories`);
console.log(`  drop               ${DROP.items.length} items from ${dropCategories.size} categories`);
console.log(`  reports            ${REPORTS.length} on ${reportedSkus.size} products, ${Math.round((fittedOk / REPORTS.length) * 100)}% fitted first time`);
console.log(`  questions          ${QUESTIONS.length} (${QUESTIONS.filter((question) => question.kind === 'fitment').length} fitment)`);
console.log(`  coupons            ${COUPONS.length}`);
console.log(`  builds             ${BUILDS.length} (${[...buildBodyTypes].join(', ')})`);
console.log(`  strings checked    ${stringCount}`);

if (failures.length > 0) {
  console.error(`\n${failures.length} failure${failures.length === 1 ? '' : 's'}:`);
  for (const message of failures) console.error(`  - ${message}`);
  process.exit(1);
}
console.log('\nAll checks passed: 0 failures.');
