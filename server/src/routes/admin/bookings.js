import { Router } from 'express';
import * as z from 'zod';
import { badRequest, conflict, notFound } from '../../lib/errors.js';
import { toAdminBooking, toBooking } from '../../lib/mappers.js';
import {
  ACTIVE_BOOKING_STATUSES,
  BOOKING_STATUSES,
  assertSlotFree,
  bookingNotices,
  bookingStatusText,
  formatDay,
  formatSlot,
  getBookingRow,
  indiaNow,
  isValidDate,
} from '../../lib/studio.js';
import { paginated, paginationOf, parse } from '../../lib/validate.js';

const dateSchema = z.string().trim().refine(isValidDate, { error: 'Choose a valid date as YYYY-MM-DD.' });
const SLOT = /^([01]\d|2[0-3]):[0-5]\d$/;

const listSchema = paginationOf({ defaultLimit: 50, maxLimit: 200 }).extend({
  from: dateSchema.optional(),
  to: dateSchema.optional(),
  status: z.enum(BOOKING_STATUSES).optional(),
  q: z.string().trim().max(80).optional(),
});

const updateSchema = z.strictObject(
  {
    status: z.enum(BOOKING_STATUSES).optional(),
    date: dateSchema.optional(),
    slot: z.string().trim().regex(SLOT, { error: 'Choose one of the listed times.' }).optional(),
    adminNote: z.string().trim().max(1000).optional(),
  },
  { error: 'Send the changes as an object.' },
);

const isActive = (status) => ACTIVE_BOOKING_STATUSES.includes(status);

// The studio diary (mounted at /api/admin, admin only).
export default function adminBookingsRoutes(ctx) {
  const router = Router();

  // Bookings by day and slot. Without from/to it shows today (India) onwards.
  router.get('/bookings', (req, res) => {
    const query = parse(listSchema, req.query);
    const where = [];
    const params = {};
    const from = query.from ?? (query.to ? undefined : indiaNow(ctx).date);
    if (from) {
      where.push('date >= :from');
      params.from = from;
    }
    if (query.to) {
      where.push('date <= :to');
      params.to = query.to;
    }
    if (query.status) {
      where.push('status = :status');
      params.status = query.status;
    }
    if (query.q) {
      const digits = query.q.replace(/\D/g, '');
      const columns = ['booking_number', 'order_number', 'name', 'vehicle', 'registration_number', 'service_name'];
      const tests = columns.map((column) => `${column} LIKE :like ESCAPE '\\'`);
      if (digits.length >= 4) tests.push('phone LIKE :digits');
      where.push(`(${tests.join(' OR ')})`);
      params.like = `%${query.q.replace(/[\\%_]/g, (char) => `\\${char}`)}%`;
      if (digits.length >= 4) params.digits = `%${digits}%`;
    }
    const filter = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';
    const total = ctx.db.get(`SELECT COUNT(*) AS n FROM bookings ${filter}`, params).n;
    const rows = ctx.db.all(`SELECT * FROM bookings ${filter} ORDER BY date, slot, id LIMIT :limit OFFSET :offset`, {
      ...params,
      limit: query.limit,
      offset: (query.page - 1) * query.limit,
    });
    res.json(paginated(rows.map(toAdminBooking), total, query));
  });

  router.get('/bookings/:number', (req, res) => {
    const row = getBookingRow(ctx, req.params.number);
    if (!row) throw notFound('Booking');
    res.json(toAdminBooking(row));
  });

  // Status, a move to another day or slot (checked for a free place), and the studio's note.
  // A booking that came from a studio order moves the order with it.
  router.put('/bookings/:number', (req, res) => {
    const input = parse(updateSchema, req.body);
    let notice = null;
    const row = ctx.db.tx(() => {
      const booking = getBookingRow(ctx, req.params.number);
      if (!booking) throw notFound('Booking');
      const status = input.status ?? booking.status;
      const date = input.date ?? booking.date;
      const slot = input.slot ?? booking.slot;
      const moved = date !== booking.date || slot !== booking.slot;
      const reopened = isActive(status) && !isActive(booking.status);

      if (moved && !isActive(status)) {
        throw badRequest('Reopen the booking before moving it.', { status: 'A cancelled or missed booking cannot be moved.' });
      }
      if (moved || reopened) {
        try {
          assertSlotFree(ctx, date, slot, { excludeBookingId: booking.id });
        } catch (err) {
          // Staff may keep a booking where it already is, even once that time has passed.
          if (moved) throw err;
          const taken = ctx.db.get(
            `SELECT COUNT(*) AS n FROM bookings WHERE date = ? AND slot = ? AND id <> ? AND status IN (SELECT value FROM json_each(?))`,
            [date, slot, booking.id, ACTIVE_BOOKING_STATUSES],
          ).n;
          if (taken >= Number(ctx.settings.get().studio.carsPerSlot)) throw conflict('That slot is already full. Move the booking to another time.', 'slot_unavailable');
        }
      }

      const now = ctx.now();
      ctx.db.run(
        'UPDATE bookings SET status = ?, date = ?, slot = ?, admin_note = ?, updated_at = ? WHERE id = ?',
        [status, date, slot, input.adminNote ?? booking.admin_note, now, booking.id],
      );

      if (booking.order_number) {
        const order = ctx.db.get('SELECT id, status FROM orders WHERE order_number = ?', [booking.order_number]);
        if (order && moved) {
          ctx.db.run("UPDATE orders SET studio_date = ?, studio_slot = ?, updated_at = ? WHERE id = ? AND fulfilment = 'studio'", [date, slot, now, order.id]);
          ctx.db.run("INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, ?, ?, 'admin', ?)", [
            order.id,
            order.status,
            `Studio fitting moved to ${formatDay(date)} at ${formatSlot(slot)}.`,
            now,
          ]);
        } else if (order && status !== booking.status) {
          ctx.db.run("INSERT INTO order_events (order_id, status, note, actor, created_at) VALUES (?, ?, ?, 'admin', ?)", [
            order.id,
            order.status,
            `Studio booking ${booking.booking_number}: ${bookingStatusText(status).toLowerCase()}.`,
            now,
          ]);
        }
      }

      if (moved && isActive(status)) notice = 'moved';
      else if (status !== booking.status && status === 'confirmed') notice = 'confirmed';
      else if (status !== booking.status && status === 'cancelled') notice = 'cancelled';
      return ctx.db.get('SELECT * FROM bookings WHERE id = ?', [booking.id]);
    });
    if (notice) bookingNotices(ctx, toBooking(row), notice);
    res.json(toAdminBooking(row));
  });

  return router;
}
