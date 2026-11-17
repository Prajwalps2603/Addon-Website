/**
 * India-specific reference data and checks: States and Union Territories with their
 * GST State codes, PIN code to State lookup, mobile numbers and GSTINs.
 */

/** All 28 States and 8 Union Territories. `code` is the two-digit GST State code. */
export const STATES = Object.freeze(
  [
    ['Andhra Pradesh', '37', 'state'],
    ['Arunachal Pradesh', '12', 'state'],
    ['Assam', '18', 'state'],
    ['Bihar', '10', 'state'],
    ['Chhattisgarh', '22', 'state'],
    ['Goa', '30', 'state'],
    ['Gujarat', '24', 'state'],
    ['Haryana', '06', 'state'],
    ['Himachal Pradesh', '02', 'state'],
    ['Jharkhand', '20', 'state'],
    ['Karnataka', '29', 'state'],
    ['Kerala', '32', 'state'],
    ['Madhya Pradesh', '23', 'state'],
    ['Maharashtra', '27', 'state'],
    ['Manipur', '14', 'state'],
    ['Meghalaya', '17', 'state'],
    ['Mizoram', '15', 'state'],
    ['Nagaland', '13', 'state'],
    ['Odisha', '21', 'state'],
    ['Punjab', '03', 'state'],
    ['Rajasthan', '08', 'state'],
    ['Sikkim', '11', 'state'],
    ['Tamil Nadu', '33', 'state'],
    ['Telangana', '36', 'state'],
    ['Tripura', '16', 'state'],
    ['Uttar Pradesh', '09', 'state'],
    ['Uttarakhand', '05', 'state'],
    ['West Bengal', '19', 'state'],
    ['Andaman and Nicobar Islands', '35', 'ut'],
    ['Chandigarh', '04', 'ut'],
    ['Dadra and Nagar Haveli and Daman and Diu', '26', 'ut'],
    ['Delhi', '07', 'ut'],
    ['Jammu and Kashmir', '01', 'ut'],
    ['Ladakh', '38', 'ut'],
    ['Lakshadweep', '31', 'ut'],
    ['Puducherry', '34', 'ut'],
  ].map(([name, code, type]) => Object.freeze({ name, code, type })),
);

// A GSTIN may also start with 97, the code for "Other Territory".
const OTHER_TERRITORY_CODE = '97';

const stateKey = (value) =>
  String(value ?? '')
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');

const STATE_BY_KEY = new Map(STATES.map((state) => [stateKey(state.name), state]));
const STATE_BY_CODE = new Map(STATES.map((state) => [state.code, state]));

for (const [alias, name] of [
  ['NCT of Delhi', 'Delhi'],
  ['New Delhi', 'Delhi'],
  ['Orissa', 'Odisha'],
  ['Pondicherry', 'Puducherry'],
  ['Uttaranchal', 'Uttarakhand'],
  ['Jammu & Kashmir', 'Jammu and Kashmir'],
  ['Andaman and Nicobar', 'Andaman and Nicobar Islands'],
  ['Dadra and Nagar Haveli', 'Dadra and Nagar Haveli and Daman and Diu'],
  ['Daman and Diu', 'Dadra and Nagar Haveli and Daman and Diu'],
]) {
  STATE_BY_KEY.set(stateKey(alias), STATE_BY_KEY.get(stateKey(name)));
}

/** Looks a State up by name (any case, common old names accepted) or by GST code. Returns the STATES entry or null. */
export function findState(nameOrCode) {
  const input = String(nameOrCode ?? '').trim();
  if (!input) return null;
  if (/^\d{1,2}$/.test(input)) return STATE_BY_CODE.get(input.padStart(2, '0')) ?? null;
  return STATE_BY_KEY.get(stateKey(input)) ?? null;
}

/** The GST State code for a State name, or '' when the name is not recognised. */
export function stateCode(name) {
  return findState(name)?.code ?? '';
}

