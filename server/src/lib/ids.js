import crypto from 'node:crypto';

const STORE_CODE = 'ADN';
// No 0/O, 1/I/L: codes are read out over the phone and typed from a parcel label.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const IST_OFFSET_MS = 330 * 60 * 1000;
const INVOICE_MAX_LENGTH = 16;

/** 'Addon Aero Spoiler, Gloss Black (Swift)' becomes 'addon-aero-spoiler-gloss-black-swift'. May return ''. */
export function slugify(text) {
  return String(text ?? '')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['’]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/, '');
}

/**
 * A slug that no row of `table` uses yet: 'roof-spoiler', then 'roof-spoiler-2', ...
 * `table` is a table with `id` and `slug` columns (products, categories, builds).
 * Pass { excludeId } when updating a row so it may keep its own slug.
 */
export function uniqueSlug(ctx, table, base, { excludeId = null } = {}) {
  if (!/^[a-z_][a-z0-9_]*$/.test(table)) throw new Error(`uniqueSlug: "${table}" is not a table name`);
  const root = slugify(base) || 'item';
  const taken = (slug) => {
    const row = ctx.db.get(`SELECT id FROM ${table} WHERE slug = ?`, [slug]);
    return Boolean(row) && row.id !== excludeId;
  };
  let slug = root;
  for (let n = 2; taken(slug); n += 1) slug = `${root}-${n}`;
  return slug;
}

/** A URL-safe random string for access tokens, quote links and the like. 24 bytes gives 32 characters. */
export function randomToken(bytes = 24) {
  return crypto.randomBytes(bytes).toString('base64url');
}

function randomCode(length) {
  let code = '';
  for (let i = 0; i < length; i += 1) code += CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)];
  return code;
}

// The calendar date in India for an instant, read through the UTC getters of the returned Date.
function inIndia(value) {
  const instant = value instanceof Date ? value : new Date(value ?? Date.now());
  if (Number.isNaN(instant.getTime())) throw new TypeError('Expected a date');
  return new Date(instant.getTime() + IST_OFFSET_MS);
}

const twoDigits = (n) => String(n % 100).padStart(2, '0');

/**
 * A new order number such as ADN-261117-4F7K: the date in India, then four random characters.
 * With ctx it uses ctx.now() and never returns a number an order already has.
 */
export function orderNumber(ctx) {
  const day = inIndia(ctx ? ctx.now() : undefined);
  const stamp = `${twoDigits(day.getUTCFullYear())}${twoDigits(day.getUTCMonth() + 1)}${twoDigits(day.getUTCDate())}`;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const candidate = `${STORE_CODE}-${stamp}-${randomCode(4)}`;
    if (!ctx || !ctx.db.get('SELECT 1 AS used FROM orders WHERE order_number = ?', [candidate])) return candidate;
  }
  throw new Error('Could not find a free order number');
}

/** The next enquiry ticket number, in sequence: ADN-T-000123. Insert the enquiry in the same synchronous block. */
export function ticketNumber(ctx) {
  const head = `${STORE_CODE}-T-`;
  const row = ctx.db.get(
    'SELECT MAX(CAST(substr(ticket_number, ?) AS INTEGER)) AS last FROM enquiries WHERE substr(ticket_number, 1, ?) = ?',
    [head.length + 1, head.length, head],
  );
  return `${head}${String((row?.last ?? 0) + 1).padStart(6, '0')}`;
}

/** The Indian financial year (1 April to 31 March) an instant falls in: { startYear: 2026, label: '26-27' }. */
export function financialYear(date) {
  const day = inIndia(date);
  const startYear = day.getUTCMonth() >= 3 ? day.getUTCFullYear() : day.getUTCFullYear() - 1;
  return { startYear, label: `${twoDigits(startYear)}-${twoDigits(startYear + 1)}` };
}

/**
 * The next tax invoice number, such as ADN/26-27/0001: consecutive within the financial year,
 * restarting each 1 April, at most 16 characters (CGST Rule 46).
 * Call it inside the ctx.db.tx() that inserts the order, so a rolled-back order leaves no gap.
 * `date` defaults to ctx.now(). The prefix comes from settings.invoice.prefix.
 */
export function invoiceNumber(ctx, date) {
  const prefix = ctx.settings.get().invoice.prefix || STORE_CODE;
  const head = `${prefix}/${financialYear(date ?? ctx.now()).label}/`;
  const row = ctx.db.get(
    'SELECT MAX(CAST(substr(invoice_number, ?) AS INTEGER)) AS last FROM orders WHERE substr(invoice_number, 1, ?) = ?',
    [head.length + 1, head.length, head],
  );
  const number = `${head}${String((row?.last ?? 0) + 1).padStart(4, '0')}`;
  if (number.length > INVOICE_MAX_LENGTH) {
    throw new Error(`Invoice number ${number} is longer than ${INVOICE_MAX_LENGTH} characters. Shorten the invoice prefix in settings.`);
  }
  return number;
}
