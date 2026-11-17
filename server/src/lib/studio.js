/**
 * The fitting studio: slot availability, fitting services for parts, and the bookings diary.
 *
 *   availableSlots(ctx, date, { excludeBookingId })   StudioSlot[] for 'YYYY-MM-DD'
 *   studioDay(ctx, date, options)                     StudioDay: the slots plus open and a plain message
 *   assertSlotFree(ctx, date, slot, options)          throws 409 'slot_unavailable' unless the slot has a place
 *   serviceForProduct(ctx, productRow, services?)     the settings.services entry that fits this part, or null
 *   insertBooking(ctx, values)                        writes a bookings row with the next ADN-B-000123 number
 *   bookingSchema                                     BookingRequest validation (POST /api/studio/bookings)
 *   createBooking(ctx, input)                         service-only booking, in one transaction
 *   bookingNotices(ctx, booking, kind)                emails the customer and the store; never throws
 *
 * Times are India time (UTC+5:30, no daylight saving): `date` is the calendar date in India and
 * `slot` the 'HH:MM' start time there. ctx.now() is the clock, so tests can move it.
 *
 * A place in a slot is taken by every active booking (requested, confirmed, in_progress,
 * completed) and by every live studio order that has no booking row of its own. Studio orders
 * normally write a linked booking (lib/orders.js), so they are not counted twice.
 */
import * as z from 'zod';
import { getVehicleRow } from './catalog.js';
import { badRequest, conflict } from './errors.js';
import { toBooking, vehicleLabel } from './mappers.js';
import { formatINR } from './money.js';
import { escapeHtml } from './notify.js';
import { emailSchema, parse, phoneSchema } from './validate.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;
const BOOKING_HEAD = 'ADN-B-';

export const BOOKING_STATUSES = ['requested', 'confirmed', 'in_progress', 'completed', 'cancelled', 'no_show'];
/** Bookings in these states hold their place in a slot. */
export const ACTIVE_BOOKING_STATUSES = ['requested', 'confirmed', 'in_progress', 'completed'];

const STATUS_TEXT = {
  requested: 'Requested',
  confirmed: 'Confirmed',
  in_progress: 'In the studio',
  completed: 'Completed',
  cancelled: 'Cancelled',
  no_show: 'Did not arrive',
};

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SLOT_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

// ---------------------------------------------------------------------------
// Dates and times in India
// ---------------------------------------------------------------------------

