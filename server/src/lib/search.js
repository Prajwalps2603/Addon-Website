/**
 * Desi search: the words a shopper types, turned into the products they meant.
 *
 *   expandQuery(ctx, q)            { terms, understoodAs }: synonyms applied (multi-word phrases first),
 *                                  lower-cased, plurals stripped. understoodAs is null unless a synonym changed the query.
 *   searchProducts(ctx, q, opts)   relevance scores for every active product that matches, with car words
 *                                  ("swift", "creta") read as a hint about the car rather than required text.
 *   matchCategories / matchVehicles  for GET /api/search/suggest.
 *   logSearch(ctx, ...)            one search_log row.
 *
 * Matching runs in JavaScript over an in-memory index of the active catalogue (name, brand, tags, category names,
 * SKU and short description). The index is rebuilt only when a cheap signature of the catalogue changes, so a
 * few thousand products cost one small aggregate query per search.
 */
import { jsonArray, stringList, toVehicle } from './mappers.js';

const STOPWORDS = new Set(['a', 'an', 'the', 'for', 'and', 'of', 'with', 'to', 'in', 'on', 'my', 'me', 'ka', 'ki', 'ke', 'wala', 'wali', 'chahiye']);

// Field weights: a word in the name beats one in the SKU, tags, brand or category, which beat the description.
const WEIGHT = { name: 10, sku: 9, tags: 6, brand: 5, category: 5, description: 2 };
// Match quality: the whole word, the start of a word, one character off.
const QUALITY = { exact: 1, prefix: 0.6, typo: 0.5 };

// First words of model names that do not name a car on their own.
const VAGUE_MODEL_WORDS = new Set(['grand', 'urban', 'super', 'royal', 'new', 'golf']);

const PREFIX_MIN = 3;
const TYPO_MIN = 5;

// ---------------------------------------------------------------------------
// Words
// ---------------------------------------------------------------------------

/** Lower case, every run of punctuation or spaces turned into one space, trimmed. Keeps letters of any script. */
export function normalizeText(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Strips an English plural: wheels > wheel, accessories > accessory, glasses > glass. Leaves short words and codes alone. */
export function stem(word) {
  if (word.length <= 3 || /\d/.test(word)) return word;
  if (word.endsWith('ies') && word.length > 4) return `${word.slice(0, -3)}y`;
  if (/(sses|ches|shes|xes|zes)$/.test(word)) return word.slice(0, -2);
  if (/(ss|us|is)$/.test(word)) return word;
  if (word.endsWith('s')) return word.slice(0, -1);
  return word;
}

/** Normalised, stemmed words of a text. */
export function tokenize(value) {
  const text = normalizeText(value);
  return text === '' ? [] : text.split(' ').map(stem);
}

/** True when a and b are at most one edit apart (insert, delete, substitute, or swap two neighbours). */
export function withinOneEdit(a, b) {
  if (a === b) return true;
  const la = a.length;
  const lb = b.length;
  if (Math.abs(la - lb) > 1) return false;
  let i = 0;
  while (i < la && i < lb && a[i] === b[i]) i += 1;
  if (la === lb) {
    if (a.slice(i + 1) === b.slice(i + 1)) return true; // one substitution
    return a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2); // one swap
  }
  return la > lb ? a.slice(i + 1) === b.slice(i) : a.slice(i) === b.slice(i + 1);
}

// ---------------------------------------------------------------------------
// expandQuery
// ---------------------------------------------------------------------------

function preparedSynonyms(ctx) {
  const list = ctx.settings.get().searchSynonyms ?? [];
  const prepared = [];
  for (const entry of list) {
    const says = tokenize(entry?.says);
    const means = normalizeText(entry?.means);
    if (says.length === 0 || means === '') continue;
    // "alloys" means "alloy wheel": the shopper's word is already in the meaning, so it changes nothing worth saying.
    const meansStems = new Set(tokenize(means));
    if (says.every((word) => meansStems.has(word))) continue;
    prepared.push({ says, means });
  }
  // Longest phrases first, so "free flow" wins over a one-word rule that shares its first word.
  return prepared.sort((a, b) => b.says.length - a.says.length);
}

