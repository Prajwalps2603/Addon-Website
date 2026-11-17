import { Router } from 'express';
import * as z from 'zod';
import { notFound } from '../../lib/errors.js';
import { toEnquiry } from '../../lib/mappers.js';
import { idParam, paginated, pagination, parse } from '../../lib/validate.js';

const STATUSES = ['new', 'acknowledged', 'resolved'];
const KINDS = ['contact', 'complaint', 'bulk', 'install', 'return'];

const listQuery = z.object({
  status: z.enum(STATUSES).optional(),
  kind: z.enum(KINDS).optional(),
  q: z.string().trim().max(100).optional(),
});

const updateBody = z
  .object({
    status: z.enum(STATUSES).optional(),
    adminNote: z.string().trim().max(2000).optional(),
  })
  .refine((body) => body.status !== undefined || body.adminNote !== undefined, {
    error: 'Send a status or a note to change.',
  });

const SELECT = `SELECT e.*, p.name AS product_name FROM enquiries e LEFT JOIN products p ON p.id = e.product_id`;

// GET /enquiries, PUT /enquiries/:id (mounted at /api/admin, admin only).
export default function adminEnquiriesRoutes(ctx) {
  const router = Router();

  router.get('/enquiries', (req, res) => {
    const { page, limit } = parse(pagination, req.query);
    const { status, kind, q } = parse(listQuery, req.query);
    const where = [];
    const params = {};
    if (status) {
      where.push('e.status = :status');
      params.status = status;
    }
    if (kind) {
      where.push('e.kind = :kind');
      params.kind = kind;
    }
    if (q) {
      where.push(`(e.ticket_number LIKE :q ESCAPE '\\' OR e.name LIKE :q ESCAPE '\\' OR e.phone LIKE :q ESCAPE '\\'
        OR e.email LIKE :q ESCAPE '\\' OR e.subject LIKE :q ESCAPE '\\' OR e.message LIKE :q ESCAPE '\\'
        OR e.order_number LIKE :q ESCAPE '\\')`);
      params.q = `%${q.replace(/[\\%_]/g, (ch) => `\\${ch}`)}%`;
    }
    const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
    const { total } = ctx.db.get(`SELECT COUNT(*) AS total FROM enquiries e ${clause}`, params);
    const rows = ctx.db.all(`${SELECT} ${clause} ORDER BY e.created_at DESC, e.id DESC LIMIT :limit OFFSET :offset`, {
      ...params,
      limit,
      offset: (page - 1) * limit,
    });
    res.json(paginated(rows.map(toEnquiry), total, { page, limit }));
  });

  router.put('/enquiries/:id', (req, res) => {
    const id = parse(idParam, req.params.id);
    const body = parse(updateBody, req.body);
    const sets = ['updated_at = :now'];
    const params = { id, now: ctx.now() };
    if (body.status !== undefined) {
      sets.push('status = :status');
      params.status = body.status;
    }
    if (body.adminNote !== undefined) {
      sets.push('admin_note = :adminNote');
      params.adminNote = body.adminNote;
    }
    const { changes } = ctx.db.run(`UPDATE enquiries SET ${sets.join(', ')} WHERE id = :id`, params);
    if (!changes) throw notFound('Enquiry');
    res.json(toEnquiry(ctx.db.get(`${SELECT} WHERE e.id = ?`, [id])));
  });

  return router;
}
