/**
 * The arithmetic of the tax invoice. It mirrors server/src/lib/mappers.js (orderTaxLines) and
 * money.js (taxByRate), so the figures here add up to the order's own TaxBreakdown to the paisa:
 *  - coupon and prepaid discounts are spread over the items in proportion to their value,
 *    rounding the running total so the shares always add back up;
 *  - delivery and the COD fee carry the highest GST rate among the items (18 when none has one);
 *  - studio fitting charges are never discounted and are a service at 18%, shown one line per fitted item;
 *  - GST is taken out of GST-inclusive amounts in whole paise, per rate.
 */
import type { Order } from '@/types/api';

const DEFAULT_GST_RATE = 18;
/** GST on studio fitting work, as server/src/lib/mappers.js FITTING_GST_RATE. */
const FITTING_GST_RATE = 18;

export interface InvoiceLine {
  key: string;
  kind: 'item' | 'fee' | 'fitting';
  description: string;
  detail: string;
  /** The design payload of a customised item (a show plate), null otherwise. */
  custom: Record<string, unknown> | null;
  sku: string;
  hsn: string;
  qty: number;
  /** GST-inclusive unit price, rupees. */
  unitPrice: number;
  /** Before discount, rupees. */
  gross: number;
  /** Share of the order's discounts, rupees (2 decimals). */
  discount: number;
  /** What was charged for the line after discounts, rupees (2 decimals). */
  amount: number;
  gstRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst: number;
}

export interface RateRow {
  gstRate: number;
  taxable: number;
  cgst: number;
  sgst: number;
  igst: number;
  gst: number;
  amount: number;
}

function splitPaise(amountPaise: number, gstRate: number, interState: boolean) {
  if (interState) {
    const igst = Math.round((amountPaise * gstRate) / (100 + gstRate));
    return { taxable: amountPaise - igst, cgst: 0, sgst: 0, igst };
  }
  const half = Math.round((amountPaise * (gstRate / 2)) / (100 + gstRate));
  return { taxable: amountPaise - 2 * half, cgst: half, sgst: half, igst: 0 };
}

const rupees = (paise: number) => paise / 100;

export function invoiceLines(order: Order): InvoiceLine[] {
  const interState = order.tax.isInterState;
  const shippingFee = Math.max(0, Math.round(order.shippingFee));
  const codFee = Math.max(0, Math.round(order.codFee));
  const fittingTotal = Math.max(0, Math.round(order.fittingTotal ?? 0));
  const goodsPaise = Math.max(0, Math.round(order.total) - shippingFee - codFee - fittingTotal) * 100;
  const values = order.items.map((item) => Math.max(0, Math.round(item.price) * Math.round(item.qty)));
  const gross = values.reduce((sum, value) => sum + value, 0);
  const feeRate = order.items.reduce((highest, item) => Math.max(highest, Math.round(item.gstRate)), 0) || DEFAULT_GST_RATE;

  const lines: InvoiceLine[] = [];
  let running = 0;
  let allotted = 0;
  order.items.forEach((item, index) => {
    running += values[index] ?? 0;
    const upTo = gross > 0 ? Math.round((goodsPaise * running) / gross) : 0;
    const amountPaise = upTo - allotted;
    allotted = upTo;
    const rate = item.gstRate > 0 ? Math.round(item.gstRate) : 0;
    const tax = splitPaise(amountPaise, rate, interState);
    lines.push({
      key: `item-${item.id}`,
      kind: 'item',
      description: item.name,
      detail: item.variantName,
      custom: item.custom,
      sku: item.sku,
      hsn: item.hsnCode,
      qty: item.qty,
      unitPrice: item.price,
      gross: values[index] ?? 0,
      discount: rupees((values[index] ?? 0) * 100 - amountPaise),
      amount: rupees(amountPaise),
      gstRate: rate,
      taxable: rupees(tax.taxable),
      cgst: rupees(tax.cgst),
      sgst: rupees(tax.sgst),
      igst: rupees(tax.igst),
      gst: rupees(tax.cgst + tax.sgst + tax.igst),
    });
  });

  const fee = (key: string, description: string, amount: number, options: { kind?: InvoiceLine['kind']; detail?: string; rate?: number } = {}) => {
    const rate = options.rate ?? feeRate;
    const tax = splitPaise(amount * 100, rate, interState);
    lines.push({
      key,
      kind: options.kind ?? 'fee',
      description,
      detail: options.detail ?? '',
      custom: null,
      sku: '',
      hsn: '',
      qty: 1,
      unitPrice: amount,
      gross: amount,
      discount: 0,
      amount,
      gstRate: rate,
      taxable: rupees(tax.taxable),
      cgst: rupees(tax.cgst),
      sgst: rupees(tax.sgst),
      igst: rupees(tax.igst),
      gst: rupees(tax.cgst + tax.sgst + tax.igst),
    });
  };
  // Studio fitting: one line per fitted item when the items account for the whole charge, else one line.
  if (fittingTotal > 0) {
    const fitted = order.items.filter((item) => item.fitAtStudio && item.fittingCharge > 0);
    const sum = fitted.reduce((total, item) => total + Math.round(item.fittingCharge), 0);
    if (fitted.length > 0 && sum === fittingTotal) {
      for (const item of fitted) {
        fee(`fitting-${item.id}`, `Studio fitting: ${item.fittingServiceName || 'fitting service'}`, Math.round(item.fittingCharge), {
          kind: 'fitting',
          detail: `For ${item.name}${item.qty > 1 ? ` (${item.qty} fitted)` : ''}`,
          rate: FITTING_GST_RATE,
        });
      }
    } else {
      fee('fitting', 'Studio fitting', fittingTotal, { kind: 'fitting', rate: FITTING_GST_RATE });
    }
  }
  if (shippingFee > 0) fee('delivery', 'Delivery charge', shippingFee);
  if (codFee > 0) fee('cod', 'Cash on delivery fee', codFee);
  return shareRateTax(lines, interState);
}