/**
 * The query as the catalogue understands it.
 *   terms        stemmed, lower-case words to look for (stop words dropped, repeats removed, in query order)
 *   understoodAs the rewritten query when a synonym changed it ("dikki light" gives "boot light"), else null
 */
export function expandQuery(ctx, q) {
  const { terms, understoodAs } = expand(ctx, q);
  return { terms, understoodAs };
}

// expandQuery plus, for each term, the length of the word as typed (typo tolerance goes by that: "whels" is 5 letters).
function expand(ctx, q) {
  const words = normalizeText(q).split(' ').filter(Boolean);
  if (words.length === 0) return { terms: [], understoodAs: null, typedLength: new Map() };
  const stems = words.map(stem);
  const synonyms = preparedSynonyms(ctx);

  const out = [];
  let changed = false;
  for (let i = 0; i < words.length; ) {
    const hit = synonyms.find((syn) => syn.says.every((word, offset) => stems[i + offset] === word));
    if (hit) {
      out.push(...hit.means.split(' '));
      i += hit.says.length;
      changed = true;
    } else {
      out.push(words[i]);
      i += 1;
    }
  }

  const terms = [];
  const typedLength = new Map();
  for (const word of out) {
    const term = stem(word);
    if (STOPWORDS.has(term)) continue;
    if (!terms.includes(term)) terms.push(term);
    typedLength.set(term, Math.max(typedLength.get(term) ?? 0, word.length));
  }
  return { terms, understoodAs: changed ? out.join(' ') : null, typedLength };
}

// ---------------------------------------------------------------------------
// The index
// ---------------------------------------------------------------------------

const SIGNATURE_SQL = `SELECT
  (SELECT COUNT(*) || ':' || TOTAL(id) || ':' || IFNULL(MAX(updated_at), '') || ':' ||
     TOTAL(length(name) + length(brand) + length(tags) + length(short_description) + length(sku) + category_id * 7 + is_active * 13
           + length(fitment_type) + length(body_types) + length(pcd))
   FROM products) || '|' ||
  (SELECT COUNT(*) || ':' || TOTAL(id + length(name) + length(slug) + IFNULL(parent_id, 0) * 3 + is_active * 5) FROM categories) || '|' ||
  (SELECT COUNT(*) || ':' || TOTAL(id + length(make) + length(model) + length(make_slug) + length(model_slug) + length(pcd)
     + length(body_type) + year_from + is_popular * 3) FROM vehicles) AS sig`;

const indexes = new WeakMap();

function addPosting(postings, token, productIndex, weight) {
  let byProduct = postings.get(token);
  if (!byProduct) {
    byProduct = new Map();
    postings.set(token, byProduct);
  }
  if ((byProduct.get(productIndex) ?? 0) < weight) byProduct.set(productIndex, weight);
}

