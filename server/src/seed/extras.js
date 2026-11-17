// Everything that hangs off the products: relations, Pick of Three, the live Friday Five,
// sample fitted reports and questions, coupons, house builds and the promo photos.
import { uniqueSlug } from '../lib/ids.js';
import { vehicleLabel } from '../lib/mappers.js';
import { BUILDS, COUPONS, DROP, PICKS, QUESTIONS, RELATIONS, REPORTS } from './content/extras.js';
import { ago, between, hash, productIdOf } from './shared.js';

const DROP_STARTED_DAYS_AGO = 1;
const DROP_ENDS_IN_DAYS = 3;

// What each default promo banner should show, as words to look for in an editorial photo's file name and description.
const PROMO_SUBJECTS = {
  'build-bay': ['modified', 'lowered', 'splitter', 'alloy', 'coupe', 'saloon'],
  'new-car': ['open-road', 'road', 'expressway', 'highway', 'hills'],
  'friday-five': ['wheel', 'caliper', 'close-up', 'closeup', 'workshop', 'garage'],
};

function seedRelations(ctx, productIds) {
  for (const relation of RELATIONS) {
    ctx.db.run('INSERT INTO product_relations (product_id, related_id, kind, note) VALUES (?, ?, ?, ?)', [
      productIdOf(productIds, relation.sku, 'RELATIONS'),
      productIdOf(productIds, relation.relatedSku, 'RELATIONS'),
      relation.kind,
      relation.note,
    ]);
  }
  return RELATIONS.length;
}

function seedPicks(ctx, productIds, categoryIds) {
  let picks = 0;
  for (const [slug, tiers] of Object.entries(PICKS)) {
    const categoryId = categoryIds.get(slug);
    if (!categoryId) throw new Error(`Seed content (PICKS) names a subcategory that is not in the catalogue: ${slug}`);
    for (const [tier, pick] of Object.entries(tiers)) {
      ctx.db.run('INSERT INTO category_picks (category_id, tier, product_id, reason) VALUES (?, ?, ?, ?)', [
        categoryId,
        tier,
        productIdOf(productIds, pick.sku, `PICKS.${slug}`),
        pick.reason,
      ]);
      picks += 1;
    }
  }
  return picks;
}

// Started yesterday and ends in three days, so a new store opens with a live drop and a real countdown.
function seedDrop(ctx, productIds, nowMs) {
  const dropId = ctx.db.run(
    'INSERT INTO drops (title, note, starts_at, ends_at, is_active, is_demo, created_at) VALUES (?, ?, ?, ?, 1, 1, ?)',
    [DROP.title, DROP.note, ago(nowMs, DROP_STARTED_DAYS_AGO), ago(nowMs, -DROP_ENDS_IN_DAYS), ago(nowMs, DROP_STARTED_DAYS_AGO)],
  ).lastInsertRowid;
  for (const item of DROP.items) {
    ctx.db.run('INSERT INTO drop_items (drop_id, product_id, percent_off, reason) VALUES (?, ?, ?, ?)', [
      dropId,
      productIdOf(productIds, item.sku, 'DROP'),
      item.percentOff,
      item.reason,
    ]);
  }
  return DROP.items.length;
}

