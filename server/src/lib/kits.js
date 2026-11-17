/**
 * The kit planner behind POST /api/kits/build (New Car planner and Pocket Builds).
 *
 * buildKits(ctx, request) gives a KitResponse: up to three coherent kits for one goal and budget.
 *
 *   Candidates  active, in-stock parts tagged with the goal and an essential_rank above 0, that fit the car
 *               (verdict direct, with_work or universal). With only a body type: universal parts and parts made
 *               for that body type. With neither: universal parts only. Excluded ids and parts that need a
 *               designer before buying (custom_kind) are left out.
 *   Groups      one per subcategory; a group's rank is the lowest essential_rank among its options.
 *               A kit never holds two parts from one subcategory.
 *   essential   the must-haves: lowest ranks first, the cheapest option, about half the groups, at most 60% of the budget.
 *   smart       essentials plus the next ranks, the sweet-spot option per subcategory, at most 85% of the budget.
 *   full        smart plus everything else that fits, then each part upgraded to the better option while the budget allows.
 *
 * Each tier builds on the one before, so totals never go down from essential to full. A tier with fewer than
 * two parts is dropped, and a tier with exactly the same parts as an earlier one is left out.
 * Everything is ordered with id tie-breakers, so the same request and catalogue give the same kits.
 */
import { badRequest } from './errors.js';
import { findProductRows, fitSql, fitVerdict, getVehicleRow } from './catalog.js';
import { toProductSummary, toVehicle } from './mappers.js';
import { formatINR } from './money.js';

export const KIT_GOALS = ['new_car', 'sporty', 'comfort', 'sound', 'night', 'offroad', 'protection'];
export const KIT_BUDGET_MIN = 500;
export const KIT_BUDGET_MAX = 500000;

const CANDIDATE_LIMIT = 1000;
const FITTING_VERDICTS = ['direct', 'with_work', 'universal'];

const TIER_SHARE = { essential: 0.6, smart: 0.85, full: 1 };

const GOAL_WORDS = {
  new_car: { label: 'new car', aim: 'set up a new car properly' },
  sporty: { label: 'sporty', aim: 'make the car look sharper' },
  comfort: { label: 'comfort', aim: 'make every drive easier' },
  sound: { label: 'sound', aim: 'get better sound in the cabin' },
  night: { label: 'night driving', aim: 'see and be seen after dark' },
  offroad: { label: 'rough roads', aim: 'take on bad roads and trails' },
  protection: { label: 'protection', aim: 'keep the car looking new' },
};