function buildIndex(ctx) {
  const rows = ctx.db.all(
    `SELECT p.id, p.name, p.brand, p.tags, p.sku, p.short_description, p.fitment_type, p.body_types, p.pcd,
            c.name AS category_name, c.slug AS category_slug, pc.name AS parent_name, pc.slug AS parent_slug
     FROM products p
     JOIN categories c ON c.id = p.category_id
     LEFT JOIN categories pc ON pc.id = c.parent_id
     WHERE p.is_active = 1`,
  );
  const products = [];
  const postings = new Map(); // token -> Map(product index -> best field weight)
  for (const row of rows) {
    const index = products.length;
    const skuText = normalizeText(row.sku);
    products.push({
      id: row.id,
      nameText: normalizeText(row.name),
      skuCompact: skuText.replaceAll(' ', ''),
      fitmentType: row.fitment_type,
      bodyTypes: stringList(row.body_types),
      pcd: normalizeText(row.pcd).replaceAll(' ', ''),
    });
    const fields = [
      ['name', row.name],
      ['brand', row.brand],
      ['tags', jsonArray(row.tags).join(' ')],
      ['category', `${row.category_name} ${row.category_slug} ${row.parent_name ?? ''} ${row.parent_slug ?? ''}`],
      ['sku', row.sku],
      ['description', row.short_description],
    ];
    for (const [field, value] of fields) {
      for (const token of tokenize(value)) addPosting(postings, token, index, WEIGHT[field]);
    }
    if (skuText.includes(' ')) addPosting(postings, skuText.replaceAll(' ', ''), index, WEIGHT.sku);
  }

  const categories = ctx.db
    .all(
      `SELECT c.id, c.slug, c.name, c.parent_id, pc.name AS parent_name, pc.slug AS parent_slug
       FROM categories c LEFT JOIN categories pc ON pc.id = c.parent_id
       WHERE c.is_active = 1 AND (pc.id IS NULL OR pc.is_active = 1)
       ORDER BY c.parent_id IS NOT NULL, c.sort_order, c.name`,
    )
    .map((row) => ({ ...row, tokens: tokenize(`${row.name} ${row.slug}`) }));

  const vehicleRows = ctx.db.all('SELECT * FROM vehicles ORDER BY is_popular DESC, year_from DESC, id DESC');
  const models = new Map(); // key (stemmed words joined by a space, or run together) -> [{ makeSlug, modelSlug }]
  const makes = new Map(); // key -> makeSlug
  for (const row of vehicleRows) {
    const modelTokens = tokenize(row.model);
    const makeTokens = tokenize(row.make);
    const model = { makeSlug: row.make_slug, modelSlug: row.model_slug };
    const addModel = (key) => {
      const list = models.get(key) ?? [];
      if (!list.some((entry) => entry.makeSlug === model.makeSlug && entry.modelSlug === model.modelSlug)) list.push(model);
      models.set(key, list);
    };
    if (modelTokens.length > 0) {
      addModel(modelTokens.join(' '));
      if (modelTokens.length > 1) addModel(modelTokens.join(''));
      // "alto" for Alto K10, "scorpio" for Scorpio N; not "grand" or "urban", which say nothing alone.
      const [first] = modelTokens;
      if (modelTokens.length > 1 && first.length >= 4 && !/\d/.test(first) && !VAGUE_MODEL_WORDS.has(first)) addModel(first);
    }
    const slugTokens = tokenize(row.model_slug);
    if (slugTokens.length > 0) addModel(slugTokens.join(' '));
    if (makeTokens.length > 0) {
      makes.set(makeTokens.join(' '), row.make_slug);
      if (makeTokens.length > 1) makes.set(makeTokens.join(''), row.make_slug);
      // "maruti" alone names Maruti Suzuki; short words such as "land" are too vague on their own.
      for (const token of makeTokens) if (token.length >= 5 && !makes.has(token)) makes.set(token, row.make_slug);
    }
  }

  return { products, postings, vocabulary: [...postings.keys()], categories, vehicleRows, models, makes };
}

function getIndex(ctx) {
  const { sig } = ctx.db.get(SIGNATURE_SQL);
  const cached = indexes.get(ctx);
  if (cached && cached.sig === sig) return cached.index;
  const index = buildIndex(ctx);
  indexes.set(ctx, { sig, index });
  return index;
}

// ---------------------------------------------------------------------------
// Matching
// ---------------------------------------------------------------------------

/** How well a query term matches a word: 'exact', 'prefix', 'typo' or null. */
function matchQuality(term, token, typedLength = term.length) {
  if (token === term) return 'exact';
  const numeric = /^\d+$/.test(term);
  if (!numeric && term.length >= PREFIX_MIN && token.startsWith(term)) return 'prefix';
  if (!numeric && typedLength >= TYPO_MIN && token.length >= TYPO_MIN - 1 && withinOneEdit(term, token)) return 'typo';
  return null;
}

/** Map of product index -> best score for one term across all fields. */
function scoreTerm(index, term, typedLength) {
  const scores = new Map();
  for (const token of index.vocabulary) {
    const quality = matchQuality(term, token, typedLength);
    if (!quality) continue;
    for (const [productIndex, weight] of index.postings.get(token)) {
      const score = weight * QUALITY[quality];
      if ((scores.get(productIndex) ?? 0) < score) scores.set(productIndex, score);
    }
  }
  return scores;
}

