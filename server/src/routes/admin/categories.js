import { Router } from 'express';
import * as z from 'zod';
import { categoryTree, getCategory, getProductsByIds } from '../../lib/catalog.js';
import { badRequest, conflict, HttpError, notFound } from '../../lib/errors.js';
import { slugify, uniqueSlug } from '../../lib/ids.js';
import { toCategoryPick } from '../../lib/mappers.js';
import { idParam, parse } from '../../lib/validate.js';

const TIERS = ['sensible', 'sweet_spot', 'all_out'];
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const categorySchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .max(80)
    .optional()
    .refine((value) => !value || SLUG_PATTERN.test(value), { error: 'Use lower-case letters, numbers and single dashes.' }),
  parentId: z.int().positive().nullable().default(null),
  blurb: z.string().trim().max(400).default(''),
  artKind: z
    .string()
    .trim()
    .max(40)
    .transform((value) => value || 'generic')
    .default('generic'),
  image: z
    .string()
    .trim()
    .refine((value) => value === '' || /^\/\S*$/.test(value) || /^https:\/\/\S+$/.test(value), {
      error: 'Use an uploaded image (/uploads/...) or a full https:// address.',
    })
    .default(''),
  sortOrder: z.int().min(-10_000).max(10_000).default(0),
  isActive: z.boolean().default(true),
});

const picksSchema = z
  .object({
    picks: z
      .array(
        z.object({
          tier: z.enum(TIERS),
          productId: z.int().positive(),
          reason: z.string().trim().max(200).default(''),
        }),
      )
      .max(3),
  })
  .superRefine((input, ctx) => {
    const tiers = new Set();
    const products = new Set();
    input.picks.forEach((pick, index) => {
      if (tiers.has(pick.tier)) ctx.addIssue({ code: 'custom', path: ['picks', index, 'tier'], message: 'Each tier takes one product.' });
      if (products.has(pick.productId)) {
        ctx.addIssue({ code: 'custom', path: ['picks', index, 'productId'], message: 'Pick a different product for each tier.' });
      }
      tiers.add(pick.tier);
      products.add(pick.productId);
    });
  });

function slugConflict(slug) {
  const message = `Another category already uses the web address ${slug}.`;
  return new HttpError(409, 'conflict', message, { slug: message });
}

function loadCategory(ctx, id) {
  const category = getCategory(ctx, id, { includeInactive: true });
  if (!category) throw notFound('Category');
  return category;
}

/** Checks the parent and the slug for a create (id null) or update, and returns the slug to store. */
function checkCategory(ctx, input, id) {
  const { db } = ctx;
  if (input.parentId !== null) {
    if (input.parentId === id) throw badRequest('A category cannot sit inside itself.', { parentId: 'Choose another parent.' });
    const parent = db.get('SELECT id, parent_id FROM categories WHERE id = ?', [input.parentId]);
    if (!parent) throw badRequest('Choose a parent category.', { parentId: 'That category does not exist.' });
    if (parent.parent_id !== null) {
      throw badRequest('Categories go two levels deep.', { parentId: 'Choose a top-level category as the parent.' });
    }
    if (id !== null && db.get('SELECT 1 AS found FROM categories WHERE parent_id = ? LIMIT 1', [id])) {
      throw badRequest('This category has subcategories, so it must stay top-level.', { parentId: 'Move its subcategories first.' });
    }
  } else if (id !== null && db.get('SELECT 1 AS found FROM products WHERE category_id = ? LIMIT 1', [id])) {
    throw badRequest('Products live in subcategories, and this one has products.', { parentId: 'Keep a parent, or move its products first.' });
  }

  if (input.slug) {
    if (db.get('SELECT id FROM categories WHERE slug = ? AND id IS NOT ?', [input.slug, id])) throw slugConflict(input.slug);
    return input.slug;
  }
  if (id !== null) return db.get('SELECT slug FROM categories WHERE id = ?', [id]).slug;
  if (!slugify(input.name)) throw badRequest('Give the category a web address.', { slug: 'The name has no letters or numbers to make one from.' });
  return uniqueSlug(ctx, 'categories', input.name);
}

function columns(input, slug) {
  return {
    slug,
    name: input.name,
    parentId: input.parentId,
    blurb: input.blurb,
    artKind: input.artKind,
    image: input.image,
    sortOrder: input.sortOrder,
    isActive: input.isActive,
  };
}

function translateUnique(err, slug) {
  if (err?.code === 'ERR_SQLITE_ERROR' && err?.errcode === 2067) return slugConflict(slug);
  return err;
}