/** True for a real calendar date written 'YYYY-MM-DD'. */
export function isValidDate(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

const dayMs = (ymd) => Date.parse(`${ymd}T00:00:00Z`);
const ymdOf = (ms) => new Date(ms).toISOString().slice(0, 10);
const minutesOf = (slot) => Number(slot.slice(0, 2)) * 60 + Number(slot.slice(3, 5));

/** The India date ('YYYY-MM-DD') and minutes since India midnight of ctx.now(). */
export function indiaNow(ctx) {
  const ms = Date.parse(ctx.now());
  const shifted = new Date((Number.isFinite(ms) ? ms : Date.now()) + IST_OFFSET_MS);
  return { date: shifted.toISOString().slice(0, 10), minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes() };
}

/** 'YYYY-MM-DD' that many days after a 'YYYY-MM-DD'. */
export function addDays(ymd, days) {
  return ymdOf(dayMs(ymd) + days * DAY_MS);
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** 'Tue, 17 Nov 2026' for '2026-11-17'. */
export function formatDay(ymd) {
  if (!isValidDate(ymd)) return String(ymd ?? '');
  const day = new Date(dayMs(ymd));
  return `${WEEKDAYS[day.getUTCDay()].slice(0, 3)}, ${day.getUTCDate()} ${MONTHS[day.getUTCMonth()]} ${day.getUTCFullYear()}`;
}

/** '1:00 pm' for '13:00'. */
export function formatSlot(slot) {
  if (typeof slot !== 'string' || !SLOT_RE.test(slot)) return String(slot ?? '');
  const minutes = minutesOf(slot);
  const hour = Math.floor(minutes / 60);
  const minute = String(minutes % 60).padStart(2, '0');
  return `${hour % 12 === 0 ? 12 : hour % 12}:${minute} ${hour < 12 ? 'am' : 'pm'}`;
}

// ---------------------------------------------------------------------------
// Availability
// ---------------------------------------------------------------------------

function takenBySlot(ctx, date, excludeBookingId) {
  const taken = new Map();
  const add = (rows) => {
    for (const row of rows) taken.set(row.slot, (taken.get(row.slot) ?? 0) + Number(row.n));
  };
  add(
    ctx.db.all(
      `SELECT slot, COUNT(*) AS n FROM bookings
       WHERE date = ? AND id <> ? AND status IN (SELECT value FROM json_each(?))
       GROUP BY slot`,
      [date, excludeBookingId ?? 0, ACTIVE_BOOKING_STATUSES],
    ),
  );
  add(
    ctx.db.all(
      `SELECT studio_slot AS slot, COUNT(*) AS n FROM orders o
       WHERE o.fulfilment = 'studio' AND o.studio_date = ? AND o.status NOT IN ('cancelled', 'returned')
         AND NOT EXISTS (SELECT 1 FROM bookings b WHERE b.order_number = o.order_number)
       GROUP BY studio_slot`,
      [date],
    ),
  );
  return taken;
}

/**
 * Why a whole day cannot be booked, or null when it can: 'past', 'closed' (studio switched off,
 * a closed weekday, or beyond the booking horizon). With the plain message to show.
 */
function dayProblem(studio, date, today) {
  if (!studio.enabled) return { reason: 'closed', message: 'Studio bookings are paused right now. Call us to arrange a fitting.' };
  if (date < today) return { reason: 'past', message: 'That day has passed. Choose today or a later date.' };
  const last = addDays(today, Math.max(0, Number(studio.maxDaysAhead) || 0));
  if (date > last) return { reason: 'closed', message: `Bookings open ${studio.maxDaysAhead} days ahead. Choose a date up to ${formatDay(last)}.` };
  const weekday = new Date(dayMs(date)).getUTCDay();
  if ((studio.closedWeekdays ?? []).includes(weekday)) return { reason: 'closed', message: `The studio is closed on ${WEEKDAYS[weekday]}s.` };
  return null;
}

/**
 * Every slot of the day with whether a car can still be booked into it.
 * reason: null (bookable), 'past' (already started or the day has gone), 'closed' (studio off,
 * closed day, beyond the horizon, or after the Sunday half day), 'notice' (starts sooner than
 * studio.minNoticeMinutes from now), 'full' (carsPerSlot cars already booked).
 * `left` is the number of places still free (0 unless available).
 * `excludeBookingId` leaves one booking out of the count (moving that booking).
 */
export function availableSlots(ctx, date, { excludeBookingId = null, settings = ctx.settings.get() } = {}) {
  if (!isValidDate(date)) throw badRequest('Choose a date as YYYY-MM-DD.', { date: 'Choose a valid date.' });
  const { studio } = settings;
  const now = indiaNow(ctx);
  const problem = dayProblem(studio, date, now.date);
  const capacity = Math.max(0, Number(studio.carsPerSlot) || 0);
  const isSunday = new Date(dayMs(date)).getUTCDay() === 0;
  const sundayLast = isSunday && SLOT_RE.test(studio.sundayLastSlot ?? '') ? studio.sundayLastSlot : null;
  const notice = Math.max(0, Number(studio.minNoticeMinutes) || 0);
  const taken = problem ? new Map() : takenBySlot(ctx, date, excludeBookingId);

  return [...studio.slots]
    .filter((slot) => SLOT_RE.test(slot))
    .sort()
    .map((slot) => {
      let reason = problem?.reason ?? null;
      if (!reason && date === now.date && minutesOf(slot) <= now.minutes) reason = 'past';
      if (!reason && sundayLast && slot > sundayLast) reason = 'closed';
      if (!reason && date === now.date && minutesOf(slot) - now.minutes < notice) reason = 'notice';
      const left = Math.max(0, capacity - (taken.get(slot) ?? 0));
      if (!reason && left === 0) reason = 'full';
      return { slot, available: reason === null, reason, left: reason === null ? left : 0 };
    });
}

/** StudioDay: { date, open, message, slots } for GET /api/studio/slots. */
export function studioDay(ctx, date, options = {}) {
  const settings = options.settings ?? ctx.settings.get();
  const slots = availableSlots(ctx, date, { ...options, settings });
  const { studio } = settings;
  const now = indiaNow(ctx);
  const problem = dayProblem(studio, date, now.date);
  const open = slots.some((slot) => slot.available);
  let message = '';
  if (problem) message = problem.message;
  else if (!open && slots.every((slot) => slot.reason === 'full')) message = 'Every slot on this day is taken. Try another day.';
  else if (!open) message = 'No slots left on this day. Try another day.';
  else if (new Date(dayMs(date)).getUTCDay() === 0 && SLOT_RE.test(studio.sundayLastSlot ?? '')) {
    message = `Sunday is a half day: the last slot starts at ${formatSlot(studio.sundayLastSlot)}.`;
  }
  return { date, open, message, slots };
}

const REASON_TEXT = {
  past: 'That time has already passed.',
  closed: 'The studio does not take bookings at that time.',
  notice: 'That slot starts too soon for us to get ready. Choose a later one.',
  full: 'That slot has just been taken. Choose another time.',
};

/**
 * Throws a 409 'slot_unavailable' unless `slot` on `date` has a free place right now.
 * Call it inside the transaction that writes the booking or order, so two cars cannot take the last place.
 */
export function assertSlotFree(ctx, date, slot, options = {}) {
  const slots = availableSlots(ctx, date, options);
  const entry = slots.find((candidate) => candidate.slot === slot);
  if (!entry) throw badRequest('Choose one of the listed times.', { slot: 'Choose one of the listed times.' });
  if (!entry.available) {
    const day = studioDay(ctx, date, options);
    const message = entry.reason === 'closed' && day.message && !day.open ? day.message : REASON_TEXT[entry.reason];
    throw conflict(message, 'slot_unavailable');
  }
  return entry;
}

// ---------------------------------------------------------------------------
// Services
// ---------------------------------------------------------------------------

/** The public StudioService shape of a settings.services entry. */
export function toStudioService(service) {
  return {
    id: String(service.id),
    name: String(service.name),
    charge: Math.max(0, Math.trunc(Number(service.charge) || 0)),
    minutes: Math.max(0, Math.trunc(Number(service.minutes) || 0)),
    blurb: String(service.blurb ?? ''),
    subcategorySlugs: Array.isArray(service.subcategorySlugs) ? service.subcategorySlugs.map(String) : [],
  };
}

/**
 * The fitting service for a part: the first service whose subcategorySlugs include the product's
 * subcategory (v_products.category_slug), or null. The free consultation never applies to a part.
 */
export function serviceForProduct(ctx, productRow, services = ctx.settings.get().services) {
  const slug = String(productRow?.category_slug ?? '');
  if (!slug) return null;
  const match = (services ?? []).find((service) => service.id !== 'consult' && Array.isArray(service.subcategorySlugs) && service.subcategorySlugs.includes(slug));
  return match ? toStudioService(match) : null;
}

// ---------------------------------------------------------------------------
// The diary
// ---------------------------------------------------------------------------

/** The next booking number, in sequence: ADN-B-000123. Use it in the same transaction as the insert. */
export function nextBookingNumber(ctx) {
  const row = ctx.db.get(
    'SELECT MAX(CAST(substr(booking_number, ?) AS INTEGER)) AS last FROM bookings WHERE substr(booking_number, 1, ?) = ?',
    [BOOKING_HEAD.length + 1, BOOKING_HEAD.length, BOOKING_HEAD],
  );
  return `${BOOKING_HEAD}${String((row?.last ?? 0) + 1).padStart(6, '0')}`;
}

/** Inserts a bookings row (snake_case values) with the next number. Returns the new row. Call inside a tx. */
export function insertBooking(ctx, values) {
  const now = ctx.now();
  const row = {
    booking_number: nextBookingNumber(ctx),
    service_id: '',
    service_name: '',
    service_charge: 0,
    service_minutes: 0,
    email: '',
    vehicle: '',
    vehicle_id: null,
    registration_number: '',
    notes: '',
    admin_note: '',
    order_number: '',
    status: 'requested',
    is_demo: 0,
    created_at: now,
    updated_at: now,
    ...values,
  };
  const columns = Object.keys(row);
  const { lastInsertRowid } = ctx.db.run(
    `INSERT INTO bookings (${columns.join(', ')}) VALUES (${columns.map((key) => `:${key}`).join(', ')})`,
    row,
  );
  return ctx.db.get('SELECT * FROM bookings WHERE id = ?', [lastInsertRowid]);
}

/** The bookings row for a number, or null. */
export function getBookingRow(ctx, number) {
  const value = typeof number === 'string' ? number.trim().toUpperCase() : '';
  if (!/^ADN-B-\d{1,12}$/.test(value)) return null;
  return ctx.db.get('SELECT * FROM bookings WHERE booking_number = ?', [value]) ?? null;
}

const optionalText = (max) => z.preprocess((value) => (value === null || value === undefined ? '' : value), z.string().trim().max(max));
const blankToUndefined = (value) => (value === '' || value === null ? undefined : value);

/** A car registration number: letters, digits, spaces and hyphens, stored upper-case. */
export const registrationSchema = z.preprocess(
  (value) => (value === null || value === undefined ? '' : value),
  z
    .string()
    .trim()
    .toUpperCase()
    .max(16, { error: 'Keep the registration number to 16 characters.' })
    .regex(/^[A-Z0-9 -]*$/, { error: 'Use letters, numbers, spaces and hyphens, for example KA 01 AB 1234.' }),
);

export const slotChoiceSchema = z.object({
  date: z.string({ error: 'Choose a date.' }).trim().refine(isValidDate, { error: 'Choose a valid date.' }),
  slot: z.string({ error: 'Choose a time.' }).trim().regex(SLOT_RE, { error: 'Choose one of the listed times.' }),
});

/** BookingRequest of api.ts. A car is required: a vehicleId from the catalogue or a vehicleLabel typed in. */
export const bookingSchema = z
  .object({
    serviceId: z.string({ error: 'Choose a service.' }).trim().min(1, { error: 'Choose a service.' }).max(40),
    date: slotChoiceSchema.shape.date,
    slot: slotChoiceSchema.shape.slot,
    name: z.string({ error: 'Enter your name.' }).trim().min(2, { error: 'Enter your name.' }).max(80),
    phone: phoneSchema,
    email: z.preprocess((value) => (value === null || value === undefined ? '' : value), z.union([z.literal(''), emailSchema])),
    vehicleId: z.preprocess(blankToUndefined, z.coerce.number().int().positive().optional()),
    vehicleLabel: optionalText(80),
    registrationNumber: registrationSchema,
    notes: optionalText(500),
  })
  .superRefine((value, check) => {
    if (!value.vehicleId && !value.vehicleLabel) {
      check.addIssue({ code: 'custom', path: ['vehicleLabel'], message: 'Tell us which car you are bringing.' });
    }
  });

/**
 * Books a service on its own (no parts bought). Validates, then in one transaction re-checks the
 * slot and writes the booking with status 'requested'. Returns the bookings row. A second booking
 * by the same phone for the same slot is refused with 409 'duplicate_booking'.
 */
export function createBooking(ctx, request) {
  const input = parse(bookingSchema, request);
  const settings = ctx.settings.get();
  const service = settings.services.find((entry) => entry.id === input.serviceId);
  if (!service) throw badRequest('Choose one of the listed services.', { serviceId: 'Choose one of the listed services.' });
  const vehicleRow = input.vehicleId ? getVehicleRow(ctx, input.vehicleId) : null;
  if (input.vehicleId && !vehicleRow) throw badRequest('Choose your car again.', { vehicleId: 'We could not find that car. Choose it again.' });

  return ctx.db.tx(() => {
    const same = ctx.db.get(
      `SELECT booking_number FROM bookings WHERE phone = ? AND date = ? AND slot = ? AND status IN (SELECT value FROM json_each(?))`,
      [input.phone, input.date, input.slot, ACTIVE_BOOKING_STATUSES],
    );
    if (same) {
      throw conflict(`You already have this slot booked: ${same.booking_number}. Call us if you need to bring a second car.`, 'duplicate_booking');
    }
    assertSlotFree(ctx, input.date, input.slot, { settings });
    const clean = toStudioService(service);
    return insertBooking(ctx, {
      service_id: clean.id,
      service_name: clean.name,
      service_charge: clean.charge,
      service_minutes: clean.minutes,
      date: input.date,
      slot: input.slot,
      name: input.name,
      phone: input.phone,
      email: input.email,
      vehicle: vehicleRow ? vehicleLabel(vehicleRow) : input.vehicleLabel,
      vehicle_id: vehicleRow ? vehicleRow.id : null,
      registration_number: input.registrationNumber,
      notes: input.notes,
      status: 'requested',
    });
  });
}

// ---------------------------------------------------------------------------
// Emails
// ---------------------------------------------------------------------------

function storeOf(settings) {
  return {
    name: settings.storeName || 'Addon Automotive',
    phone: settings.phone || '',
    whatsapp: settings.whatsapp || '',
    orderEmail: settings.notifications?.orderEmail || settings.email || '',
    replyTo: settings.email || '',
    address: settings.studio?.address || '',
    mapUrl: settings.studio?.mapUrl || '',
  };
}

function detailLines(booking, store) {
  const lines = [
    ['Booking', booking.bookingNumber],
    ['Service', booking.serviceName],
    ['Fitting charge', booking.serviceCharge > 0 ? formatINR(booking.serviceCharge) : 'No charge'],
    ['When', `${formatDay(booking.date)} at ${formatSlot(booking.slot)}`],
    ['Car', [booking.vehicle, booking.registrationNumber].filter(Boolean).join(', ')],
  ];
  if (booking.orderNumber) lines.push(['Order', booking.orderNumber]);
  if (store.address) lines.push(['Studio', store.address]);
  if (store.mapUrl) lines.push(['Map', store.mapUrl]);
  return lines.filter(([, value]) => value);
}

function mail(store, { heading, intro, lines, outro }) {
  const text = [intro, '', ...lines.map(([label, value]) => `${label}: ${value}`), '', outro, '', `${store.name}${store.phone ? `: call ${store.phone}` : ''}`]
    .filter((line) => line !== undefined)
    .join('\n');
  const rows = lines
    .map(([label, value]) => `<tr><td style="padding:4px 12px 4px 0;color:#555">${escapeHtml(label)}</td><td style="padding:4px 0">${escapeHtml(value)}</td></tr>`)
    .join('');
  const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${escapeHtml(heading)}</title></head>
<body style="margin:0;padding:24px;background:#f4f4f4;color:#111;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5">
<div style="max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e2e2">
<div style="background:#111;color:#fff;padding:16px 24px;font-weight:bold;font-size:18px;border-bottom:4px solid #D7261E">${escapeHtml(store.name)}</div>
<div style="padding:24px"><h1 style="margin:0 0 12px;font-size:22px">${escapeHtml(heading)}</h1>
<p style="margin:0 0 16px">${escapeHtml(intro)}</p><table role="presentation" cellpadding="0" cellspacing="0">${rows}</table>
<p style="margin:16px 0 0">${escapeHtml(outro)}</p></div>
<div style="padding:16px 24px;border-top:1px solid #e2e2e2;color:#555;font-size:13px">${escapeHtml(store.name)}${store.phone ? ` &middot; Call ${escapeHtml(store.phone)}` : ''}${store.whatsapp ? ` &middot; WhatsApp ${escapeHtml(store.whatsapp)}` : ''}</div>
</div></body></html>`;
  return { text, html };
}

/**
 * Emails about a booking. kind: 'received' (customer copy plus a note to the store), 'confirmed',
 * 'moved' or 'cancelled' (customer only). Sends only to addresses that exist. Never throws.
 */
export function bookingNotices(ctx, booking, kind) {
  try {
    const store = storeOf(ctx.settings.get());
    const lines = detailLines(booking, store);
    const sends = [];
    const callUs = store.phone ? `Call us on ${store.phone} if you need to change it.` : 'Reply to this email if you need to change it.';
    const customer = {
      received: {
        subject: `Studio booking ${booking.bookingNumber}: ${formatDay(booking.date)}, ${formatSlot(booking.slot)}`,
        heading: 'We have your booking',
        intro: `Thank you, ${booking.name}. We have your studio booking and will call you to confirm it.`,
        outro: callUs,
      },
      confirmed: {
        subject: `Booking ${booking.bookingNumber} confirmed: ${formatDay(booking.date)}, ${formatSlot(booking.slot)}`,
        heading: 'Your booking is confirmed',
        intro: `${booking.name}, your studio slot is confirmed. Please bring the car a few minutes early.`,
        outro: callUs,
      },
      moved: {
        subject: `Booking ${booking.bookingNumber} moved to ${formatDay(booking.date)}, ${formatSlot(booking.slot)}`,
        heading: 'Your booking has a new time',
        intro: `${booking.name}, your studio booking has moved to the time below.`,
        outro: callUs,
      },
      cancelled: {
        subject: `Booking ${booking.bookingNumber} cancelled`,
        heading: 'Your booking is cancelled',
        intro: `${booking.name}, your studio booking below is cancelled.`,
        outro: store.phone ? `Call us on ${store.phone} to book another time.` : 'Reply to this email to book another time.',
      },
    }[kind];
    if (!customer) return Promise.resolve([]);
    if (booking.email) {
      const { text, html } = mail(store, { ...customer, lines });
      sends.push(ctx.mailer.send({ to: booking.email, subject: customer.subject, text, html, replyTo: store.replyTo || undefined }));
    }
    if (kind === 'received' && store.orderEmail) {
      const storeLines = [...lines, ['Name', booking.name], ['Phone', booking.phone], ['Email', booking.email], ['Notes', booking.notes]].filter(([, value]) => value);
      const { text, html } = mail(store, {
        heading: 'New studio booking',
        intro: `${booking.name} booked ${booking.serviceName} for ${formatDay(booking.date)} at ${formatSlot(booking.slot)}. Call to confirm it.`,
        lines: storeLines,
        outro: `Open the diary: ${ctx.config.publicUrl}/admin/bookings`,
      });
      sends.push(
        ctx.mailer.send({
          to: store.orderEmail,
          subject: `New studio booking ${booking.bookingNumber}: ${formatDay(booking.date)}, ${formatSlot(booking.slot)}`,
          text,
          html,
          replyTo: booking.email || undefined,
        }),
      );
    }
    return Promise.all(sends).catch((err) => console.error('[studio] Could not send a booking email', err));
  } catch (err) {
    console.error('[studio] Could not prepare a booking email', err);
    return Promise.resolve([]);
  }
}

/** The plain label of a booking status. */
export function bookingStatusText(status) {
  return STATUS_TEXT[status] ?? status;
}

export { toBooking };
