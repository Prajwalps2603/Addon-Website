import { Router } from 'express';
import * as z from 'zod';
import { toIso } from '../../db/index.js';
import { badRequest, notFound } from '../../lib/errors.js';
import { orderTaxLines, toAdminOrderListItem } from '../../lib/mappers.js';
import { taxByRate } from '../../lib/money.js';
import {
  ORDER_STATUSES,
  PAYMENT_STATUSES,
  adminOrderUpdateSchema,
  canTransition,
  cancelOrder,
  changeStatus,
  getOrderRow,
  loadOrder,
} from '../../lib/orders.js';
import { paginated, pagination, parse } from '../../lib/validate.js';

const IST_OFFSET_MS = 330 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const blankToUndefined = (value) => (value === '' || value === null ? undefined : value);

/** A day ('YYYY-MM-DD', read as a day in India) or a full timestamp. Parses to { at, dayOnly }. */
const dateBound = z.preprocess(
  blankToUndefined,
  z
    .string()
    .trim()
    .max(40)
    .transform((value, check) => {
      const dayOnly = DATE_ONLY.test(value);
      const ms = dayOnly ? Date.parse(`${value}T00:00:00+05:30`) : Date.parse(value);
      if (!Number.isFinite(ms) || (!dayOnly && !/^\d{4}-\d{2}-\d{2}T/.test(value))) {
        check.issues.push({ code: 'custom', message: 'Enter a valid date.', input: value });
        return z.NEVER;
      }
      return { ms, dayOnly };
    })
    .optional(),
);

/** Turns from / to query values into UTC bounds: from inclusive, to inclusive of the whole day named. */
function dateRange(from, to) {
  const range = {};
  if (from) range.from = toIso(new Date(from.ms));
  if (to) {
    // A day means up to the end of that day in India: compare against the start of the next day, exclusive.
    range.toExclusive = to.dayOnly ? toIso(new Date(to.ms + DAY_MS)) : toIso(new Date(to.ms + 1000));
  }
  if (range.from && range.toExclusive && range.from >= range.toExclusive) {
    throw badRequest('The start date must be on or before the end date.', { to: 'Must be on or after the start date' });
  }
  return range;
}

const listQuerySchema = z.object({
  q: z.preprocess(blankToUndefined, z.string().trim().max(80).optional()),
  status: z.preprocess(blankToUndefined, z.enum(ORDER_STATUSES).optional()),
  paymentStatus: z.preprocess(blankToUndefined, z.enum(PAYMENT_STATUSES).optional()),
  from: dateBound,
  to: dateBound,
});

const exportQuerySchema = z.object({ from: dateBound, to: dateBound });

