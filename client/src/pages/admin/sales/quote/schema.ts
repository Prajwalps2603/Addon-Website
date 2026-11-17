import * as z from 'zod';
import { formatINR } from '@/lib/format';
import { isValidPhone, normalizePhone } from '@/lib/india';
import type { AdminProduct, AdminQuote, QuoteInput } from '@/types/api';
import { istDay, istDayEnd, todayIst } from '../dates';

const variantSchema = z.object({
  id: z.number(),
  name: z.string(),
  sku: z.string(),
  price: z.number(),
  regularPrice: z.number(),
  stock: z.number(),
});
export type LineVariant = z.infer<typeof variantSchema>;

const lineSchema = z.object({
  productId: z.number(),
  variantId: z.number().nullable(),
  name: z.string(),
  variantName: z.string(),
  sku: z.string(),
  image: z.string().nullable(),
  regularPrice: z.number(),
  costPrice: z.number().nullable(),
  /** Variants to choose from. Empty for lines loaded from a saved quote. */
  variants: z.array(variantSchema),
  qty: z.number({ error: 'Enter a quantity' }).int({ error: 'Whole units only' }).min(1, { error: 'At least 1' }).max(99, { error: 'At most 99' }),
  unitPrice: z.number({ error: 'Enter a price' }).int({ error: 'Whole rupees only' }).min(0, { error: 'Enter a price' }),
});
export type QuoteLine = z.infer<typeof lineSchema>;

export const quoteSchema = z
  .object({
    customerName: z.string().trim().min(2, { error: 'Enter the customer’s name' }).max(80),
    phone: z.string().trim().refine((value) => isValidPhone(value), { error: 'Enter a 10 digit mobile number' }),
    note: z.string().trim().max(500, { error: 'Keep it under 500 characters' }),
    validUntil: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, { error: 'Pick a date' }),
    overrideShipping: z.boolean(),
    shippingFee: z.number().or(z.nan()).optional(),
    allowBelowCost: z.boolean(),
    items: z.array(lineSchema).min(1, { error: 'Add at least one part' }),
  })
  .superRefine((value, ctx) => {
    if (value.validUntil && value.validUntil < todayIst()) {
      ctx.addIssue({ code: 'custom', path: ['validUntil'], message: 'Pick today or a later day' });
    }
    if (value.overrideShipping) {
      const fee = value.shippingFee;
      if (fee === undefined || Number.isNaN(fee) || fee < 0 || !Number.isInteger(fee)) {
        ctx.addIssue({ code: 'custom', path: ['shippingFee'], message: 'Enter the delivery fee in whole rupees, or 0 for free' });
      }
    }
    if (!value.allowBelowCost) {
      value.items.forEach((line, index) => {
        if (line.costPrice !== null && line.unitPrice < line.costPrice) {
          ctx.addIssue({
            code: 'custom',
            path: ['items', index, 'unitPrice'],
            message: `Below cost (${formatINR(line.costPrice)}). Raise it, or tick “Allow below cost”.`,
          });
        }
      });
    }
  });

export type QuoteForm = z.infer<typeof quoteSchema>;

export function emptyQuote(): QuoteForm {
  return {
    customerName: '',
    phone: '',
    note: '',
    validUntil: todayIst(Date.now() + 3 * 86_400_000),
    overrideShipping: false,
    shippingFee: undefined,
    allowBelowCost: false,
    items: [],
  };
}

export function quoteToForm(quote: AdminQuote): QuoteForm {
  const belowCost = quote.items.some((item) => item.costPrice !== null && item.unitPrice < item.costPrice);
  return {
    customerName: quote.customerName,
    phone: quote.phone,
    note: quote.note,
    validUntil: istDay(quote.validUntil) || todayIst(),
    overrideShipping: quote.shippingFee !== null,
    shippingFee: quote.shippingFee ?? undefined,
    allowBelowCost: belowCost,
    items: quote.items.map((item) => ({
      productId: item.productId,
      variantId: item.variantId,
      name: item.name,
      variantName: item.variantName,
      sku: item.sku,
      image: null,
      regularPrice: item.regularPrice,
      costPrice: item.costPrice,
      variants: [],
      qty: item.qty,
      unitPrice: item.unitPrice,
    })),
  };
}

export function formToInput(form: QuoteForm): QuoteInput {
  return {
    customerName: form.customerName.trim(),
    phone: normalizePhone(form.phone) ?? form.phone.trim(),
    note: form.note.trim(),
    items: form.items.map((line) => ({ productId: line.productId, variantId: line.variantId, qty: line.qty, unitPrice: line.unitPrice })),
    shippingFee: form.overrideShipping ? (form.shippingFee ?? 0) : null,
    validUntil: istDayEnd(form.validUntil),
  };
}

/** A new line for a product, on its first in-stock variant when it has variants. */
export function lineFromProduct(product: AdminProduct): QuoteLine {
  const variants: LineVariant[] = product.variants.map((variant) => ({
    id: variant.id,
    name: variant.name,
    sku: variant.sku,
    price: variant.price,
    regularPrice: variant.regularPrice,
    stock: variant.stock,
  }));
  const variant = variants.find((v) => v.stock > 0) ?? variants[0];
  return {
    productId: product.id,
    variantId: variant?.id ?? null,
    name: product.name,
    variantName: variant?.name ?? '',
    sku: variant?.sku ?? product.sku,
    image: product.image,
    regularPrice: variant?.regularPrice ?? product.regularPrice,
    costPrice: product.costPrice,
    variants,
    qty: 1,
    unitPrice: variant?.price ?? product.price,
  };
}

/** Margin of one line in rupees, or null when the cost is not known. */
export function lineMargin(line: Pick<QuoteLine, 'costPrice' | 'unitPrice' | 'qty'>): number | null {
  if (line.costPrice === null) return null;
  const price = Number.isFinite(line.unitPrice) ? line.unitPrice : 0;
  const qty = Number.isFinite(line.qty) ? line.qty : 0;
  return (price - line.costPrice) * qty;
}

export function marginPercent(margin: number, revenue: number): number {
  return revenue > 0 ? Math.round((margin / revenue) * 100) : 0;
}
