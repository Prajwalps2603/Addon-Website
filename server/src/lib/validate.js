import * as z from 'zod';
import { badRequest } from './errors.js';
import { findState, isValidGstin, normalizePhone } from './india.js';

// Plain wording for the checks routes use most. A message written on the schema itself
// ({ error: '...' }) always wins over these.
function plainMessage(issue) {
  switch (issue.code) {
    case 'invalid_type':
      if (issue.input === undefined || issue.input === null) return 'This is required.';
      if (issue.expected === 'number' || issue.expected === 'int') return 'Enter a number.';
      return 'This value is not valid.';
    case 'too_small':
      if (issue.origin === 'string') {
        return issue.minimum <= 1 ? 'This is required.' : `Use at least ${issue.minimum} characters.`;
      }
      if (issue.origin === 'array') return issue.minimum <= 1 ? 'Add at least one.' : `Add at least ${issue.minimum}.`;
      return issue.inclusive ? `Must be ${issue.minimum} or more.` : `Must be more than ${issue.minimum}.`;
    case 'too_big':
      if (issue.origin === 'string') return `Keep this to ${issue.maximum} characters or fewer.`;
      if (issue.origin === 'array') return `No more than ${issue.maximum} allowed.`;
      return issue.inclusive ? `Must be ${issue.maximum} or less.` : `Must be less than ${issue.maximum}.`;
    case 'invalid_value':
      return 'Choose one of the listed options.';
    case 'invalid_format':
      if (issue.format === 'email') return 'Enter a valid email address.';
      if (issue.format === 'url') return 'Enter a full web address starting with https://';
      if (issue.format === 'datetime' || issue.format === 'date') return 'Enter a valid date.';
      return 'This is not in the right format.';
    default:
      return undefined;
  }
}

/**
 * Zod issues as the 400 `validation_error` to throw. Each issue lands in `fields` under its
 * dotted path ({ 'shippingAddress.pincode': 'Enter a 6 digit PIN code' }). An issue about the
 * value as a whole (a bare id, a cross-field rule with no path) becomes the message instead.
 */
export function validationError(issues) {
  const fields = {};
  let message = null;
  for (const issue of issues) {
    if (issue.path.length === 0) {
      message ??= issue.message;
      continue;
    }
    const key = issue.path.join('.');
    if (!(key in fields)) fields[key] = issue.message;
  }
  return badRequest(message ?? 'Check the details and try again.', fields);
}

// An absent body (Express 5 leaves req.body undefined) should report each missing field,
// not one "expected object" error, when the schema describes an object.
function expectsObject(schema) {
  const def = schema?.def;
  if (def?.type === 'object') return true;
  return def?.type === 'pipe' && expectsObject(def.in);
}

/**
 * Validates data against a Zod schema and returns the parsed value.
 * On failure throws a 400 `validation_error` whose `fields` lists every problem by dotted path.
 */
export function parse(schema, data) {
  const input = data === undefined && expectsObject(schema) ? {} : data;
  const result = schema.safeParse(input, { error: plainMessage });
  if (result.success) return result.data;
  throw validationError(result.error.issues);
}

/** An Indian mobile number in any common form. Parses to ten digits. */
export const phoneSchema = z.string({ error: 'Enter a 10 digit mobile number' }).transform((value, ctx) => {
  const phone = normalizePhone(value);
  if (phone) return phone;
  ctx.issues.push({ code: 'custom', message: 'Enter a 10 digit mobile number', input: value });
  return z.NEVER;
});

/** A six-digit PIN code. */
export const pincodeSchema = z
  .string({ error: 'Enter a 6 digit PIN code' })
  .trim()
  .regex(/^[1-9]\d{5}$/, { error: 'Enter a 6 digit PIN code' });

/** An email address, trimmed and lower-cased. */
export const emailSchema = z
  .string({ error: 'Enter a valid email address' })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: 'Enter a valid email address' }));

/** A new password. bcrypt reads only the first 72 bytes, so longer ones are refused. */
export const passwordSchema = z
  .string({ error: 'Enter a password' })
  .min(8, { error: 'Use at least 8 characters' })
  .max(72, { error: 'Use 72 characters or fewer' });

/** A State or Union Territory by name or GST code. Parses to the official name used in STATES. */
export const stateSchema = z.string({ error: 'Choose a State' }).transform((value, ctx) => {
  const state = findState(value);
  if (state) return state.name;
  ctx.issues.push({ code: 'custom', message: 'Choose a State', input: value });
  return z.NEVER;
});

/** A GSTIN, upper-cased. */
export const gstinSchema = z
  .string({ error: 'Enter a valid 15 character GSTIN' })
  .trim()
  .toUpperCase()
  .refine(isValidGstin, { error: 'Enter a valid 15 character GSTIN' });

/** A positive integer id from a route parameter or query string: parse(idParam, req.params.id). */
export const idParam = z.coerce.number({ error: 'That id is not valid' }).int({ error: 'That id is not valid' }).positive({ error: 'That id is not valid' });

/** Builds a { page, limit } query schema. Other query keys are ignored. */
export function paginationOf({ defaultLimit = 20, maxLimit = 100 } = {}) {
  return z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
  });
}

/** { page, limit } with limit 20 by default and 100 at most: parse(pagination, req.query). */
export const pagination = paginationOf();

/** Wraps one page of rows in the Paginated<T> shape. */
export function paginated(items, total, { page, limit }) {
  return { items, total, page, pages: Math.max(1, Math.ceil(total / limit)), limit };
}

/** AddressInput from api.ts. Parses to a complete address with the State name normalised. */
export const addressSchema = z.object({
  label: z.string().trim().max(30).optional().transform((value) => value || 'Home'),
  name: z.string().trim().min(2, { error: 'Enter the full name' }).max(80),
  phone: phoneSchema,
  line1: z.string().trim().min(3, { error: 'Enter the house number and street' }).max(120),
  line2: z.string().trim().max(120).default(''),
  landmark: z.string().trim().max(120).default(''),
  city: z.string().trim().min(2, { error: 'Enter the town or city' }).max(60),
  state: stateSchema,
  pincode: pincodeSchema,
  isDefault: z.boolean().default(false),
});
