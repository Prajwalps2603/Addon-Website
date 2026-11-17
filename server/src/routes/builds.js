import crypto from 'node:crypto';
import { Router } from 'express';
import * as z from 'zod';
import { getProductRowsByIds, getProductsByIds } from '../lib/catalog.js';
import { badRequest, notFound } from '../lib/errors.js';
import { slugify, uniqueSlug } from '../lib/ids.js';
import { idList, toBuild } from '../lib/mappers.js';
import { limiters } from '../lib/rateLimit.js';
import { paginated, paginationOf, parse } from '../lib/validate.js';

// Build Bay style keys: BUILD_SPEC section 7. The seed, the art and the page use exactly these.
export const BUILD_SLOTS = {
  wheels: { styles: ['five-spoke', 'multi-spoke', 'mesh', 'split-spoke', 'turbine', 'steelie'] },
  spoiler: { styles: ['lip', 'ducktail', 'roof', 'gt-wing'] },
  splitter: { styles: ['lip', 'race'] },
  skirts: { styles: ['blade'] },
  diffuser: { styles: ['fins'] },
  exhaust: { styles: ['single', 'twin', 'quad'] },
  roofRack: { styles: ['crossbars', 'basket', 'box'] },
  lightBar: { styles: ['roof-bar', 'bumper-pods'] },
  underglow: { styles: ['glow'], needsColor: true },
  decal: { styles: ['stripe', 'side-graphic'], needsColor: true },
  bullBar: { styles: ['bar'], suvOnly: true },
  sideStep: { styles: ['board'], suvOnly: true },
  snorkel: { styles: ['snorkel'], suvOnly: true },
  lowering: { styles: ['springs', 'coilover'] },
};

const MAX_BUILD_PRODUCTS = 40;
const GALLERY_PAGE = paginationOf({ defaultLimit: 12, maxLimit: 48 });

const hexColor = z
  .string({ error: 'Pick a colour.' })
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, { error: 'Use a hex colour such as #1a1a1a.' })
  .transform((value) => value.toLowerCase());

const productIdSchema = z.int({ error: 'That product id is not valid.' }).positive({ error: 'That product id is not valid.' });

function partSchema(slot) {
  const { styles, needsColor } = BUILD_SLOTS[slot];
  return z.strictObject({
    style: z.enum(styles, { error: `Choose one of: ${styles.join(', ')}.` }),
    color: needsColor ? hexColor : hexColor.optional(),
    productId: productIdSchema.nullish(),
  });
}

const partsSchema = z.strictObject(
  Object.fromEntries(Object.keys(BUILD_SLOTS).map((slot) => [slot, partSchema(slot).optional()])),
  { error: 'That part slot does not exist.' },
);

const buildStateSchema = z
  .strictObject({
    bodyType: z.enum(['hatchback', 'sedan', 'suv'], { error: 'Choose a hatchback, sedan or SUV.' }),
    paint: hexColor,
    rideHeight: z.int({ error: 'Enter a whole number.' }).min(-2).max(2),
    wheelSize: z.int({ error: 'Enter a whole number.' }).min(0).max(2),
    night: z.boolean({ error: 'This must be on or off.' }),
    tint: z.int({ error: 'Enter a whole number.' }).min(0).max(60),
    parts: partsSchema,
  })
  .superRefine((state, check) => {
    for (const [slot, rule] of Object.entries(BUILD_SLOTS)) {
      if (rule.suvOnly && state.parts[slot] && state.bodyType !== 'suv') {
        check.addIssue({ code: 'custom', path: ['parts', slot], message: 'This part is for SUVs only.' });
      }
    }
    if (state.parts.spoiler?.style === 'roof' && state.bodyType === 'sedan') {
      check.addIssue({ code: 'custom', path: ['parts', 'spoiler', 'style'], message: 'A roof spoiler suits hatchbacks and SUVs, not sedans.' });
    }
    if (state.parts.lowering && state.rideHeight > -1) {
      check.addIssue({ code: 'custom', path: ['rideHeight'], message: 'Lowering sets the ride height to -1 or -2.' });
    }
  });

