import { Router } from 'express';
import * as z from 'zod';
import { toAdminCustomer } from '../../lib/mappers.js';
import { paginated, pagination, parse } from '../../lib/validate.js';

const querySchema = z.object({
  q: z.preprocess((value) => (value === '' || value === null ? undefined : value), z.string().trim().max(80).optional()),
});

function likePattern(value) {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

export default function adminCustomersRoutes(ctx) {
  const router = Router();

  router.get('/customers', (req, res) => {
    const { q } = parse(querySchema, req.query);
    const { page, limit } = parse(pagination, req.query);

    const where = ["u.role = 'customer'"];
    const params = {};
    if (q) {
      const parts = ["u.name LIKE :q ESCAPE '\\'", "u.email LIKE :q ESCAPE '\\'", "u.phone LIKE :q ESCAPE '\\'"];
      params.q = likePattern(q);
      const digits = q.replace(/\D/g, '');
      if (digits.length >= 4) {
        parts.push('u.phone LIKE :qDigits');
        params.qDigits = `%${digits.length > 10 ? digits.slice(-10) : digits}%`;
      }
      where.push(`(${parts.join(' OR ')})`);
    }
    const whereSql = `WHERE ${where.join(' AND ')}`;

    const total = ctx.db.get(`SELECT COUNT(*) AS n FROM users u ${whereSql}`, params).n;
    // Spent = orders that were delivered or fully paid, leaving out anything cancelled or returned.
    const rows = ctx.db.all(
      `SELECT u.id, u.name, u.email, u.phone, u.role, u.created_at,
              COALESCE(s.order_count, 0) AS order_count,
              COALESCE(s.total_spent, 0) AS total_spent,
              s.last_order_at
       FROM users u
       LEFT JOIN (
         SELECT user_id,
                COUNT(*) AS order_count,
                SUM(CASE WHEN status NOT IN ('cancelled', 'returned')
                          AND (status = 'delivered' OR payment_status = 'paid') THEN total ELSE 0 END) AS total_spent,
                MAX(created_at) AS last_order_at
         FROM orders
         WHERE user_id IS NOT NULL
         GROUP BY user_id
       ) s ON s.user_id = u.id
       ${whereSql}
       ORDER BY u.created_at DESC, u.id DESC
       LIMIT :pageLimit OFFSET :pageOffset`,
      { ...params, pageLimit: limit, pageOffset: (page - 1) * limit },
    );
    res.json(paginated(rows.map(toAdminCustomer), total, { page, limit }));
  });

  return router;
}
