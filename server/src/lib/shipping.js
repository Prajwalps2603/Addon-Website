/**
 * Delivery estimates by PIN code: ShippingEstimate of api.ts.
 *
 * The State comes from the PIN prefix (lib/india.js), so it is a good guess, not a courier promise.
 * Working days = settings.shipping.dispatchDays + transit by distance from the store's origin PIN:
 *   same State as the store          1-3
 *   same region (north, west, ...)   3-5
 *   rest of India                    4-7
 *   North-East, J&K, Ladakh, islands 6-10 (no cash on delivery)
 * With no origin PIN set, every non-remote destination gets 3-7.
 * Dates count working days and skip Sundays.
 */
import { badRequest } from './errors.js';
import { findState, isValidPincode, stateFromPincode } from './india.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 330 * 60 * 1000;

// Couriers treat these as special zones: slower, and most will not collect cash there.
const REMOTE_STATES = new Set([
  'Arunachal Pradesh',
  'Assam',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Tripura',
  'Sikkim',
  'Jammu and Kashmir',
  'Ladakh',
  'Andaman and Nicobar Islands',
  'Lakshadweep',
]);

const REGIONS = {
  north: ['Delhi', 'Haryana', 'Punjab', 'Chandigarh', 'Himachal Pradesh', 'Uttarakhand', 'Uttar Pradesh', 'Rajasthan', 'Jammu and Kashmir', 'Ladakh'],
  west: ['Gujarat', 'Maharashtra', 'Goa', 'Dadra and Nagar Haveli and Daman and Diu'],
  central: ['Madhya Pradesh', 'Chhattisgarh'],
  south: ['Karnataka', 'Tamil Nadu', 'Kerala', 'Andhra Pradesh', 'Telangana', 'Puducherry', 'Lakshadweep', 'Andaman and Nicobar Islands'],
  east: ['West Bengal', 'Odisha', 'Bihar', 'Jharkhand'],
  northeast: ['Assam', 'Arunachal Pradesh', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland', 'Tripura', 'Sikkim'],
};
const REGION_OF = new Map(Object.entries(REGIONS).flatMap(([region, states]) => states.map((state) => [state, region])));

export const TRANSIT = Object.freeze({
  sameState: [1, 3],
  region: [3, 5],
  national: [4, 7],
  remote: [6, 10],
  unknownOrigin: [3, 7],
});

/** True when the State is in the courier special zone (North-East, J&K, Ladakh, the islands). */
export function isRemoteState(state) {
  return REMOTE_STATES.has(findState(state)?.name ?? '');
}

/** Today's date in India as a UTC-midnight Date, from an ISO instant. */
function indiaDay(nowIso) {
  const ms = Date.parse(nowIso);
  const shifted = new Date((Number.isFinite(ms) ? ms : Date.now()) + IST_OFFSET_MS);
  return Date.UTC(shifted.getUTCFullYear(), shifted.getUTCMonth(), shifted.getUTCDate());
}

/** 'YYYY-MM-DD' that many working days (Sundays skipped) after the India date of `nowIso`. */
export function addWorkingDays(nowIso, days) {
  let day = indiaDay(nowIso);
  let left = Math.max(0, Math.trunc(days) || 0);
  while (left > 0) {
    day += DAY_MS;
    if (new Date(day).getUTCDay() !== 0) left -= 1;
  }
  return new Date(day).toISOString().slice(0, 10);
}

const shortDate = new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
const formatDay = (ymd) => shortDate.format(new Date(`${ymd}T00:00:00Z`));

function transitFor(destState, originState) {
  if (originState && destState === originState) return { range: TRANSIT.sameState, zone: 'same_state' };
  if (REMOTE_STATES.has(destState)) return { range: TRANSIT.remote, zone: 'remote' };
  if (!originState) return { range: TRANSIT.unknownOrigin, zone: 'unknown_origin' };
  if (REGION_OF.get(destState) && REGION_OF.get(destState) === REGION_OF.get(originState)) {
    return { range: TRANSIT.region, zone: 'region' };
  }
  return { range: TRANSIT.national, zone: 'national' };
}

/**
 * ShippingEstimate for a PIN code. Throws a 400 when the PIN is not six digits.
 * A PIN whose prefix we cannot place comes back serviceable: false with a message, never a throw.
 */
export function estimateShipping(ctx, pincode) {
  const pin = String(pincode ?? '').trim();
  if (!isValidPincode(pin)) throw badRequest('Enter a 6 digit PIN code', { pincode: 'Enter a 6 digit PIN code' });

  const state = stateFromPincode(pin);
  if (!state) {
    return {
      pincode: pin,
      serviceable: false,
      state: '',
      minDays: 0,
      maxDays: 0,
      earliest: '',
      latest: '',
      codAvailable: false,
      message: 'We could not place this PIN code. Check it, or message us and we will confirm whether we deliver there.',
    };
  }

  const { shipping } = ctx.settings.get();
  const dispatchDays = Math.max(0, Math.trunc(Number(shipping.dispatchDays)) || 0);
  const originState = shipping.originPincode ? stateFromPincode(shipping.originPincode) : null;
  const { range, zone } = transitFor(state, originState);
  const minDays = dispatchDays + range[0];
  const maxDays = dispatchDays + range[1];
  const now = ctx.now();
  const earliest = addWorkingDays(now, minDays);
  const latest = addWorkingDays(now, maxDays);
  const codAvailable = zone !== 'remote';

  let message = `Delivery to ${state} in ${minDays} to ${maxDays} working days, between ${formatDay(earliest)} and ${formatDay(latest)}.`;
  if (!codAvailable) message += ' Cash on delivery does not reach this area, so pay online.';

  return { pincode: pin, serviceable: true, state, minDays, maxDays, earliest, latest, codAvailable, message };
}