// What a part does, read from its subcategory slug and name. First match wins, so specific words come first.
// The text searched is "-slug-name-" with every run of other characters turned into one hyphen.
const ROLES = [
  [/floor-?mats?-|-mats?-|-7d-|-3d-mats?-|carpet/, 'Protects the new carpets from day one'],
  [/cushion|pillow|lumbar|neck-?rest|back-?rest/, 'Easier on the back over long drives'],
  [/seat-?covers?-/, 'Keeps the factory seats clean for resale'],
  [/mud-?flaps?|mud-?guards?|splash/, 'Keeps stones and mud off the paint'],
  [/body-?covers?|car-?covers?/, 'Keeps dust and bird droppings off when parked outside'],
  [/sun-?shades?|window-?shades?|curtain/, 'Keeps the cabin cooler when parked in the sun'],
  [/sun-?control|-films?-|tint|sun-?film/, 'Cuts glare and heat through the glass'],
  [/wheel-?covers?|wheel-?cups?|hub-?caps?/, 'Dresses steel wheels for a fraction of the price of alloys'],
  [/dash-?cam/, 'A record of every drive, for claims and disputes'],
  [/reverse|parking|camera|sensor/, 'Makes tight parking far less of a guess'],
  [/inflator|compressor|tyre-?pump/, 'Sorts out a soft tyre at the roadside'],
  [/-fog-/, 'Cuts through fog and rain where headlamps scatter'],
  [/light-?bars?-|bar-?lights?-/, 'Throws light far down unlit roads'],
  [/headl|bulbs?-|-led-|projector|-hid-|lamps?-|lights?-|lighting/, 'Better light on unlit roads at night'],
  [/damping|deaden|insulation/, 'Quieter cabin, cleaner sound'],
  [/speakers?-|woofer/, 'The biggest change you will hear'],
  [/-amps?-|amplifier/, 'Gives the speakers the power they need'],
  [/stereo|head-?units?-|android|infotainment|player/, 'Brings maps and music to the dash'],
  [/spoiler|-wings?-/, 'The quickest way to change the profile'],
  [/alloy|wheels?-|-rims?-/, 'Changes the look more than anything else'],
  [/body-?kit|splitter|skirt|diffuser|-lip-/, 'Sharpens the lines of the body'],
  [/exhaust|muffler|silencer/, 'Adds a deeper note and a finished rear'],
  [/lowering|springs?-|coilover|suspension/, 'Settles the stance and the body roll'],
  [/decal|sticker|wrap|stripe/, 'A bold change that can come off later'],
  [/roof-?racks?|carrier|cross-?bars?|roof-?box/, 'Room for luggage the boot cannot take'],
  [/snorkel|bull-?bars?|skid|side-?steps?|recovery|winch/, 'Built for rough tracks and deep water'],
  [/scuff|-sill|guard|protector|bumper|corner|door-?edge|-ppf-/, 'Saves the paint where it scrapes first'],
  [/ceramic|coating|-wax-|polish|detailing|cleaning/, 'Keeps the paint easy to clean'],
  [/organi[sz]er|storage|-trays?-|pocket/, 'Gives loose things a place'],
  [/charger|-usb-|holder|mount/, 'Keeps the phone charged and in sight'],
  [/freshener|perfume|fragrance/, 'A cabin that smells clean'],
  [/steering|gear-?knob|pedal/, 'The parts your hands touch on every drive'],
];

function roleOf(row) {
  const haystack = `-${row.category_slug ?? ''}-${String(row.name ?? '')}-`.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  for (const [pattern, line] of ROLES) {
    if (pattern.test(haystack)) return line;
  }
  return null;
}

function reasonFor(row, verdict) {
  const rank = Number(row.essential_rank);
  let line = roleOf(row);
  if (!line) {
    if (rank <= 1) line = 'First thing most owners add';
    else if (rank <= 3) line = 'Worth adding early';
    else line = 'A good add once the basics are done';
  }
  if (verdict?.fit === 'with_work') line += '. Fits with some work';
  return `${line}.`;
}

const priceOf = (row) => Number(row.sale_price ?? row.price) || 0;
const byPriceThenId = (a, b) => priceOf(a) - priceOf(b) || a.id - b.id;

/** The SQL condition that keeps only parts that fit, for a vehicle row, a body type or nothing known. */
function fitClause(vehicle, bodyType) {
  if (vehicle) {
    const fit = fitSql(vehicle);
    return { sql: `(${fit.sql}) IN ('direct', 'with_work', 'universal')`, params: fit.params };
  }
  if (bodyType) {
    return {
      sql: `p.fitment_type IN ('universal', 'none') OR (p.fitment_type = 'body_type' AND EXISTS (
        SELECT 1 FROM json_each(CASE WHEN json_valid(p.body_types) THEN p.body_types ELSE '[]' END) kbt
        WHERE kbt.type = 'text' AND kbt.value = :kitBodyType))`,
      params: { kitBodyType: bodyType },
    };
  }
  return { sql: "p.fitment_type IN ('universal', 'none')", params: {} };
}

function loadCandidates(ctx, { goal, vehicle, bodyType, exclude }) {
  const fit = fitClause(vehicle, bodyType);
  const where = [
    'p.stock > 0',
    'p.essential_rank > 0',
    "(p.custom_kind IS NULL OR p.custom_kind = '')",
    `EXISTS (SELECT 1 FROM json_each(CASE WHEN json_valid(p.goals) THEN p.goals ELSE '[]' END) kg
             WHERE kg.type = 'text' AND kg.value = :kitGoal)`,
    'p.id NOT IN (SELECT value FROM json_each(:kitExclude))',
    fit.sql,
  ];
  const { rows, verdicts } = findProductRows(ctx, {
    where,
    params: { kitGoal: goal, kitExclude: exclude, ...fit.params },
    orderBy: 'p.essential_rank ASC, p.sale_price ASC',
    limit: CANDIDATE_LIMIT,
    vehicleId: vehicle?.id,
  });

  // The SQL already filtered; this keeps the JavaScript verdict and the SQL one honest with each other.
  const kept = [];
  for (const row of rows) {
    let verdict = verdicts.get(row.id);
    if (!vehicle && bodyType) verdict = fitVerdict(row, { bodyType });
    if (vehicle && !FITTING_VERDICTS.includes(verdict?.fit)) continue;
    kept.push({ row, verdict: vehicle || bodyType ? verdict : undefined });
  }
  return kept;
}

