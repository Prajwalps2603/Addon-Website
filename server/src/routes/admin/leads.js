import { Router } from 'express';
import * as z from 'zod';
import { notFound } from '../../lib/errors.js';
import { toLead } from '../../lib/mappers.js';
import { idParam, paginated, pagination, parse } from '../../lib/validate.js';

const STATUSES = ['open', 'contacted', 'recovered', 'dismissed'];

const listQuery = z.object({
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});
const updateBody = z.object({ status: z.enum(STATUSES) });

const like = (q) => `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;

// GET /leads, PUT /leads/:id (mounted at /api/admin, admin only). Abandoned checkouts.
export default function adminLeadsRoutes(ctx) {
  const router = Router();

  router.get('/leads', (req, res) => {
    const { page, limit } = parse(pagination, req.query);
    const { status, q } = parse(listQuery, req.query);
    const where = [];
    const params = {};
    if (status) {
      where.push('status = :status');
      params.status = status;
    }
    if (q) {
      where.push(`(name LIKE :q ESCAPE '\\' OR phone LIKE :q ESCAPE '\\' OR email LIKE :q ESCAPE '\\' OR order_number LIKE :q ESCAPE '\\')`);
      params.q = like(q);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { total } = ctx.db.get(`SELECT COUNT(*) AS total FROM checkout_leads ${clause}`, params);
    const rows = ctx.db.all(
      `SELECT * FROM checkout_leads ${clause} ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset`,
      { ...params, limit, offset: (page - 1) * limit },
    );
    res.json(paginated(rows.map(toLead), total, { page, limit }));
  });

  router.put('/leads/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const { status } = parse(updateBody, req.body);
    const { changes } = ctx.db.run('UPDATE checkout_leads SET status = ?, updated_at = ? WHERE id = ?', [status, ctx.now(), id]);
    if (!changes) throw notFound('Lead');
    res.json(toLead(ctx.db.get('SELECT * FROM checkout_leads WHERE id = ?', [id])));
  });

  return router;
}