function loadPicks(ctx, categoryId) {
  const rows = ctx.db.all(
    `SELECT * FROM category_picks WHERE category_id = ?
     ORDER BY CASE tier WHEN 'sensible' THEN 0 WHEN 'sweet_spot' THEN 1 ELSE 2 END`,
    [categoryId],
  );
  const products = new Map(getProductsByIds(ctx, rows.map((row) => row.product_id), { includeInactive: true }).map((p) => [p.id, p]));
  return rows.filter((row) => products.has(row.product_id)).map((row) => toCategoryPick(row, products.get(row.product_id)));
}

export default function adminCategoriesRoutes(ctx) {
  const router = Router();

  router.get('/categories', (req, res) => {
    res.json(categoryTree(ctx, { includeInactive: true }));
  });

  router.post('/categories', (req, res) => {
    const input = parse(categorySchema, req.body);
    let slug = input.slug;
    let id;
    try {
      id = ctx.db.tx(() => {
        slug = checkCategory(ctx, input, null);
        return Number(
          ctx.db.run(
            `INSERT INTO categories (slug, name, parent_id, blurb, art_kind, image, sort_order, is_active)
             VALUES (:slug, :name, :parentId, :blurb, :artKind, :image, :sortOrder, :isActive)`,
            columns(input, slug),
          ).lastInsertRowid,
        );
      });
    } catch (err) {
      throw translateUnique(err, slug);
    }
    res.status(201).json(loadCategory(ctx, id));
  });

  router.put('/categories/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const input = parse(categorySchema, req.body);
    let slug = input.slug;
    try {
      ctx.db.tx(() => {
        if (!ctx.db.get('SELECT id FROM categories WHERE id = ?', [id])) throw notFound('Category');
        slug = checkCategory(ctx, input, id);
        ctx.db.run(
          `UPDATE categories SET slug = :slug, name = :name, parent_id = :parentId, blurb = :blurb, art_kind = :artKind,
             image = :image, sort_order = :sortOrder, is_active = :isActive
           WHERE id = :id`,
          { ...columns(input, slug), id },
        );
      });
    } catch (err) {
      throw translateUnique(err, slug);
    }
    res.json(loadCategory(ctx, id));
  });

  router.delete('/categories/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    ctx.db.tx(() => {
      if (!ctx.db.get('SELECT id FROM categories WHERE id = ?', [id])) throw notFound('Category');
      const children = ctx.db.get('SELECT COUNT(*) AS n FROM categories WHERE parent_id = ?', [id]).n;
      if (children > 0) {
        throw conflict(`This category still has ${children} ${children === 1 ? 'subcategory' : 'subcategories'}. Move or delete them first.`);
      }
      const products = ctx.db.get('SELECT COUNT(*) AS n FROM products WHERE category_id = ?', [id]).n;
      if (products > 0) {
        throw conflict(
          `This category still has ${products} ${products === 1 ? 'product' : 'products'} (hidden ones count too). Move them to another category first.`,
        );
      }
      ctx.db.run('DELETE FROM categories WHERE id = ?', [id]);
    });
    res.json({ ok: true });
  });

  router.get('/categories/:id/picks', (req, res) => {
    const id = parse(idParam, req.params.id);
    loadCategory(ctx, id);
    res.json(loadPicks(ctx, id));
  });

  router.put('/categories/:id/picks', (req, res) => {
    const id = parse(idParam, req.params.id);
    const { picks } = parse(picksSchema, req.body);
    ctx.db.tx(() => {
      const category = ctx.db.get('SELECT id, parent_id FROM categories WHERE id = ?', [id]);
      if (!category) throw notFound('Category');
      if (category.parent_id === null) throw badRequest('Pick of Three is for subcategories. Choose a subcategory.');

      const rows = new Map(
        ctx.db
          .all('SELECT id, category_id, is_active FROM products WHERE id IN (SELECT value FROM json_each(?))', [picks.map((pick) => pick.productId)])
          .map((row) => [row.id, row]),
      );
      const fields = {};
      picks.forEach((pick, index) => {
        const row = rows.get(pick.productId);
        if (!row) fields[`picks.${index}.productId`] = 'That product does not exist.';
        else if (row.category_id !== id) fields[`picks.${index}.productId`] = 'Pick a product from this subcategory.';
        else if (!row.is_active) fields[`picks.${index}.productId`] = 'That product is hidden from the shop.';
      });
      if (Object.keys(fields).length > 0) throw badRequest('Check the picks.', fields);

      ctx.db.run('DELETE FROM category_picks WHERE category_id = ?', [id]);
      for (const pick of picks) {
        ctx.db.run('INSERT INTO category_picks (category_id, tier, product_id, reason) VALUES (?, ?, ?, ?)', [id, pick.tier, pick.productId, pick.reason]);
      }
    });
    res.json(loadPicks(ctx, id));
  });

  return router;
}