function loadPicks(ctx, categoryIds) {
  const picks = new Map();
  if (categoryIds.length === 0) return picks;
  const rows = ctx.db.all(
    `SELECT category_id, tier, product_id FROM category_picks
     WHERE tier IN ('sweet_spot', 'all_out') AND category_id IN (SELECT value FROM json_each(?))`,
    [categoryIds],
  );
  for (const row of rows) {
    const entry = picks.get(row.category_id) ?? {};
    entry[row.tier] = row.product_id;
    picks.set(row.category_id, entry);
  }
  return picks;
}

/** Candidates grouped by subcategory, in rank order, each group's options cheapest first. */
function groupCandidates(ctx, candidates) {
  const groups = new Map();
  for (const candidate of candidates) {
    const key = candidate.row.category_id;
    let group = groups.get(key);
    if (!group) {
      group = { categoryId: key, options: [], rank: Infinity };
      groups.set(key, group);
    }
    group.options.push(candidate);
    group.rank = Math.min(group.rank, Number(candidate.row.essential_rank));
  }
  const picks = loadPicks(ctx, [...groups.keys()]);
  const list = [...groups.values()];
  for (const group of list) {
    group.options.sort((a, b) => byPriceThenId(a.row, b.row));
    const groupPicks = picks.get(group.categoryId) ?? {};
    const index = (productId) => group.options.findIndex((option) => option.row.id === productId);
    const sweet = index(groupPicks.sweet_spot);
    const allOut = index(groupPicks.all_out);
    // Sweet spot: the shop's own pick when it is a candidate, else the middle of the range (lower middle).
    group.valueIndex = sweet >= 0 ? sweet : Math.floor((group.options.length - 1) / 2);
    group.topIndex = allOut >= 0 ? allOut : group.options.length - 1;
  }
  list.sort((a, b) => a.rank - b.rank || priceOf(a.options[0].row) - priceOf(b.options[0].row) || a.categoryId - b.categoryId);
  return list;
}

function sumSelection(groups, selection) {
  let total = 0;
  for (const group of groups) {
    if (selection.has(group.categoryId)) total += priceOf(group.options[selection.get(group.categoryId)].row);
  }
  return total;
}

/** Largest option index from `from` down to `floor` that keeps the total within the cap, or -1. */
function bestFit(group, from, floor, spare) {
  for (let index = from; index >= floor; index -= 1) {
    if (priceOf(group.options[index].row) <= spare) return index;
  }
  return -1;
}

function essentialSelection(groups, cap) {
  const selection = new Map();
  const maxGroups = Math.max(2, Math.ceil(groups.length / 2));
  let total = 0;
  for (const group of groups) {
    if (selection.size >= maxGroups) break;
    const price = priceOf(group.options[0].row);
    if (total + price <= cap) {
      selection.set(group.categoryId, 0);
      total += price;
    }
  }
  return selection;
}

function smartSelection(groups, base, cap) {
  const selection = new Map(base);
  let total = sumSelection(groups, selection);
  for (const group of groups) {
    const current = selection.get(group.categoryId);
    if (current !== undefined) {
      const currentPrice = priceOf(group.options[current].row);
      const upgrade = bestFit(group, group.valueIndex, current + 1, cap - total + currentPrice);
      if (upgrade > current) {
        total += priceOf(group.options[upgrade].row) - currentPrice;
        selection.set(group.categoryId, upgrade);
      }
      continue;
    }
    const pick = bestFit(group, group.valueIndex, 0, cap - total);
    if (pick >= 0) {
      selection.set(group.categoryId, pick);
      total += priceOf(group.options[pick].row);
    }
  }
  return selection;
}

