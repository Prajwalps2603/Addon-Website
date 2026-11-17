import { Router } from 'express';
import * as z from 'zod';
import { notFound } from '../../lib/errors.js';
import { toStockAlert } from '../../lib/mappers.js';
import { idParam, paginated, pagination, parse } from '../../lib/validate.js';

const STATUSES = ['waiting', 'notified'];

const listQuery = z.object({
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});
const updateBody = z.object({ status: z.enum(STATUSES) });

const like = (q) => `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;

// Current stock is the variant's when the alert names one (and the variant still exists), else the product's.
const SELECT = `SELECT a.*, p.name AS product_name, p.slug AS product_slug,
    COALESCE(v.stock, p.stock) AS stock
  FROM stock_alerts a
  JOIN products p ON p.id = a.product_id
  LEFT JOIN product_variants v ON v.id = a.variant_id AND v.product_id = a.product_id`;

// GET /stock-alerts, PUT /stock-alerts/:id (mounted at /api/admin, admin only).
export default function adminStockAlertsRoutes(ctx) {
  const router = Router();

  router.get('/stock-alerts', (req, res) => {
    const { page, limit } = parse(pagination, req.query);
    const { status, q } = parse(listQuery, req.query);
    const where = [];
    const params = {};
    if (status) {
      where.push('a.status = :status');
      params.status = status;
    }
    if (q) {
      where.push(`(p.name LIKE :q ESCAPE '\\' OR p.sku LIKE :q ESCAPE '\\' OR a.phone LIKE :q ESCAPE '\\' OR a.email LIKE :q ESCAPE '\\')`);
      params.q = like(q);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { total } = ctx.db.get(
      `SELECT COUNT(*) AS total FROM stock_alerts a JOIN products p ON p.id = a.product_id ${clause}`,
      params,
    );
    const rows = ctx.db.all(`${SELECT} ${clause} ORDER BY a.created_at DESC, a.id DESC LIMIT :limit OFFSET :offset`, {
      ...params,
      limit,
      offset: (page - 1) * limit,
    });
    res.json(paginated(rows.map(toStockAlert), total, { page, limit }));
  });

  router.put('/stock-alerts/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const { status } = parse(updateBody, req.body);
    const { changes } = ctx.db.run('UPDATE stock_alerts SET status = ? WHERE id = ?', [status, id]);
    if (!changes) throw notFound('Stock alert');
    res.json(toStockAlert(ctx.db.get(`${SELECT} WHERE a.id = ?`, [id])));
  });

  return router;
}
