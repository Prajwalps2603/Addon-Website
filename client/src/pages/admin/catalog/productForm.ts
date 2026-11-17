import * as z from 'zod';
import type {
  AdminProduct,
  AdminProductInput,
  BodyType,
  BuildSlot,
  FitmentType,
  KitGoal,
  Legality,
  ShipClass,
  StraightLabel,
  WarrantyImpact,
  Wiring,
} from '@/types/api';
import { BUILD_SLOT_STYLES } from '@/features/buildbay/contract';

/**
 * The product form keeps every number as the text the owner typed, so a half-typed field never
 * turns into NaN or 0 behind their back. `toProductInput` turns it into the API body.
 * Field names mirror AdminProductInput, so the server's field errors land on the right inputs.
 */

export interface VariantForm {
  id?: number;
  name: string;
  sku: string;
  price: string;
  mrp: string;
  stock: string;
  attributes: { name: string; value: string }[];
}

export interface FitmentForm {
  vehicleId: number;
  /** For display only: the car as the list prints it. */
  vehicleLabel: string;
  fitType: 'direct' | 'with_work' | 'no';
  note: string;
  isVerified: boolean;
}

export interface LabelForm {
  legality: Legality;
  legalityNote: string;
  warrantyImpact: WarrantyImpact;
  warrantyNote: string;
  wiring: Wiring;
  reversible: boolean;
  skipIf: string;
  installDifficulty: number;
  installTimeMin: string;
  installTimeMax: string;
  proInstall: boolean;
  fittingCostMin: string;
  fittingCostMax: string;
}

export interface ProductForm {
  name: string;
  slug: string;
  sku: string;
  brand: string;
  categoryId: string;
  shortDescription: string;
  description: string;
  tags: string[];
  images: string[];
  price: string;
  mrp: string;
  costPrice: string;
  stock: string;
  lowStockThreshold: string;
  supplier: string;
  variants: VariantForm[];
  fitmentType: FitmentType;
  bodyTypes: BodyType[];
  pcd: string;
  fitments: FitmentForm[];
  label: LabelForm;
  fittingTools: string[];
  fittingSteps: { en: string; hi: string }[];
  specs: { label: string; value: string }[];
  highlights: string[];
  boxContents: string[];
  netQuantity: string;
  manufacturer: string;
  countryOfOrigin: string;
  hsnCode: string;
  gstRate: string;
  weightGrams: string;
  shipClass: ShipClass;
  warrantyMonths: string;
  returnable: boolean;
  codEligible: boolean;
  goals: KitGoal[];
  essentialRank: string;
  buildSlot: '' | BuildSlot;
  buildStyle: string;
  finishColor: string;
  artKind: string;
  customKind: string;
  isFeatured: boolean;
  isNew: boolean;
  isActive: boolean;
  requiresIds: number[];
  pairsWithIds: number[];
}

export const GST_RATES = [0, 3, 5, 12, 18, 28, 40] as const;
export const BODY_TYPES: readonly { value: BodyType; label: string }[] = [
  { value: 'hatchback', label: 'Hatchback' },
  { value: 'sedan', label: 'Sedan' },
  { value: 'suv', label: 'SUV' },
  { value: 'muv', label: 'MUV' },
  { value: 'pickup', label: 'Pickup' },
  { value: 'coupe', label: 'Coupe' },
];
export const KIT_GOALS: readonly { value: KitGoal; label: string }[] = [
  { value: 'new_car', label: 'New car' },
  { value: 'sporty', label: 'Sporty' },
  { value: 'comfort', label: 'Comfort' },
  { value: 'sound', label: 'Sound' },
  { value: 'night', label: 'Night driving' },
  { value: 'offroad', label: 'Off-road' },
  { value: 'protection', label: 'Protection' },
];

const SKU_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;
const SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const isDigits = (value: string) => /^\d+$/.test(value.trim());
const num = (value: string) => Number(value.trim());

const whole = (what: string) => z.string().trim().regex(/^\d+$/, { error: `Enter ${what} as a whole number.` });
const optionalWhole = (what: string) => z.string().trim().regex(/^\d*$/, { error: `Enter ${what} as a whole number, or leave it blank.` });

