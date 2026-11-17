/** Indian states and union territories with their GST state codes, in the order of the code. */
export const STATES: readonly { name: string; code: string }[] = [
  { name: 'Jammu and Kashmir', code: '01' },
  { name: 'Himachal Pradesh', code: '02' },
  { name: 'Punjab', code: '03' },
  { name: 'Chandigarh', code: '04' },
  { name: 'Uttarakhand', code: '05' },
  { name: 'Haryana', code: '06' },
  { name: 'Delhi', code: '07' },
  { name: 'Rajasthan', code: '08' },
  { name: 'Uttar Pradesh', code: '09' },
  { name: 'Bihar', code: '10' },
  { name: 'Sikkim', code: '11' },
  { name: 'Arunachal Pradesh', code: '12' },
  { name: 'Nagaland', code: '13' },
  { name: 'Manipur', code: '14' },
  { name: 'Mizoram', code: '15' },
  { name: 'Tripura', code: '16' },
  { name: 'Meghalaya', code: '17' },
  { name: 'Assam', code: '18' },
  { name: 'West Bengal', code: '19' },
  { name: 'Jharkhand', code: '20' },
  { name: 'Odisha', code: '21' },
  { name: 'Chhattisgarh', code: '22' },
  { name: 'Madhya Pradesh', code: '23' },
  { name: 'Gujarat', code: '24' },
  { name: 'Dadra and Nagar Haveli and Daman and Diu', code: '26' },
  { name: 'Maharashtra', code: '27' },
  { name: 'Karnataka', code: '29' },
  { name: 'Goa', code: '30' },
  { name: 'Lakshadweep', code: '31' },
  { name: 'Kerala', code: '32' },
  { name: 'Tamil Nadu', code: '33' },
  { name: 'Puducherry', code: '34' },
  { name: 'Andaman and Nicobar Islands', code: '35' },
  { name: 'Telangana', code: '36' },
  { name: 'Andhra Pradesh', code: '37' },
  { name: 'Ladakh', code: '38' },
];

/** State names in alphabetical order, for a select box. */
export const STATE_NAMES: readonly string[] = STATES.map((state) => state.name).sort((a, b) => a.localeCompare(b));

export function isValidState(name: string): boolean {
  return STATES.some((state) => state.name === name);
}

/** Six digits, not starting with 0. */
export function isValidPincode(value: string | null | undefined): boolean {
  return /^[1-9]\d{5}$/.test((value ?? '').trim());
}

/**
 * Reduces what people type ('+91 98765 43210', '098765-43210') to the ten-digit
 * mobile number, or null when it is not an Indian mobile number.
 * The same rule as server/src/lib/india.js, so a number accepted here is accepted there.
 */
export function normalizePhone(input: string | null | undefined): string | null {
  let digits = (input ?? '').replace(/[\s\-().]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  // Ten identical digits is a placeholder, not a phone.
  return /^(\d)\1{9}$/.test(digits) ? null : digits;
}

export function isValidPhone(input: string | null | undefined): boolean {
  return normalizePhone(input) !== null;
}

/** '9876543210' → '98765 43210'. Returns the input unchanged when it is not a mobile number. */
export function formatPhone(input: string | null | undefined): string {
  const phone = normalizePhone(input);
  return phone ? `${phone.slice(0, 5)} ${phone.slice(5)}` : (input ?? '');
}

const GSTIN_SHAPE = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const GSTIN_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';
/** A GSTIN may also start with 97, the code for "Other Territory". */
const OTHER_TERRITORY_CODE = '97';

function gstinCheckCharacter(first14: string): string {
  let sum = 0;
  for (let i = 0; i < first14.length; i += 1) {
    const product = GSTIN_ALPHABET.indexOf(first14.charAt(i)) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / 36) + (product % 36);
  }
  return GSTIN_ALPHABET.charAt((36 - (sum % 36)) % 36);
}

/**
 * Checks the shape, the state code and the check character of a 15-character GSTIN.
 * The server checks shape and state code; the check character is tested here so a typing
 * slip is caught before it reaches an invoice.
 */
export function isValidGstin(input: string | null | undefined): boolean {
  const gstin = (input ?? '').trim().toUpperCase();
  if (!GSTIN_SHAPE.test(gstin)) return false;
  const stateCode = gstin.slice(0, 2);
  if (stateCode !== OTHER_TERRITORY_CODE && !STATES.some((state) => state.code === stateCode)) return false;
  return gstinCheckCharacter(gstin.slice(0, 14)) === gstin.charAt(14);
}