// Sample reports are approved and marked is_demo, so the storefront labels them "Sample".
// No order stands behind them, so they are not marked as verified purchases.
function seedReports(ctx, productIds, nowMs) {
  REPORTS.forEach((report, index) => {
    const key = `report:${index}:${report.sku}`;
    ctx.db.run(
      `INSERT INTO reviews (product_id, author_name, vehicle, rating, fitted_by, time_minutes, difficulty, fitted_ok, issues, body,
         photos, is_verified_purchase, status, is_demo, created_at)
       VALUES (:productId, :authorName, :vehicle, :rating, :fittedBy, :timeMinutes, :difficulty, :fittedOk, :issues, :body,
         '[]', 0, 'approved', 1, :createdAt)`,
      {
        productId: productIdOf(productIds, report.sku, 'REPORTS'),
        authorName: report.authorName,
        vehicle: report.vehicle,
        rating: report.rating,
        fittedBy: report.fittedBy,
        timeMinutes: report.timeMinutes,
        difficulty: report.difficulty,
        fittedOk: report.fittedOk,
        issues: report.issues,
        body: report.body,
        createdAt: ago(nowMs, between(`${key}:day`, 2, 59), hash(`${key}:hour`) % 14),
      },
    );
  });
  ctx.db.run(
    `UPDATE products SET
       rating_count = (SELECT COUNT(*) FROM reviews r WHERE r.product_id = products.id AND r.status = 'approved'),
       rating_avg = COALESCE((SELECT ROUND(AVG(r.rating), 2) FROM reviews r WHERE r.product_id = products.id AND r.status = 'approved'), 0)`,
  );
  return REPORTS.length;
}

// The note the Fitment Desk would keep: the answer without its opening "Yes." or "No.".
const fitNote = (answer) => answer.replace(/^(Yes|No)\.\s+/, '');

// A fitment answer is also written to product_fitments, as the Fitment Desk does, so the store
// gives that verdict to the next shopper with the same car.
function seedQuestions(ctx, productIds, vehicles, nowMs) {
  QUESTIONS.forEach((question, index) => {
    const key = `question:${index}:${question.sku}`;
    const productId = productIdOf(productIds, question.sku, 'QUESTIONS');
    const askedDaysAgo = between(`${key}:day`, 3, 50);
    const askedHoursAgo = 30 + (hash(`${key}:hour`) % 12);

    let vehicle = null;
    if (question.kind === 'fitment') {
      const { make, model, yearFrom } = question.vehicle;
      vehicle = vehicles.startingIn(make, model, yearFrom);
      if (!vehicle) throw new Error(`Seed content (QUESTIONS) names a car that is not in the catalogue: ${make}/${model} ${yearFrom}`);
      ctx.db.run(
        `INSERT INTO product_fitments (product_id, vehicle_id, fit_type, note, is_verified) VALUES (?, ?, ?, ?, ?)
         ON CONFLICT (product_id, vehicle_id) DO UPDATE SET fit_type = excluded.fit_type, note = excluded.note, is_verified = excluded.is_verified`,
        [productId, vehicle.id, question.answerFitType, fitNote(question.answer), question.answerFitType === 'direct'],
      );
    }

    ctx.db.run(
      `INSERT INTO product_questions (product_id, kind, vehicle_id, vehicle_label, author_name, phone, question, answer,
         answer_fit_type, answered_at, status, is_demo, created_at)
       VALUES (:productId, :kind, :vehicleId, :vehicleLabel, :authorName, '', :question, :answer,
         :answerFitType, :answeredAt, 'published', 1, :createdAt)`,
      {
        productId,
        kind: question.kind,
        vehicleId: vehicle?.id ?? null,
        vehicleLabel: vehicle ? vehicleLabel(vehicle) : '',
        authorName: question.authorName,
        question: question.question,
        answer: question.answer,
        answerFitType: question.answerFitType ?? null,
        // Answered a few hours to a day after it was asked.
        answeredAt: ago(nowMs, askedDaysAgo, askedHoursAgo - between(`${key}:reply`, 2, 26)),
        createdAt: ago(nowMs, askedDaysAgo, askedHoursAgo),
      },
    );
  });
  return QUESTIONS.length;
}

// A code the owner has already created is left alone.
function seedCoupons(ctx, nowMs) {
  let coupons = 0;
  for (const coupon of COUPONS) {
    coupons += ctx.db.run(
      `INSERT OR IGNORE INTO coupons (code, description, type, value, min_order, max_discount, starts_at, ends_at, usage_limit, is_active, is_demo, created_at)
       VALUES (:code, :description, :type, :value, :minOrder, :maxDiscount, :startsAt, :endsAt, :usageLimit, :isActive, 1, :createdAt)`,
      {
        code: coupon.code,
        description: coupon.description,
        type: coupon.type,
        value: coupon.value,
        minOrder: coupon.minOrder,
        maxDiscount: coupon.maxDiscount,
        startsAt: coupon.startsAt,
        endsAt: coupon.endsAt,
        usageLimit: coupon.usageLimit,
        isActive: coupon.isActive,
        createdAt: ago(nowMs, 30),
      },
    ).changes;
  }
  return coupons;
}

