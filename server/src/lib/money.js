import { findState } from './india.js';

const rupees = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 });
const rupeesAndPaise = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** Rupees with Indian digit grouping: formatINR(119999) is '₹1,19,999'. Pass { paise: true } for two decimals. */
export function formatINR(amount, { paise = false } = {}) {
  return (paise ? rupeesAndPaise : rupees).format(Number(amount) || 0);
}

/** Whole-number percent that price is below MRP, rounded down so a discount is never overstated. 0 when price >= mrp. */
export function percentOff(price, mrp) {
  if (!(mrp > 0) || !(price < mrp)) return 0;
  return Math.max(0, Math.floor(((mrp - price) * 100) / mrp));
}

/** The price after a drop of `percent`. Matches the sale_price column of the v_products view exactly. */
export function applyDrop(price, percent) {
  if (!percent) return price;
  return Math.round((price * (100 - percent)) / 100);
}

function sameState(a, b) {
  const first = findState(a);
  const second = findState(b);
  if (first && second) return first.code === second.code;
  return a.toLowerCase() === b.toLowerCase();
}

/**
 * True when GST on a sale is IGST: the store and the delivery address are in different States.
 * States may be names or GST codes. A blank State on either side counts as the same State.
 */
export function isInterState(storeState, shipState) {
  const store = String(storeState ?? '').trim();
  const ship = String(shipState ?? '').trim();
  return Boolean(store && ship && !sameState(store, ship));
}

// Tax is worked out in whole paise, per rate, so the parts always add back up to the amount charged.
function splitByRate(lines, interState) {
  const paiseByRate = new Map();
  for (const line of lines ?? []) {
    const rate = Number(line.gstRate) > 0 ? Number(line.gstRate) : 0;
    paiseByRate.set(rate, (paiseByRate.get(rate) ?? 0) + Math.round((Number(line.amount) || 0) * 100));
  }
  return [...paiseByRate.entries()]
    .sort(([a], [b]) => a - b)
    .map(([gstRate, amount]) => {
      if (interState) {
        const igst = Math.round((amount * gstRate) / (100 + gstRate));
        return { gstRate, amount, taxable: amount - igst, cgst: 0, sgst: 0, igst };
      }
      const half = Math.round((amount * (gstRate / 2)) / (100 + gstRate));
      return { gstRate, amount, taxable: amount - 2 * half, cgst: half, sgst: half, igst: 0 };
    });
}

/**
 * The GST inside GST-inclusive amounts, one row per tax rate: the detail an invoice or the
 * accountant's export needs. `lines` are { amount, gstRate }: amount is rupees charged after
 * discounts, gstRate is a percent such as 18.
 * Returns [{ gstRate, amount, taxableValue, cgst, sgst, igst, gst }] in rupees with two decimals, lowest rate first.
 */
export function taxByRate(lines, { storeState = '', shipState = '' } = {}) {
  return splitByRate(lines, isInterState(storeState, shipState)).map((row) => ({
    gstRate: row.gstRate,
    amount: row.amount / 100,
    taxableValue: row.taxable / 100,
    cgst: row.cgst / 100,
    sgst: row.sgst / 100,
    igst: row.igst / 100,
    gst: (row.cgst + row.sgst + row.igst) / 100,
  }));
}

/**
 * The TaxBreakdown of api.ts for an order or cart.
 * `lines` are { amount, gstRate } with GST-inclusive rupee amounts after discounts (pass shipping
 * and the COD fee as lines of their own). CGST + SGST when the delivery State is the store's State
 * or either is blank, IGST otherwise.
 */
export function taxBreakdown(lines, { storeState = '', shipState = '' } = {}) {
  const interState = isInterState(storeState, shipState);
  const sum = { taxable: 0, cgst: 0, sgst: 0, igst: 0 };
  for (const row of splitByRate(lines, interState)) {
    sum.taxable += row.taxable;
    sum.cgst += row.cgst;
    sum.sgst += row.sgst;
    sum.igst += row.igst;
  }
  return {
    taxableValue: sum.taxable / 100,
    gst: (sum.cgst + sum.sgst + sum.igst) / 100,
    cgst: sum.cgst / 100,
    sgst: sum.sgst / 100,
    igst: sum.igst / 100,
    isInterState: interState,
  };
}
