import { Router } from 'express';
import * as z from 'zod';
import { notFound } from '../../lib/errors.js';
import { toAdminReport } from '../../lib/mappers.js';
import { idParam, paginated, pagination, parse } from '../../lib/validate.js';

const STATUSES = ['pending', 'approved', 'rejected'];

const listSchema = pagination.extend({
  status: z.enum([...STATUSES, '']).optional(),
  q: z.string().trim().max(100).optional(),
});

const updateSchema = z.object({ status: z.enum(STATUSES) });

const SELECT = `SELECT r.*, p.name AS product_name, p.slug AS product_slug
  FROM reviews r JOIN products p ON p.id = r.product_id`;

const likePattern = (text) => `%${text.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;

/** products.rating_avg and rating_count from the product's approved fitted reports. */
export function recomputeRating(ctx, productId) {
  ctx.db.run(
    `UPDATE products SET
       rating_avg = COALESCE((SELECT ROUND(AVG(rating), 2) FROM reviews WHERE product_id = :id AND status = 'approved'), 0),
       rating_count = (SELECT COUNT(*) FROM reviews WHERE product_id = :id AND status = 'approved')
     WHERE id = :id`,
    { id: productId },
  );
}

function loadReport(ctx, id) {
  const row = ctx.db.get(`${SELECT} WHERE r.id = ?`, [id]);
  if (!row) throw notFound('Report');
  return row;
}

export default function adminReportsRoutes(ctx) {
  const router = Router();

  router.get('/reports', (req, res) => {
    const query = parse(listSchema, req.query);
    const where = [];
    const params = {};
    if (query.status) {
      where.push('r.status = :status');
      params.status = query.status;
    }
    if (query.q) {
      where.push("(r.author_name LIKE :q ESCAPE '\\' OR r.vehicle LIKE :q ESCAPE '\\' OR p.name LIKE :q ESCAPE '\\' OR r.order_number LIKE :q ESCAPE '\\')");
      params.q = likePattern(query.q);
    }
    const filter = where.length > 0 ? ` WHERE ${where.join(' AND ')}` : '';
    const { total } = ctx.db.get(`SELECT COUNT(*) AS total FROM reviews r JOIN products p ON p.id = r.product_id${filter}`, params);
    const rows = ctx.db.all(
      `${SELECT}${filter}
       ORDER BY CASE r.status WHEN 'pending' THEN 0 ELSE 1 END, r.created_at DESC, r.id DESC
       LIMIT :limit OFFSET :offset`,
      { ...params, limit: query.limit, offset: (query.page - 1) * query.limit },
    );
    res.json(paginated(rows.map(toAdminReport), total, query));
  });

  router.put('/reports/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const { status } = parse(updateSchema, req.body);
    const row = ctx.db.tx(() => {
      const report = loadReport(ctx, id);
      ctx.db.run('UPDATE reviews SET status = ? WHERE id = ?', [status, id]);
      recomputeRating(ctx, report.product_id);
      return loadReport(ctx, id);
    });
    res.json(toAdminReport(row));
  });

  router.delete('/reports/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    ctx.db.tx(() => {
      const report = loadReport(ctx, id);
      ctx.db.run('DELETE FROM reviews WHERE id = ?', [id]);
      recomputeRating(ctx, report.product_id);
    });
    res.json({ ok: true });
  });

  return router;
}