/**
 * The server rounds GST once per rate, on the pooled amount. Rounding each line on its own can be a
 * paisa or two off that, so each rate's tax is shared across its lines by running total instead:
 * the line columns then add up exactly to the GST-by-rate table and the order's totals.
 */
function shareRateTax(lines: InvoiceLine[], interState: boolean): InvoiceLine[] {
  const byRate = new Map<number, InvoiceLine[]>();
  for (const line of lines) byRate.set(line.gstRate, [...(byRate.get(line.gstRate) ?? []), line]);
  const shared = new Map<InvoiceLine, InvoiceLine>();
  for (const [rate, group] of byRate) {
    const amounts = group.map((line) => Math.round(line.amount * 100));
    const pool = amounts.reduce((sum, value) => sum + value, 0);
    const tax = splitPaise(pool, rate, interState);
    const parts = ['cgst', 'sgst', 'igst'] as const;
    const given = { cgst: 0, sgst: 0, igst: 0 };
    let running = 0;
    group.forEach((line, index) => {
      running += amounts[index] ?? 0;
      const share = { cgst: 0, sgst: 0, igst: 0 };
      for (const part of parts) {
        const upTo = pool > 0 ? Math.round((tax[part] * running) / pool) : 0;
        share[part] = upTo - given[part];
        given[part] = upTo;
      }
      const gst = share.cgst + share.sgst + share.igst;
      shared.set(line, {
        ...line,
        cgst: rupees(share.cgst),
        sgst: rupees(share.sgst),
        igst: rupees(share.igst),
        gst: rupees(gst),
        taxable: rupees((amounts[index] ?? 0) - gst),
      });
    });
  }
  return lines.map((line) => shared.get(line) ?? line);
}

/** GST per rate, worked out on the pooled amount of each rate exactly as the server does. */
export function taxByRate(lines: readonly InvoiceLine[], interState: boolean): RateRow[] {
  const pooled = new Map<number, number>();
  for (const line of lines) pooled.set(line.gstRate, (pooled.get(line.gstRate) ?? 0) + Math.round(line.amount * 100));
  return [...pooled.entries()]
    .sort(([a], [b]) => a - b)
    .map(([gstRate, amountPaise]) => {
      const tax = splitPaise(amountPaise, gstRate, interState);
      return {
        gstRate,
        amount: rupees(amountPaise),
        taxable: rupees(tax.taxable),
        cgst: rupees(tax.cgst),
        sgst: rupees(tax.sgst),
        igst: rupees(tax.igst),
        gst: rupees(tax.cgst + tax.sgst + tax.igst),
      };
    });
}

// ---------------------------------------------------------------------------
// Amount in words, Indian system
// ---------------------------------------------------------------------------

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen',
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n: number): string {
  if (n < 20) return ONES[n] ?? '';
  const tens = TENS[Math.floor(n / 10)] ?? '';
  const ones = ONES[n % 10] ?? '';
  return ones ? `${tens}-${ones}` : tens;
}

function belowThousand(n: number): string {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ');
}

/** 119999 → 'One Lakh Nineteen Thousand Nine Hundred Ninety-Nine'. Crores repeat past 99 crore. */
export function numberInWords(value: number): string {
  let n = Math.floor(Math.abs(value));
  if (n === 0) return 'Zero';
  const parts: string[] = [];
  const crore = Math.floor(n / 10_000_000);
  n %= 10_000_000;
  if (crore) parts.push(`${numberInWords(crore)} Crore`);
  const lakh = Math.floor(n / 100_000);
  n %= 100_000;
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  return parts.join(' ');
}

/** 'Indian Rupees One Lakh Nineteen Thousand Nine Hundred Ninety-Nine Only', with paise when there are any. */
export function rupeesInWords(amount: number): string {
  const paise = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(paise / 100);
  const fraction = paise % 100;
  const tail = fraction ? ` and ${belowHundred(fraction)} Paise` : '';
  return `Indian Rupees ${numberInWords(whole)}${tail} Only`;
}