function fullSelection(groups, base, cap) {
  const selection = new Map(base);
  let total = sumSelection(groups, selection);
  // Cover as many subcategories as the budget allows first, at the cheapest option ...
  for (const group of groups) {
    if (selection.has(group.categoryId)) continue;
    const price = priceOf(group.options[0].row);
    if (total + price <= cap) {
      selection.set(group.categoryId, 0);
      total += price;
    }
  }
  // ... then spend what is left on the better option, most important parts first.
  for (const group of groups) {
    const current = selection.get(group.categoryId);
    if (current === undefined) continue;
    const currentPrice = priceOf(group.options[current].row);
    const top = Math.max(group.topIndex, current);
    const upgrade = bestFit(group, top, current + 1, cap - total + currentPrice);
    if (upgrade > current) {
      total += priceOf(group.options[upgrade].row) - currentPrice;
      selection.set(group.categoryId, upgrade);
    }
  }
  return selection;
}

function describeTier(tier, goal, { count, total, budget }) {
  const words = GOAL_WORDS[goal] ?? { label: goal, aim: 'get the car the way you want it' };
  const left = budget - total;
  const leftLine = left > 0 ? ` ${formatINR(left)} of your budget left over.` : ' Uses the whole budget.';
  switch (tier) {
    case 'essential':
      return {
        title: 'Essential',
        blurb: `The ${count} parts most owners add first to ${words.aim}, at the sensible price.${leftLine}`,
      };
    case 'smart':
      return {
        title: 'Smart',
        blurb: `The essentials plus the next things worth having, each at the best value in its range.${leftLine}`,
      };
    default:
      return {
        title: 'Full',
        blurb: `As much of the ${words.label} list as the budget covers, with the better option where it fits.${leftLine}`,
      };
  }
}

function toKit(tier, goal, budget, groups, selection) {
  const chosen = groups
    .filter((group) => selection.has(group.categoryId))
    .map((group) => group.options[selection.get(group.categoryId)]);
  const items = chosen.map(({ row, verdict }) => ({
    product: toProductSummary(row, verdict),
    reason: reasonFor(row, verdict),
  }));
  const total = items.reduce((sum, item) => sum + item.product.price, 0);
  const mrpTotal = items.reduce((sum, item) => sum + item.product.mrp, 0);
  return { tier, ...describeTier(tier, goal, { count: items.length, total, budget }), items, total, mrpTotal };
}

/**
 * KitResponse for a KitRequest that has already been validated:
 *   { goal, budget, vehicleId?, bodyType?, exclude? }
 * An unknown vehicleId is a 400 on `vehicleId`. No candidates gives `kits: []`.
 */
export function buildKits(ctx, request) {
  const goal = request.goal;
  const budget = Math.trunc(Number(request.budget));
  const exclude = [...new Set((request.exclude ?? []).map(Number).filter((id) => Number.isSafeInteger(id) && id > 0))];

  let vehicle = null;
  if (request.vehicleId !== undefined && request.vehicleId !== null) {
    vehicle = getVehicleRow(ctx, request.vehicleId);
    if (!vehicle) throw badRequest('Check the details and try again.', { vehicleId: 'We do not know that car. Pick it again.' });
  }
  const bodyType = vehicle ? null : (request.bodyType ?? null);

  const groups = groupCandidates(ctx, loadCandidates(ctx, { goal, vehicle, bodyType, exclude }));

  const essential = essentialSelection(groups, Math.floor(budget * TIER_SHARE.essential));
  const smart = smartSelection(groups, essential, Math.floor(budget * TIER_SHARE.smart));
  const full = fullSelection(groups, smart, budget);

  const kits = [];
  const seen = new Set();
  for (const [tier, selection] of [['essential', essential], ['smart', smart], ['full', full]]) {
    if (selection.size < 2) continue;
    const kit = toKit(tier, goal, budget, groups, selection);
    const key = kit.items.map((item) => item.product.id).sort((a, b) => a - b).join(',');
    if (seen.has(key)) continue;
    seen.add(key);
    kits.push(kit);
  }

  return { goal, budget, vehicle: vehicle ? toVehicle(vehicle) : null, kits };
}