/** Escapes LIKE wildcards so a search for "50%" or "a_b" means what it says. Use with ESCAPE '\'. */
function likePattern(value) {
  return `%${value.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
}

function indiaDate(iso) {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return '';
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

/** One CSV cell: quoted when needed, and text that Excel would run as a formula is defused. */
function cell(value) {
  if (typeof value === 'number') return String(value);
  let text = String(value ?? '');
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

const money = (value) => (Math.round((Number(value) || 0) * 100) / 100).toFixed(2);

const EXPORT_COLUMNS = [
  'Invoice number',
  'Order number',
  'Date',
  'Customer',
  'GSTIN',
  'State',
  'HSN',
  'Item',
  'Qty',
  'Taxable value',
  'GST rate',
  'CGST',
  'SGST',
  'IGST',
  'Line total',
  'Payment method',
  'Order status',
];

const METHOD_LABEL = { cod: 'Cash on delivery', razorpay: 'Razorpay', upi: 'UPI' };

export default function adminOrdersRoutes(ctx) {
  const router = Router();

  function buildFilters(query) {
    const where = [];
    const params = {};
    if (query.q) {
      const like = likePattern(query.q);
      const digits = query.q.replace(/\D/g, '');
      const parts = ["o.order_number LIKE :q ESCAPE '\\'", "o.customer_name LIKE :q ESCAPE '\\'", "o.phone LIKE :q ESCAPE '\\'"];
      params.q = like;
      // "+91 98765 43210" or "98765-43210" still finds the stored ten digits.
      if (digits.length >= 4) {
        const last10 = digits.length > 10 ? digits.slice(-10) : digits;
        parts.push('o.phone LIKE :qDigits');
        params.qDigits = `%${last10}%`;
      }
      where.push(`(${parts.join(' OR ')})`);
    }
    if (query.status) {
      where.push('o.status = :status');
      params.status = query.status;
    }
    if (query.paymentStatus) {
      where.push('o.payment_status = :paymentStatus');
      params.paymentStatus = query.paymentStatus;
    }
    const range = dateRange(query.from, query.to);
    if (range.from) {
      where.push('o.created_at >= :from');
      params.from = range.from;
    }
    if (range.toExclusive) {
      where.push('o.created_at < :toExclusive');
      params.toExclusive = range.toExclusive;
    }
    return { sql: where.length > 0 ? `WHERE ${where.join(' AND ')}` : '', params };
  }

  router.get('/orders', (req, res) => {
    const query = parse(listQuerySchema, req.query);
    const { page, limit } = parse(pagination, req.query);
    const filters = buildFilters(query);
    const total = ctx.db.get(`SELECT COUNT(*) AS n FROM orders o ${filters.sql}`, filters.params).n;
    const rows = ctx.db.all(
      `SELECT o.*, (SELECT COALESCE(SUM(i.qty), 0) FROM order_items i WHERE i.order_id = o.id) AS item_count
       FROM orders o ${filters.sql}
       ORDER BY o.created_at DESC, o.id DESC
       LIMIT :pageLimit OFFSET :pageOffset`,
      { ...filters.params, pageLimit: limit, pageOffset: (page - 1) * limit },
    );
    // Orders per status under every other filter, so the status tabs can show their counts in one request.
    const others = buildFilters({ ...query, status: undefined });
    const counts = Object.fromEntries(
      ctx.db.all(`SELECT o.status, COUNT(*) AS n FROM orders o ${others.sql} GROUP BY o.status`, others.params).map((row) => [row.status, row.n]),
    );
    res.json({ ...paginated(rows.map(toAdminOrderListItem), total, { page, limit }), counts });
  });

  // Registered before /orders/:orderNumber so "export" is never read as an order number.
  router.get('/orders/export', (req, res) => {
    const query = parse(exportQuerySchema, req.query);
    const filters = buildFilters(query);
    const orders = ctx.db.all(`SELECT o.* FROM orders o ${filters.sql} ORDER BY o.created_at ASC, o.id ASC`, filters.params);
    const ids = orders.map((row) => row.id);
    const items = ids.length > 0 ? ctx.db.all('SELECT * FROM order_items WHERE order_id IN (SELECT value FROM json_each(?)) ORDER BY order_id, id', [ids]) : [];
    const itemsBy = new Map();
    for (const item of items) {
      if (!itemsBy.has(item.order_id)) itemsBy.set(item.order_id, []);
      itemsBy.get(item.order_id).push(item);
    }
    const storeState = String(ctx.settings.get().address?.state ?? '');

    const lines = [EXPORT_COLUMNS.map(cell).join(',')];
    for (const order of orders) {
      const orderItems = itemsBy.get(order.id) ?? [];
      const taxLines = orderTaxLines(order, orderItems);
      const gross = orderItems.reduce((sum, item) => sum + Math.max(0, Number(item.price) * Number(item.qty)), 0);
      // orderTaxLines gives one line per item (in order) when the goods have value, then delivery, then the COD fee.
      const described = [];
      let next = 0;
      if (gross > 0) {
        for (const item of orderItems) {
          const name = item.variant_name ? `${item.name} (${item.variant_name})` : item.name;
          described.push({ hsn: item.hsn_code, item: name, qty: Number(item.qty), line: taxLines[next] });
          next += 1;
        }
      } else if (Math.max(0, Number(order.total) - Number(order.shipping_fee) - Number(order.cod_fee)) > 0) {
        described.push({ hsn: '', item: orderItems.map((item) => item.name).join('; ') || 'Goods', qty: orderItems.reduce((s, i) => s + Number(i.qty), 0), line: taxLines[next] });
        next += 1;
      }
      if (Number(order.shipping_fee) > 0) {
        described.push({ hsn: '', item: 'Delivery charge', qty: 1, line: taxLines[next] });
        next += 1;
      }
      if (Number(order.cod_fee) > 0) {
        described.push({ hsn: '', item: 'Cash on delivery fee', qty: 1, line: taxLines[next] });
        next += 1;
      }

      for (const entry of described) {
        if (!entry.line) continue;
        const [tax] = taxByRate([entry.line], { storeState, shipState: String(order.ship_state ?? '') });
        lines.push(
          [
            cell(order.invoice_number),
            cell(order.order_number),
            cell(indiaDate(order.created_at)),
            cell(order.customer_name),
            cell(order.gstin),
            cell(order.ship_state),
            cell(entry.hsn),
            cell(entry.item),
            cell(entry.qty),
            money(tax?.taxableValue ?? 0),
            cell(entry.line.gstRate),
            money(tax?.cgst ?? 0),
            money(tax?.sgst ?? 0),
            money(tax?.igst ?? 0),
            money(entry.line.amount),
            cell(METHOD_LABEL[order.payment_method] ?? order.payment_method),
            cell(order.status),
          ].join(','),
        );
      }
    }

    const label = [query.from && indiaDate(toIso(new Date(query.from.ms))), query.to && indiaDate(toIso(new Date(query.to.ms)))].filter(Boolean).join('-to-');
    const filename = `addon-orders${label ? `-${label}` : ''}.csv`;
    res.set('Content-Type', 'text/csv; charset=utf-8');
    res.set('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(`﻿${lines.join('\r\n')}\r\n`);
  });

  router.get('/orders/:orderNumber', (req, res) => {
    const order = loadOrder(ctx, req.params.orderNumber, { includeToken: true });
    if (!order) throw notFound('Order');
    res.json(order);
  });

  router.put('/orders/:orderNumber', (req, res) => {
    const input = parse(adminOrderUpdateSchema, req.body);
    const row = getOrderRow(ctx, req.params.orderNumber);
    if (!row) throw notFound('Order');

    const keys = Object.keys(input).filter((key) => input[key] !== undefined);
    const cancelOnly = input.status === 'cancelled' && keys.every((key) => key === 'status' || key === 'note') && canTransition(row.status, 'cancelled');
    if (cancelOnly) {
      // cancelOrder writes the refund-due note when money was already taken.
      cancelOrder(ctx, row.order_number, { actor: 'admin', reason: input.note ?? '', rules: 'admin' });
    } else {
      changeStatus(ctx, row.order_number, input, { actor: 'admin' });
    }
    res.json(loadOrder(ctx, row.order_number, { includeToken: true }));
  });

  return router;
}