const saveBuildSchema = z.object({
  title: z.string({ error: 'Give the build a name.' }).trim().min(2, { error: 'Give the build a name.' }).max(60),
  authorName: z.string().trim().max(60).default(''),
  vehicleLabel: z.string().trim().max(120).default(''),
  state: buildStateSchema,
  productIds: z.array(productIdSchema).max(MAX_BUILD_PRODUCTS).default([]),
  submitToGallery: z.boolean().default(false),
});

/** Builds through the mapper, with every build's products read in one query. */
function mapBuilds(ctx, rows) {
  const idsByRow = rows.map((row) => idList(row.product_ids));
  const summaries = new Map(getProductsByIds(ctx, idsByRow.flat()).map((product) => [product.id, product]));
  return rows.map((row, index) => toBuild(row, idsByRow[index].map((id) => summaries.get(id)).filter(Boolean)));
}

export default function buildsRoutes(ctx) {
  const router = Router();

  router.get('/', (req, res) => {
    const page = parse(GALLERY_PAGE, req.query);
    const { total } = ctx.db.get("SELECT COUNT(*) AS total FROM builds WHERE status = 'approved'");
    const rows = ctx.db.all(
      `SELECT * FROM builds WHERE status = 'approved'
       ORDER BY is_house DESC, created_at DESC, id DESC
       LIMIT ? OFFSET ?`,
      [page.limit, (page.page - 1) * page.limit],
    );
    res.json(paginated(mapBuilds(ctx, rows), total, page));
  });

  router.get('/:slug', (req, res) => {
    const slug = String(req.params.slug ?? '');
    const row = slug.length <= 120 ? ctx.db.get('SELECT * FROM builds WHERE slug = ?', [slug]) : undefined;
    if (!row) throw notFound('Build');
    res.json(mapBuilds(ctx, [row])[0]);
  });

  router.post('/', limiters.forms, (req, res) => {
    const input = parse(saveBuildSchema, req.body);
    const productIds = [...new Set(input.productIds)];

    // Every product named, at the top or on a part, must be on sale now.
    const partIds = Object.values(input.state.parts)
      .map((part) => part?.productId)
      .filter((id) => id !== null && id !== undefined);
    const rows = getProductRowsByIds(ctx, [...productIds, ...partIds]);
    const fields = {};
    const badTop = productIds.filter((id) => !rows.get(id)?.is_active);
    if (badTop.length > 0) fields.productIds = `Not on sale: ${badTop.join(', ')}`;
    for (const [slot, part] of Object.entries(input.state.parts)) {
      const id = part?.productId;
      if (id !== null && id !== undefined && !rows.get(id)?.is_active) fields[`state.parts.${slot}.productId`] = 'That product is not on sale.';
    }
    if (Object.keys(fields).length > 0) throw badRequest('Some parts in this build are not on sale. Pick them again.', fields);

    // A short random suffix keeps one person's "My Swift" from colliding with another's, and makes private links hard to guess.
    const base = `${slugify(input.title).slice(0, 60).replace(/-+$/, '') || 'build'}-${crypto.randomBytes(3).toString('hex')}`;
    const slug = uniqueSlug(ctx, 'builds', base);
    const status = input.submitToGallery ? 'pending' : 'private';
    ctx.db.run(
      `INSERT INTO builds (slug, title, author_name, vehicle_label, state, product_ids, status, is_house, is_demo, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 0, 0, ?)`,
      [slug, input.title, input.authorName, input.vehicleLabel, input.state, productIds, status, ctx.now()],
    );
    const row = ctx.db.get('SELECT * FROM builds WHERE slug = ?', [slug]);
    res.status(201).json(mapBuilds(ctx, [row])[0]);
  });

  return router;
}