// House builds: the content names parts by SKU, the stored build points at product ids.
function seedBuilds(ctx, productIds, nowMs) {
  const authorName = ctx.settings.get().storeName;
  BUILDS.forEach((build, index) => {
    const where = `BUILDS "${build.title}"`;
    const parts = Object.fromEntries(
      Object.entries(build.state.parts).map(([slot, { sku, ...part }]) => [slot, { ...part, productId: productIdOf(productIds, sku, where) }]),
    );
    ctx.db.run(
      `INSERT INTO builds (slug, title, author_name, vehicle_label, state, product_ids, status, is_house, is_demo, created_at)
       VALUES (:slug, :title, :authorName, :vehicleLabel, :state, :productIds, 'approved', 1, 1, :createdAt)`,
      {
        slug: uniqueSlug(ctx, 'builds', build.title),
        title: build.title,
        authorName,
        vehicleLabel: build.vehicleLabel,
        state: { ...build.state, parts },
        productIds: build.skus.map((sku) => productIdOf(productIds, sku, where)),
        createdAt: ago(nowMs, 5 + index * 6, hash(`build:${build.title}`) % 10),
      },
    );
  });
  return BUILDS.length;
}

function bestPhotoFor(words, tone, candidates) {
  let best = null;
  let bestScore = 0;
  for (const photo of candidates) {
    const text = `${photo.url} ${photo.shows ?? ''}`.toLowerCase();
    const hits = words.filter((word) => text.includes(word)).length;
    const score = hits === 0 ? 0 : hits + (photo.tone === tone ? 0.5 : 0);
    if (score > bestScore) {
      best = photo;
      bestScore = score;
    }
  }
  return best;
}

// Gives the three default promo banners a photo each, where the photo library has one that suits.
// A banner the owner has already given a picture keeps it.
function seedPromoImages(ctx, photos, log) {
  if (photos.editorial.length === 0) return 0;
  const promos = ctx.settings.get().promos;
  const taken = new Set(promos.map((promo) => promo.image).filter(Boolean));
  let filled = 0;

  const next = promos.map((promo) => {
    const words = PROMO_SUBJECTS[promo.id];
    if (!words || promo.image) return promo;
    const photo = bestPhotoFor(words, promo.tone === 'dark' ? 'dark' : 'light', photos.editorial.filter((candidate) => !taken.has(candidate.url)));
    if (!photo) return promo;
    taken.add(photo.url);
    filled += 1;
    return { ...promo, image: photo.url };
  });
  if (filled === 0) return 0;

  try {
    ctx.settings.update({ allPromos: next });
  } catch (err) {
    // Stored settings the owner has to correct first must not stop the catalogue from loading.
    log(`[seed] Promo photos were not set: ${err.message}`);
    return 0;
  }
  return filled;
}

/**
 * Applies the content of content/extras.js on top of the seeded products.
 *   env: { photos, nowMs, log, categoryIds, vehicles, productIds }
 * Returns how many rows of each kind were written.
 */
export function seedExtras(ctx, { photos, nowMs, log, categoryIds, vehicles, productIds }) {
  return {
    relations: seedRelations(ctx, productIds),
    picks: seedPicks(ctx, productIds, categoryIds),
    dropItems: seedDrop(ctx, productIds, nowMs),
    reports: seedReports(ctx, productIds, nowMs),
    questions: seedQuestions(ctx, productIds, vehicles, nowMs),
    coupons: seedCoupons(ctx, nowMs),
    builds: seedBuilds(ctx, productIds, nowMs),
    promoImages: seedPromoImages(ctx, photos, log),
  };
}