const variantSchema = z.object({
  id: z.number().optional(),
  name: z.string().trim().min(1, { error: 'Name this variant, e.g. 17 inch / Gloss black.' }).max(120),
  sku: z.string().trim().min(1, { error: 'Give the variant its own SKU.' }).max(60).regex(SKU_PATTERN, {
    error: 'Use letters, numbers, dots, dashes and slashes only.',
  }),
  price: whole('the price'),
  mrp: whole('the MRP'),
  stock: whole('the stock'),
  attributes: z.array(z.object({ name: z.string().trim().max(40), value: z.string().trim().max(80) })),
});

export const productSchema = z
  .object({
    name: z.string().trim().min(2, { error: 'Give the product a name of at least two letters.' }).max(200),
    slug: z
      .string()
      .trim()
      .max(80)
      .refine((value) => value === '' || SLUG_PATTERN.test(value), { error: 'Use lower-case letters, numbers and single dashes.' }),
    sku: z
      .string()
      .trim()
      .min(1, { error: 'Enter the SKU.' })
      .max(60)
      .regex(SKU_PATTERN, { error: 'Use letters, numbers, dots, dashes and slashes only.' }),
    brand: z.string().trim().max(80),
    categoryId: z.string().regex(/^\d+$/, { error: 'Choose a subcategory.' }),
    shortDescription: z.string().trim().max(300, { error: 'Keep it under 300 characters.' }),
    description: z.string().trim().max(10_000),
    tags: z.array(z.string().trim().min(1).max(40, { error: 'Keep a tag under 40 characters.' })).max(30),
    images: z.array(z.string()).max(12, { error: 'Twelve photos at most.' }),
    price: z.string(),
    mrp: z.string(),
    costPrice: optionalWhole('the cost price'),
    stock: z.string(),
    lowStockThreshold: whole('the low-stock level'),
    supplier: z.string().trim().max(120),
    variants: z.array(variantSchema).max(50),
    fitmentType: z.enum(['vehicle', 'body_type', 'pcd', 'universal', 'none']),
    bodyTypes: z.array(z.enum(['hatchback', 'sedan', 'suv', 'muv', 'pickup', 'coupe'])),
    pcd: z
      .string()
      .trim()
      .regex(/^(\d+\s*[x×]\s*\d+(\.\d+)?)?$/i, { error: 'Write the bolt pattern like 4x100 or 5x114.3.' }),
    fitments: z.array(
      z.object({
        vehicleId: z.number(),
        vehicleLabel: z.string(),
        fitType: z.enum(['direct', 'with_work', 'no']),
        note: z.string().trim().max(300),
        isVerified: z.boolean(),
      }),
    ),
    label: z.object({
      legality: z.enum(['road_legal', 'check_rules', 'off_road_only']),
      legalityNote: z.string().trim().max(400),
      warrantyImpact: z.enum(['none', 'possible', 'likely']),
      warrantyNote: z.string().trim().max(400),
      wiring: z.enum(['none', 'plug_and_play', 'splice']),
      reversible: z.boolean(),
      skipIf: z.string().trim().max(300),
      installDifficulty: z.number().int().min(1).max(5),
      installTimeMin: whole('the shortest time'),
      installTimeMax: whole('the longest time'),
      proInstall: z.boolean(),
      fittingCostMin: whole('the lowest charge'),
      fittingCostMax: whole('the highest charge'),
    }),
    fittingTools: z.array(z.string().trim().min(1).max(120)).max(30),
    fittingSteps: z
      .array(
        z.object({
          en: z.string().trim().min(1, { error: 'Write the step in English.' }).max(500),
          hi: z.string().trim().max(500),
        }),
      )
      .max(40),
    specs: z
      .array(
        z.object({
          label: z.string().trim().min(1, { error: 'Name this spec.' }).max(60),
          value: z.string().trim().max(200),
        }),
      )
      .max(40),
    highlights: z.array(z.string().trim().min(1).max(200)).max(12),
    boxContents: z.array(z.string().trim().min(1).max(120)).max(30),
    netQuantity: z.string().trim().min(1, { error: 'Say what is sold, e.g. 1 piece or Set of 4.' }).max(60),
    manufacturer: z.string().trim().max(300),
    countryOfOrigin: z.string().trim().min(1, { error: 'Enter the country of origin.' }).max(60),
    hsnCode: z
      .string()
      .trim()
      .regex(/^(\d{4}|\d{6}|\d{8})?$/, { error: 'An HSN code has 4, 6 or 8 digits.' }),
    gstRate: z.string(),
    weightGrams: whole('the weight in grams'),
    shipClass: z.enum(['small', 'medium', 'bulky', 'freight']),
    warrantyMonths: whole('the warranty in months'),
    returnable: z.boolean(),
    codEligible: z.boolean(),
    goals: z.array(z.enum(['new_car', 'sporty', 'comfort', 'sound', 'night', 'offroad', 'protection'])),
    essentialRank: whole('the rank'),
    buildSlot: z.string(),
    buildStyle: z.string(),
    finishColor: z
      .string()
      .trim()
      .regex(/^(#[0-9a-fA-F]{6})?$/, { error: 'Use a hex colour such as #1A1A1A, or leave it blank.' }),
    artKind: z.string().trim().max(40),
    customKind: z.string().trim().max(40),
    isFeatured: z.boolean(),
    isNew: z.boolean(),
    isActive: z.boolean(),
    requiresIds: z.array(z.number()).max(30, { error: 'Thirty at most.' }),
    pairsWithIds: z.array(z.number()).max(30, { error: 'Thirty at most.' }),
  })
  .superRefine((form, ctx) => {
    const issue = (path: (string | number)[], message: string) => ctx.addIssue({ code: 'custom', path, message });

    if (form.variants.length === 0) {
      if (!isDigits(form.price)) issue(['price'], 'Enter the price in whole rupees.');
      if (!isDigits(form.mrp)) issue(['mrp'], 'Enter the MRP in whole rupees.');
      if (!isDigits(form.stock)) issue(['stock'], 'Enter the stock as a whole number.');
      if (isDigits(form.price) && isDigits(form.mrp) && num(form.price) > num(form.mrp)) {
        issue(['mrp'], 'The MRP cannot be below the price. Raise the MRP or lower the price.');
      }
    }
    const skus = new Map<string, number>();
    form.variants.forEach((variant, index) => {
      if (isDigits(variant.price) && isDigits(variant.mrp) && num(variant.price) > num(variant.mrp)) {
        issue(['variants', index, 'mrp'], 'The MRP cannot be below the price.');
      }
      const key = variant.sku.trim().toLowerCase();
      if (key && skus.has(key)) issue(['variants', index, 'sku'], 'Two variants have this SKU.');
      if (key && key === form.sku.trim().toLowerCase()) issue(['variants', index, 'sku'], 'Give the variant its own SKU, not the product SKU.');
      skus.set(key, index);
    });

    if (form.fitmentType === 'body_type' && form.bodyTypes.length === 0) issue(['bodyTypes'], 'Choose the body types this part is made for.');
    if (form.fitmentType === 'pcd' && form.pcd.trim() === '') issue(['pcd'], 'Enter the bolt pattern this wheel needs.');

    const { label } = form;
    if (label.legality !== 'road_legal' && label.legalityNote.trim() === '') {
      issue(['label', 'legalityNote'], 'Say in one line what the road rules are for this part.');
    }
    if (label.warrantyImpact !== 'none' && label.warrantyNote.trim() === '') {
      issue(['label', 'warrantyNote'], 'Say in one line how this can affect the car warranty.');
    }
    if (isDigits(label.installTimeMin) && isDigits(label.installTimeMax) && num(label.installTimeMax) < num(label.installTimeMin)) {
      issue(['label', 'installTimeMax'], 'Must be at least the shortest fitting time.');
    }
    if (isDigits(label.fittingCostMin) && isDigits(label.fittingCostMax) && num(label.fittingCostMax) < num(label.fittingCostMin)) {
      issue(['label', 'fittingCostMax'], 'Must be at least the lowest fitting charge.');
    }

    if (form.buildSlot !== '' && form.buildStyle === '') issue(['buildStyle'], 'Choose the style for this Build Bay slot.');
    if (form.buildSlot === '' && form.buildStyle !== '') issue(['buildSlot'], 'Choose the Build Bay slot for this style.');
    if (form.customKind === 'show-plate' && form.codEligible) issue(['codEligible'], 'Show plates are prepaid only. Turn off cash on delivery.');

    const requires = new Set(form.requiresIds);
    form.pairsWithIds.forEach((id, index) => {
      if (requires.has(id)) issue(['pairsWithIds', index], 'A part cannot be both required and a pairing.');
    });
  });

export const DEFAULT_LABEL: LabelForm = {
  legality: 'road_legal',
  legalityNote: '',
  warrantyImpact: 'none',
  warrantyNote: '',
  wiring: 'none',
  reversible: true,
  skipIf: '',
  installDifficulty: 1,
  installTimeMin: '15',
  installTimeMax: '30',
  proInstall: false,
  fittingCostMin: '0',
  fittingCostMax: '0',
};

export function emptyProductForm(): ProductForm {
  return {
    name: '',
    slug: '',
    sku: '',
    brand: 'Addon',
    categoryId: '',
    shortDescription: '',
    description: '',
    tags: [],
    images: [],
    price: '',
    mrp: '',
    costPrice: '',
    stock: '0',
    lowStockThreshold: '5',
    supplier: '',
    variants: [],
    fitmentType: 'universal',
    bodyTypes: [],
    pcd: '',
    fitments: [],
    label: { ...DEFAULT_LABEL },
    fittingTools: [],
    fittingSteps: [],
    specs: [],
    highlights: [],
    boxContents: [],
    netQuantity: '1 piece',
    manufacturer: '',
    countryOfOrigin: 'India',
    hsnCode: '',
    gstRate: '18',
    weightGrams: '500',
    shipClass: 'small',
    warrantyMonths: '0',
    returnable: true,
    codEligible: true,
    goals: [],
    essentialRank: '0',
    buildSlot: '',
    buildStyle: '',
    finishColor: '',
    artKind: '',
    customKind: '',
    isFeatured: false,
    isNew: false,
    isActive: true,
    requiresIds: [],
    pairsWithIds: [],
  };
}

const text = (n: number | null | undefined) => (n === null || n === undefined ? '' : String(n));

/** The form as the saved product reads. `categoryArtKind` lets an inherited art kind show as "same as category". */
export function productToForm(product: AdminProduct, categoryArtKind?: string): ProductForm {
  const { label } = product;
  return {
    name: product.name,
    slug: product.slug,
    sku: product.sku,
    brand: product.brand,
    categoryId: String(product.categoryId),
    shortDescription: product.shortDescription,
    description: product.description,
    tags: [...product.tags],
    images: [...product.images],
    price: text(product.regularPrice),
    mrp: text(product.mrp),
    costPrice: text(product.costPrice),
    stock: text(product.stock),
    lowStockThreshold: text(product.lowStockThreshold),
    supplier: product.supplier,
    variants: product.variants.map((variant) => ({
      id: variant.id,
      name: variant.name,
      sku: variant.sku,
      price: text(variant.regularPrice),
      mrp: text(variant.mrp),
      stock: text(variant.stock),
      attributes: Object.entries(variant.attributes).map(([name, value]) => ({ name, value })),
    })),
    fitmentType: product.fitmentType,
    bodyTypes: [...product.bodyTypes],
    pcd: product.pcd,
    fitments: product.fitments.map((fitment) => ({
      vehicleId: fitment.vehicle.id,
      vehicleLabel: fitment.vehicle.label,
      fitType: fitment.fitType,
      note: fitment.note,
      isVerified: fitment.isVerified,
    })),
    label: {
      legality: label.legality,
      legalityNote: label.legalityNote,
      warrantyImpact: label.warrantyImpact,
      warrantyNote: label.warrantyNote,
      wiring: label.wiring,
      reversible: label.reversible,
      skipIf: label.skipIf,
      installDifficulty: label.installDifficulty,
      installTimeMin: text(label.installTimeMin),
      installTimeMax: text(label.installTimeMax),
      proInstall: label.proInstall,
      fittingCostMin: text(label.fittingCostMin),
      fittingCostMax: text(label.fittingCostMax),
    },
    fittingTools: [...product.fittingTools],
    fittingSteps: product.fittingSteps.map((step) => ({ en: step.en, hi: step.hi })),
    specs: product.specs.map((spec) => ({ label: spec.label, value: spec.value })),
    highlights: [...product.highlights],
    boxContents: [...product.boxContents],
    netQuantity: product.netQuantity,
    manufacturer: product.manufacturer,
    countryOfOrigin: product.countryOfOrigin,
    hsnCode: product.hsnCode,
    gstRate: text(product.gstRate),
    weightGrams: text(product.weightGrams),
    shipClass: product.shipClass,
    warrantyMonths: text(product.warrantyMonths),
    returnable: product.returnable,
    codEligible: product.codEligible,
    goals: [...product.goals],
    essentialRank: text(product.essentialRank),
    buildSlot: product.buildSlot ?? '',
    buildStyle: product.buildStyle ?? '',
    finishColor: product.finishColor,
    artKind: categoryArtKind !== undefined && product.artKind === categoryArtKind ? '' : product.artKind,
    customKind: product.customKind ?? '',
    isFeatured: product.isFeatured,
    isNew: product.isNew,
    isActive: product.isActive,
    requiresIds: [...product.requiresIds],
    pairsWithIds: [...product.pairsWithIds],
  };
}

const int = (value: string, fallback = 0) => (isDigits(value) ? num(value) : fallback);

/** Price, MRP and stock the product will carry: from the variants when there are any. */
export function summaryFromVariants(variants: readonly VariantForm[]): { price: number; mrp: number; stock: number } | null {
  if (variants.length === 0) return null;
  const priced = variants.filter((v) => isDigits(v.price));
  const cheapest = priced.reduce<VariantForm | null>((low, v) => (low === null || num(v.price) < num(low.price) ? v : low), null);
  return {
    price: cheapest ? num(cheapest.price) : 0,
    mrp: cheapest ? int(cheapest.mrp) : 0,
    stock: variants.reduce((sum, v) => sum + int(v.stock), 0),
  };
}

export function labelFromForm(label: LabelForm): StraightLabel {
  return {
    legality: label.legality,
    legalityNote: label.legalityNote.trim(),
    warrantyImpact: label.warrantyImpact,
    warrantyNote: label.warrantyNote.trim(),
    wiring: label.wiring,
    reversible: label.reversible,
    skipIf: label.skipIf.trim(),
    installDifficulty: Math.min(5, Math.max(1, Math.round(label.installDifficulty))) as StraightLabel['installDifficulty'],
    installTimeMin: int(label.installTimeMin),
    installTimeMax: int(label.installTimeMax),
    proInstall: label.proInstall,
    fittingCostMin: int(label.fittingCostMin),
    fittingCostMax: int(label.fittingCostMax),
  };
}

/** The API body for a validated form. */
export function toProductInput(form: ProductForm): AdminProductInput {
  const summary = summaryFromVariants(form.variants);
  const buildSlot = form.buildSlot === '' ? null : form.buildSlot;
  const allowedStyle = buildSlot && BUILD_SLOT_STYLES[buildSlot].some((s) => s.style === form.buildStyle);
  return {
    name: form.name.trim(),
    slug: form.slug.trim() || undefined,
    sku: form.sku.trim(),
    brand: form.brand.trim() || 'Addon',
    categoryId: Number(form.categoryId),
    shortDescription: form.shortDescription.trim(),
    description: form.description.trim(),
    price: summary ? summary.price : int(form.price),
    mrp: summary ? summary.mrp : int(form.mrp),
    costPrice: isDigits(form.costPrice) ? num(form.costPrice) : null,
    stock: summary ? summary.stock : int(form.stock),
    lowStockThreshold: int(form.lowStockThreshold, 5),
    supplier: form.supplier.trim(),
    hsnCode: form.hsnCode.trim(),
    gstRate: int(form.gstRate, 18),
    weightGrams: int(form.weightGrams),
    shipClass: form.shipClass,
    netQuantity: form.netQuantity.trim(),
    manufacturer: form.manufacturer.trim(),
    countryOfOrigin: form.countryOfOrigin.trim(),
    images: form.images,
    artKind: form.artKind.trim() || null,
    finishColor: form.finishColor.trim().toUpperCase(),
    highlights: form.highlights.map((s) => s.trim()).filter(Boolean),
    specs: form.specs.map((s) => ({ label: s.label.trim(), value: s.value.trim() })),
    boxContents: form.boxContents.map((s) => s.trim()).filter(Boolean),
    tags: form.tags.map((s) => s.trim()).filter(Boolean),
    fitmentType: form.fitmentType,
    bodyTypes: form.fitmentType === 'body_type' ? form.bodyTypes : [],
    pcd: form.fitmentType === 'pcd' ? form.pcd.trim().replace(/\s+/g, '').replace('×', 'x') : '',
    fitments: form.fitments.map((f) => ({ vehicleId: f.vehicleId, fitType: f.fitType, note: f.note.trim(), isVerified: f.isVerified })),
    label: labelFromForm(form.label),
    fittingTools: form.fittingTools.map((s) => s.trim()).filter(Boolean),
    fittingSteps: form.fittingSteps.map((s) => ({ en: s.en.trim(), hi: s.hi.trim() })),
    warrantyMonths: int(form.warrantyMonths),
    returnable: form.returnable,
    codEligible: form.codEligible,
    goals: form.goals,
    essentialRank: int(form.essentialRank),
    buildSlot: allowedStyle ? buildSlot : null,
    buildStyle: allowedStyle ? form.buildStyle : null,
    customKind: form.customKind.trim() || null,
    isFeatured: form.isFeatured,
    isNew: form.isNew,
    isActive: form.isActive,
    variants: form.variants.map((v) => ({
      ...(v.id ? { id: v.id } : {}),
      name: v.name.trim(),
      sku: v.sku.trim(),
      price: int(v.price),
      mrp: int(v.mrp),
      stock: int(v.stock),
      attributes: Object.fromEntries(
        v.attributes.filter((a) => a.name.trim() && a.value.trim()).map((a) => [a.name.trim(), a.value.trim()]),
      ),
    })),
    requiresIds: form.requiresIds,
    pairsWithIds: form.pairsWithIds,
  };
}

/** Which form section each top-level field lives in, for the error counts in the section list. */
export const SECTION_OF: Record<keyof ProductForm, string> = {
  name: 'basics',
  slug: 'basics',
  sku: 'basics',
  brand: 'basics',
  categoryId: 'basics',
  shortDescription: 'basics',
  description: 'basics',
  tags: 'basics',
  images: 'photos',
  price: 'price',
  mrp: 'price',
  costPrice: 'price',
  stock: 'price',
  lowStockThreshold: 'price',
  supplier: 'price',
  variants: 'price',
  fitmentType: 'fitment',
  bodyTypes: 'fitment',
  pcd: 'fitment',
  fitments: 'fitment',
  label: 'label',
  fittingTools: 'fitting',
  fittingSteps: 'fitting',
  specs: 'details',
  highlights: 'details',
  boxContents: 'details',
  netQuantity: 'details',
  manufacturer: 'details',
  countryOfOrigin: 'details',
  hsnCode: 'details',
  gstRate: 'details',
  weightGrams: 'details',
  shipClass: 'details',
  warrantyMonths: 'details',
  returnable: 'details',
  codEligible: 'details',
  goals: 'placement',
  essentialRank: 'placement',
  buildSlot: 'placement',
  buildStyle: 'placement',
  finishColor: 'placement',
  artKind: 'placement',
  customKind: 'placement',
  isFeatured: 'placement',
  isNew: 'placement',
  isActive: 'placement',
  requiresIds: 'goes',
  pairsWithIds: 'goes',
};