/** Splits the terms into car words (makes and models) and the rest. */
function findVehicleWords(index, terms) {
  const modelHits = [];
  const makeHits = new Set();
  const used = new Set();
  for (let i = 0; i < terms.length; i += 1) {
    if (used.has(i)) continue;
    let matched = false;
    for (let length = Math.min(3, terms.length - i); length >= 1 && !matched; length -= 1) {
      const slice = terms.slice(i, i + length);
      const models = index.models.get(slice.join(' ')) ?? (length > 1 ? index.models.get(slice.join('')) : undefined);
      if (models) {
        modelHits.push(...models);
        for (let k = i; k < i + length; k += 1) used.add(k);
        matched = true;
        continue;
      }
      const make = index.makes.get(slice.join(' '));
      if (make) {
        makeHits.add(make);
        for (let k = i; k < i + length; k += 1) used.add(k);
        matched = true;
      }
    }
  }
  return {
    vehicleTerms: terms.filter((_, i) => used.has(i)),
    productTerms: terms.filter((_, i) => !used.has(i)),
    modelHits,
    makeHits: [...makeHits],
  };
}

function hintedVehicles(index, { modelHits, makeHits }, vehicleRow) {
  let rows = [];
  if (modelHits.length > 0) {
    const makesNamed = new Set(makeHits);
    rows = index.vehicleRows.filter((row) =>
      modelHits.some((model) => row.make_slug === model.makeSlug && row.model_slug === model.modelSlug),
    );
    // A make named beside a model narrows to that make when it can.
    if (makesNamed.size > 0) {
      const narrowed = rows.filter((row) => makesNamed.has(row.make_slug));
      if (narrowed.length > 0) rows = narrowed;
    }
    // The shopper's own car, when it is one of the generations named, is the one that counts.
    if (vehicleRow && rows.some((row) => row.id === vehicleRow.id)) rows = rows.filter((row) => row.id === vehicleRow.id);
  } else if (makeHits.length > 0) {
    rows = index.vehicleRows.filter((row) => makeHits.includes(row.make_slug));
  }
  return rows;
}

/**
 * Relevance scores for the active products that match q.
 *
 * Returns { terms, understoodAs, scores, vehicleHint } where `scores` is a Map of product id to score
 * (higher is better), or null when q holds nothing to search for (every product qualifies).
 * Every product word in q must match (by whole word, word start, or one typo for words of 5+ letters).
 * Car words ("swift", "maruti creta") are not required in the product text: parts that fit that car
 * score higher, parts that mention it score a little higher, and parts made for other cars score lower.
 * A query of car words alone returns the parts listed for that car or that mention it.
 */
export function searchProducts(ctx, q, { vehicleRow = null } = {}) {
  const { terms, understoodAs, typedLength } = expand(ctx, q);
  if (terms.length === 0) return { terms, understoodAs, scores: null, vehicleHint: null };

  const index = getIndex(ctx);
  const words = findVehicleWords(index, terms);
  const hinted = hintedVehicles(index, words, vehicleRow);

  // Every product word must match.
  let candidates = null; // Map product index -> score
  for (const term of words.productTerms) {
    const termScores = scoreTerm(index, term, typedLength.get(term));
    if (candidates === null) candidates = termScores;
    else {
      const next = new Map();
      for (const [productIndex, score] of candidates) {
        const add = termScores.get(productIndex);
        if (add !== undefined) next.set(productIndex, score + add);
      }
      candidates = next;
    }
    if (candidates.size === 0) break;
  }

  // Parts that mention the car word somewhere.
  const mentions = new Set();
  for (const term of words.vehicleTerms) {
    for (const productIndex of index.postings.get(term)?.keys() ?? []) mentions.add(productIndex);
  }

  let fitRows = new Map();
  if (hinted.length > 0) {
    fitRows = new Map(
      ctx.db
        .all(
          `SELECT product_id, MAX(fit_type <> 'no') AS fits
           FROM product_fitments WHERE vehicle_id IN (SELECT value FROM json_each(?))
           GROUP BY product_id`,
          [hinted.map((row) => row.id)],
        )
        .map((row) => [row.product_id, Number(row.fits) === 1]),
    );
  }

  if (candidates === null) {
    // Only car words: the parts listed for that car, and those that name it.
    candidates = new Map();
    for (const productIndex of mentions) candidates.set(productIndex, 0);
    index.products.forEach((product, productIndex) => {
      if (fitRows.get(product.id) === true) candidates.set(productIndex, 0);
    });
  }

  const phrase = words.productTerms.join(' ');
  const queryCompact = normalizeText(q).replaceAll(' ', '');
  const bodyTypes = new Set(hinted.map((row) => row.body_type));
  const pcds = new Set(hinted.map((row) => normalizeText(row.pcd).replaceAll(' ', '')).filter(Boolean));

  const scores = new Map();
  for (const [productIndex, base] of candidates) {
    const product = index.products[productIndex];
    let score = base;
    if (phrase && product.nameText.includes(normalizeText(phrase))) score += 5;
    if (queryCompact && product.skuCompact === queryCompact) score += 100;

    if (words.vehicleTerms.length > 0) {
      if (mentions.has(productIndex)) score += 4;
      if (hinted.length > 0) {
        const fits = fitRows.get(product.id);
        if (fits === true) score += 8;
        else if (fits === false) score *= 0.3;
        else if (product.fitmentType === 'universal' || product.fitmentType === 'none') score += 1;
        else if (product.fitmentType === 'body_type') {
          if (product.bodyTypes.some((bodyType) => bodyTypes.has(bodyType))) score += 2;
          else score *= 0.3;
        } else if (product.fitmentType === 'pcd') {
          if (pcds.size === 0 || !product.pcd) score += 0;
          else if (pcds.has(product.pcd)) score += 2;
          else score *= 0.3;
        } else if (product.fitmentType === 'vehicle' && !mentions.has(productIndex)) {
          score *= 0.3;
        }
      }
    }
    scores.set(product.id, Math.round(score * 1000) / 1000);
  }

  return {
    terms,
    understoodAs,
    scores,
    vehicleHint: words.vehicleTerms.length > 0 ? { words: words.vehicleTerms, vehicleIds: hinted.map((row) => row.id) } : null,
  };
}

