import { Router } from 'express';
import * as z from 'zod';
import { getProductsByIds } from '../../lib/catalog.js';
import { notFound } from '../../lib/errors.js';
import { idList, toBuild } from '../../lib/mappers.js';
import { paginated, pagination, parse } from '../../lib/validate.js';

const STATUSES = ['private', 'pending', 'approved', 'rejected'];

const listSchema = pagination.extend({
  status: z.enum([...STATUSES, '']).optional(),
  q: z.string().trim().max(100).optional(),
});

const updateSchema = z
  .object({
    status: z.enum(STATUSES).optional(),
    isHouse: z.boolean().optional(),
    title: z.string().trim().min(2).max(80).optional(),
  })
  .refine((update) => Object.values(update).some((value) => value !== undefined), { error: 'Send at least one change.' });

const slugParam = z.string().trim().min(1).max(120);

const likePattern = (text) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/** Build[] for builds rows, with every build's parts read in one query. */
function mapBuilds(ctx, rows) {
  const idsByRow = rows.map((row) => idList(row.product_ids));
  const products = new Map(getProductsByIds(ctx, idsByRow.flat()).map((product) => [product.id, product]));
  return rows.map((row, index) =>
    toBuild(
      row,
      idsByRow[index].map((id) => products.get(id)).filter(Boolean),
    ),
  );
}

function loadBuildRow(ctx, slug) {
  const row = ctx.db.get('SELECT * FROM builds WHERE slug = ?', [slug]);
  if (!row) throw notFound('Build');
  return row;
}

export default function adminBuildsRoutes(ctx) {
  const router = Router();

  router.get('/builds', (req, res) => {
    const query = parse(listSchema, req.query);
    const where = [];
    const params = {};
    if (query.status) {
      where.push('status = :status');
      params.status = query.status;
    }
    if (query.q) {
      where.push("(title LIKE :q ESCAPE '\\' OR author_name LIKE :q ESCAPE '\\' OR vehicle_label LIKE :q ESCAPE '\\')");
      params.q = likePattern(query.q);
    }
    const filter = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
    const { total } = ctx.db.get(`SELECT COUNT(*) AS total FROM builds${filter}`, params);
    const rows = ctx.db.all(
      `SELECT * FROM builds${filter}
       ORDER BY CASE status WHEN 'pending' THEN 0 ELSE 1 END, created_at DESC, id DESC
       LIMIT :limit OFFSET :offset`,
      { ...params, limit: query.limit, offset: (query.page - 1) * query.limit },
    );
    res.json(paginated(mapBuilds(ctx, rows), total, query));
  });

  router.put('/builds/:slug', (req, res) => {
    const slug = parse(slugParam, req.params.slug);
    const update = parse(updateSchema, req.body);
    const row = ctx.db.tx(() => {
      const build = loadBuildRow(ctx, slug);
      ctx.db.run('UPDATE builds SET status = :status, is_house = :isHouse, title = :title WHERE id = :id', {
        status: update.status ?? build.status,
        isHouse: update.isHouse ?? Boolean(build.is_house),
        title: update.title ?? build.title,
        id: build.id,
      });
      return loadBuildRow(ctx, slug);
    });
    res.json(mapBuilds(ctx, [row])[0]);
  });

  router.delete('/builds/:slug', (req, res) => {
    const slug = parse(slugParam, req.params.slug);
    if (ctx.db.run('DELETE FROM builds WHERE slug = ?', [slug]).changes === 0) throw notFound('Build');
    res.json({ ok: true });
  });

  return router;
}
