import { Router } from 'express';
import * as z from 'zod';
import { notFound } from '../../lib/errors.js';
import { toSavedKit } from '../../lib/mappers.js';
import { idParam, paginated, pagination, parse } from '../../lib/validate.js';

const STATUSES = ['open', 'contacted', 'ordered', 'dismissed'];

const listQuery = z.object({
  status: z.enum(STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
});
const updateBody = z.object({ status: z.enum(STATUSES) });

const like = (q) => `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;

// GET /kits, PUT /kits/:id (mounted at /api/admin, admin only). Kits saved from the planners.
export default function adminKitsRoutes(ctx) {
  const router = Router();

  router.get('/kits', (req, res) => {
    const { page, limit } = parse(pagination, req.query);
    const { status, q } = parse(listQuery, req.query);
    const where = [];
    const params = {};
    if (status) {
      where.push('status = :status');
      params.status = status;
    }
    if (q) {
      where.push(`(name LIKE :q ESCAPE '\\' OR phone LIKE :q ESCAPE '\\' OR vehicle_label LIKE :q ESCAPE '\\')`);
      params.q = like(q);
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { total } = ctx.db.get(`SELECT COUNT(*) AS total FROM saved_kits ${clause}`, params);
    const rows = ctx.db.all(
      `SELECT * FROM saved_kits ${clause} ORDER BY created_at DESC, id DESC LIMIT :limit OFFSET :offset`,
      { ...params, limit, offset: (page - 1) * limit },
    );
    res.json(paginated(rows.map(toSavedKit), total, { page, limit }));
  });

  router.put('/kits/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const { status } = parse(updateBody, req.body);
    const { changes } = ctx.db.run('UPDATE saved_kits SET status = ? WHERE id = ?', [status, id]);
    if (!changes) throw notFound('Saved kit');
    res.json(toSavedKit(ctx.db.get('SELECT * FROM saved_kits WHERE id = ?', [id])));
  });

  return router;
}