// ---------------------------------------------------------------------------
// Suggestions
// ---------------------------------------------------------------------------

/** Active categories whose name matches the most terms: [{ slug, name, parentName }]. */
export function matchCategories(ctx, terms, limit = 4) {
  if (terms.length === 0) return [];
  const index = getIndex(ctx);
  const ranked = [];
  index.categories.forEach((category, order) => {
    let hits = 0;
    for (const term of terms) if (category.tokens.some((token) => matchQuality(term, token))) hits += 1;
    if (hits > 0) ranked.push({ category, hits, order });
  });
  ranked.sort((a, b) => b.hits - a.hits || a.order - b.order);
  return ranked.slice(0, limit).map(({ category }) => ({
    slug: category.slug,
    name: category.name,
    parentName: category.parent_name ?? null,
    // So the client can link /shop/<parent>/<sub> without loading the category tree.
    parentSlug: category.parent_slug ?? null,
  }));
}

/** Vehicles (generations) whose make or model a term names or starts: model matches first, popular first, newest first. */
export function matchVehicles(ctx, terms, limit = 4) {
  if (terms.length === 0) return [];
  const index = getIndex(ctx);
  const ranked = [];
  index.vehicleRows.forEach((row, order) => {
    const modelTokens = tokenize(`${row.model} ${row.model_slug}`);
    const makeTokens = tokenize(`${row.make} ${row.make_slug}`);
    const fits = (tokens) => terms.some((term) => tokens.some((token) => token === term || (term.length >= 2 && token.startsWith(term))));
    const model = fits(modelTokens);
    const make = fits(makeTokens);
    if (model || make) ranked.push({ row, rank: (model ? 2 : 0) + (make ? 1 : 0), order });
  });
  ranked.sort((a, b) => b.rank - a.rank || a.order - b.order);
  return ranked.slice(0, limit).map(({ row }) => toVehicle(row));
}

// ---------------------------------------------------------------------------
// Logging
// ---------------------------------------------------------------------------

/** Records a storefront search for the demand radar. */
export function logSearch(ctx, q, resultCount, vehicleId = null) {
  const query = String(q ?? '').trim().replace(/\s+/g, ' ').toLowerCase().slice(0, 200);
  if (query === '') return;
  ctx.db.run('INSERT INTO search_log (query, result_count, vehicle_id, created_at) VALUES (?, ?, ?, ?)', [
    query,
    resultCount,
    vehicleId ?? null,
    ctx.now(),
  ]);
}