// PIN prefix to State. The longest matching prefix wins, so the short entries are the
// broad sorting regions and the longer ones carve out the places that sit inside another
// State's range (Goa inside Maharashtra's 40-44, Uttarakhand inside Uttar Pradesh's 24-26, ...).
// A few prefixes are still shared at post-office level, so treat the answer as a
// suggestion to confirm, never as a reason to reject an address.
const PIN_PREFIXES = new Map();
function assign(state, ...prefixes) {
  for (const prefix of prefixes) PIN_PREFIXES.set(String(prefix), state);
}
function range(from, to) {
  return Array.from({ length: to - from + 1 }, (_, index) => from + index);
}

assign('Delhi', 11);
assign('Haryana', 12, 13);
assign('Punjab', 14, 15);
assign('Chandigarh', 16);
assign('Himachal Pradesh', 17);
assign('Jammu and Kashmir', 18, 19);
assign('Ladakh', 194);
assign('Uttar Pradesh', ...range(20, 28));
assign('Uttarakhand', 2447, 246, 2476, 248, 249, 2623, 2624, 2625, 263);
assign('Uttar Pradesh', 2467);
assign('Rajasthan', ...range(30, 34));
assign('Gujarat', ...range(36, 39));
assign('Dadra and Nagar Haveli and Daman and Diu', 3962);
assign('Maharashtra', ...range(40, 44));
assign('Goa', 403);
assign('Madhya Pradesh', ...range(45, 48));
assign('Chhattisgarh', 49);
assign('Telangana', 50);
assign('Andhra Pradesh', 51, 52, 53);
assign('Karnataka', ...range(56, 59));
assign('Tamil Nadu', ...range(60, 66));
assign('Puducherry', 605);
assign('Kerala', 67, 68, 69);
assign('Lakshadweep', 68255);
assign('West Bengal', ...range(70, 74));
assign('Sikkim', 737);
assign('Andaman and Nicobar Islands', 744);
assign('Odisha', 75, 76, 77);
assign('Assam', 78);
assign('Arunachal Pradesh', 790, 791, 792);
assign('Meghalaya', 793, 794);
assign('Manipur', 795);
assign('Mizoram', 796);
assign('Nagaland', 797, 798);
assign('Tripura', 799);
assign('Bihar', ...range(80, 85));
assign('Jharkhand', 814, 815, 816, 822, ...range(825, 829), 83);

/** True for a six-digit Indian PIN code (first digit 1 to 9). */
export function isValidPincode(pincode) {
  return /^[1-9]\d{5}$/.test(String(pincode ?? '').trim());
}

/**
 * The State a PIN code most likely belongs to, as a STATES name, or null when the PIN is
 * malformed or outside the civilian ranges (9x is the Army Postal Service).
 */
export function stateFromPincode(pincode) {
  const pin = String(pincode ?? '').trim();
  if (!isValidPincode(pin)) return null;
  for (let length = 5; length >= 2; length -= 1) {
    const state = PIN_PREFIXES.get(pin.slice(0, length));
    if (state) return state;
  }
  return null;
}

/**
 * An Indian mobile number as ten digits, or null when it is not one.
 * Accepts spaces, hyphens, brackets, a leading +91, 91 or 0.
 */
export function normalizePhone(input) {
  if (typeof input !== 'string' && typeof input !== 'number') return null;
  let digits = String(input).replace(/[\s\-().]/g, '');
  if (digits.startsWith('+91')) digits = digits.slice(3);
  else if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  else if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (!/^[6-9]\d{9}$/.test(digits)) return null;
  if (/^(\d)\1{9}$/.test(digits)) return null;
  return digits;
}

// State code, ten-character PAN, entity number, the letter Z, check character.
const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** True when the text has the GSTIN layout and starts with a real GST State code. Case and outer spaces are ignored. */
export function isValidGstin(gstin) {
  const value = String(gstin ?? '').trim().toUpperCase();
  if (!GSTIN_PATTERN.test(value)) return false;
  const code = value.slice(0, 2);
  return STATE_BY_CODE.has(code) || code === OTHER_TERRITORY_CODE;
}

/** The State a GSTIN is registered in (a STATES entry), or null. */
export function stateFromGstin(gstin) {
  if (!isValidGstin(gstin)) return null;
  return STATE_BY_CODE.get(String(gstin).trim().slice(0, 2)) ?? null;
}
