import { Router } from 'express';
import * as z from 'zod';
import { notFound } from '../lib/errors.js';
import { toBooking } from '../lib/mappers.js';
import { limiters } from '../lib/rateLimit.js';
import { addDays, bookingNotices, createBooking, getBookingRow, indiaNow, isValidDate, studioDay, toStudioService } from '../lib/studio.js';
import { parse, phoneSchema } from '../lib/validate.js';

const dateSchema = z.string({ error: 'Choose a date.' }).trim().refine(isValidDate, { error: 'Choose a valid date as YYYY-MM-DD.' });
const MAX_CALENDAR_DAYS = 62;

// The fitting studio for shoppers (mounted at /api/studio): slots, services and bookings.
export default function studioRoutes(ctx) {
  const router = Router();

  // StudioDay: every slot of one day and whether a car can still be booked into it.
  router.get('/slots', (req, res) => {
    const { date } = parse(z.object({ date: dateSchema }), req.query);
    res.json(studioDay(ctx, date));
  });

  // StudioDay[] for a run of days, for a date picker: from (default today in India), days (default 14, at most 62).
  router.get('/calendar', (req, res) => {
    const query = parse(
      z.object({
        from: dateSchema.optional(),
        days: z.coerce.number().int().min(1).max(MAX_CALENDAR_DAYS).default(14),
      }),
      req.query,
    );
    const from = query.from ?? indiaNow(ctx).date;
    const settings = ctx.settings.get();
    const days = [];
    for (let i = 0; i < query.days; i += 1) days.push(studioDay(ctx, addDays(from, i), { settings }));
    res.json(days);
  });

  router.get('/services', (req, res) => {
    res.json(ctx.settings.get().services.map(toStudioService));
  });

  // A fitting service booked on its own. The slot is checked again inside the transaction.
  router.post('/bookings', limiters.forms, (req, res) => {
    const row = createBooking(ctx, req.body);
    const booking = toBooking(row);
    bookingNotices(ctx, booking, 'received');
    res.status(201).json(booking);
  });

  // Lookup by number and the phone it was booked with. Anything else is the same 404.
  router.get('/bookings/:number', limiters.lookup, (req, res) => {
    const { phone } = parse(z.object({ phone: phoneSchema }), req.query);
    const row = getBookingRow(ctx, req.params.number);
    if (!row || String(row.phone).replace(/\D/g, '').slice(-10) !== phone) throw notFound('Booking');
    res.json(toBooking(row));
  });

  return router;
}
