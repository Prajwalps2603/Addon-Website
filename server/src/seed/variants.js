// Which sample products are sold in variants, and what the choices are.
// About a third of the catalogue has them. Each plan varies something the title leaves open
// (a finish the title does not name, a size within the titled diameter), using the option
// lists of the subcategory's spec template.
import { between, hash } from './shared.js';

// sku: [option name, spec key whose row lists the choices (null adds a row named after the option),
//       [[value, SKU suffix, rupees above the base price], ...]]
const VARIANT_PLANS = {
  'ADN-EXT-003': ['Finish', 'finish', [['Matte Black', 'MBK', 0], ['Carbon-Look', 'CBN', 200]]],
  'ADN-EXT-004': ['Finish', 'finish', [['Gloss Black', 'GBK', 0], ['Carbon-Look', 'CBN', 600], ['Paint-Matched (adds 7 days)', 'PNT', 1500]]],
  'ADN-EXT-012': ['Finish', 'finish', [['Gloss Black', 'GBK', 0], ['Carbon-Look', 'CBN', 800]]],
  'ADN-EXT-014': ['Finish', 'finish', [['Matte Black', 'MBK', 0], ['Gloss Black', 'GBK', 300]]],
  'ADN-EXT-018': ['Finish', 'finish', [['Matte Black', 'MBK', 0], ['Brushed Silver', 'SLV', 200], ['Red', 'RED', 200]]],
  // The Show Plate Designer reads the 'NNN x NNN mm' size from the variant name to shape its preview.
  'ADN-EXT-020': ['Plate size', 'plateSize', [['520 x 111 mm acrylic', 'STD', 0], ['340 x 200 mm acrylic', 'SQR', 100], ['520 x 111 mm brushed aluminium', 'ALU', 500]]],
  'ADN-EXT-019':['Plate size', 'plateSize', [['500 x 120 mm front and rear', 'STD', 0], ['500 x 120 mm front, 340 x 200 mm rear', 'SQR', 50]]],
  'ADN-INT-002': ['Stitch colour', 'stitchColour', [['Black', 'BLK', 0], ['Red', 'RED', 0], ['Blue', 'BLU', 0]]],
  'ADN-INT-004': ['Cover size', 'coverSize', [['S (35 to 36 cm)', 'S', 0], ['M (37 to 38 cm)', 'M', 0], ['L (39 to 40 cm)', 'L', 0]]],
  'ADN-INT-005': ['Colour', null, [['Black', 'BLK', 0], ['Silver', 'SLV', 0], ['Red', 'RED', 100]]],
  'ADN-INT-007': ['Colour', null, [['Black', 'BLK', 0], ['Black with Red Stitch', 'BRD', 200], ['Tan', 'TAN', 0], ['Beige', 'BGE', 0]]],
  'ADN-INT-009': ['Colour', null, [['Black', 'BLK', 0], ['Tan', 'TAN', 0], ['Coffee', 'COF', 0]]],
  'ADN-INT-011': ['Colour', null, [['Black', 'BLK', 0], ['Black with Red', 'BRD', 300], ['Tan', 'TAN', 0], ['Beige', 'BGE', 0]]],
  'ADN-INT-012': ['Colour', null, [['Black with Red', 'BRD', 0], ['Grey', 'GRY', 0], ['Tan', 'TAN', 0]]],
  'ADN-INT-019': ['Colour', null, [['Black', 'BLK', 0], ['Tan', 'TAN', 0], ['Red', 'RED', 0]]],
  'ADN-INT-020': ['Colour', null, [['Black', 'BLK', 0], ['Red', 'RED', 0], ['Carbon-Look', 'CBN', 50]]],
  'ADN-INT-022': ['Colour', null, [['Black', 'BLK', 0], ['Grey', 'GRY', 0]]],
  'ADN-LGT-001': ['Housing', null, [['Black', 'BLK', 0], ['Smoked', 'SMK', 1000], ['Chrome', 'CHR', 0]]],
  'ADN-LGT-005': ['Lens', 'lens', [['Smoked', 'SMK', 0], ['Red', 'RED', 0], ['Clear', 'CLR', 0]]],
  'ADN-LGT-009': ['Colour temperature', 'colourTemperature', [['6000 K White', '6K', 0], ['4300 K Warm White', '43K', 0]]],
  'ADN-LGT-011': ['Colour mode', 'colour', [['White', 'WHT', 0], ['Yellow', 'YLW', 0], ['White and Yellow', 'DUO', 500]]],
  'ADN-LGT-015': ['Beam', 'beam', [['Spot', 'SPT', 0], ['Flood', 'FLD', 0], ['Combo', 'CMB', 0]]],
  'ADN-PRF-002': ['Filter colour', null, [['Red', 'RED', 0], ['Blue', 'BLU', 0], ['Black', 'BLK', 0]]],
  'ADN-PRF-005': ['Finish', 'finish', [['Polished', 'POL', 0], ['Black Chrome', 'BCH', 1000], ['Burnt Blue', 'BBL', 1500]]],
  'ADN-PRF-007': ['Top mount', 'topMounts', [['Rubber', 'RUB', 0], ['Pillow-Ball', 'PBL', 8000]]],
  'ADN-PRF-013': ['Colour', null, [['Black', 'BLK', 0], ['Red', 'RED', 0], ['Blue', 'BLU', 0]]],
  'ADN-PRF-014': ['Colour', null, [['Black', 'BLK', 0], ['Black with Red', 'BRD', 500], ['Black with Blue', 'BBL', 500]]],
  'ADN-WHL-002': ['Size', null, [['16 x 6.5J, ET40', '65J', 0], ['16 x 7J, ET35', '70J', 2000]]],
  'ADN-WHL-003': ['Size', null, [['17 x 7J, ET40', '70J', 0], ['17 x 7.5J, ET40', '75J', 1500], ['17 x 8J, ET35', '80J', 4000]]],
  'ADN-WHL-009': ['Colour', null, [['Black', 'BLK', 0], ['Red', 'RED', 0], ['Blue', 'BLU', 0]]],
  'ADN-AUD-018': ['Mount', 'mountType', [['Vent Clip', 'VNT', 0], ['Dashboard Pad', 'DSH', 100], ['Windscreen Arm', 'ARM', 200]]],
  'ADN-TRL-001': ['Finish', null, [['Textured Black', 'BLK', 0], ['Silver', 'SLV', 0]]],
  'ADN-TRL-003': ['Finish', null, [['Silver', 'SLV', 0], ['Textured Black', 'BLK', 0]]],
  'ADN-TRL-006': ['Head', null, [['Air Ram', 'RAM', 0], ['Cyclone Pre-Cleaner', 'CYC', 2500]]],
  'ADN-TRL-010': ['Rating', 'minimumBreakingStrength', [['8000 kg', '8T', 0], ['12000 kg', '12T', 2000]]],
  'ADN-TRL-012': ['Colour', null, [['Olive Green', 'OLV', 0], ['Red', 'RED', 0], ['Black', 'BLK', 0]]],
  'ADN-TRL-015': ['Finish', null, [['Silver and Black', 'SLV', 0], ['Black', 'BLK', 0]]],
  'ADN-CAR-007': ['Colour', null, [['Silver', 'SLV', 0], ['Grey', 'GRY', 0]]],
  'ADN-MER-001': ['Size', null, [['S', 'S', 0], ['M', 'M', 0], ['L', 'L', 0], ['XL', 'XL', 0]]],
  'ADN-MER-002': ['Size', null, [['S', 'S', 0], ['M', 'M', 0], ['L', 'L', 0], ['XL', 'XL', 0]]],
  'ADN-MER-003': ['Size', null, [['S', 'S', 0], ['M', 'M', 0], ['L', 'L', 0], ['XL', 'XL', 0]]],
  'ADN-MER-005': ['Finish', null, [['Gunmetal', 'GUN', 0], ['Silver', 'SLV', 0], ['Black', 'BLK', 0], ['Gold', 'GLD', 50]]],
  'ADN-MER-007': ['Colour', null, [['Black', 'BLK', 0], ['Olive', 'OLV', 0], ['Grey', 'GRY', 0]]],
};

/** SKUs that are sold in variants. */
export const VARIANT_SKUS = Object.keys(VARIANT_PLANS);

export const hasVariantPlan = (sku) => Object.hasOwn(VARIANT_PLANS, sku);

// The MRP moves with the price, in whole hundreds, and never by less than the price does.
function mrpStep(product, step) {
  if (step === 0) return 0;
  return Math.max(step, Math.round((step * product.mrp) / product.sell / 100) * 100);
}

/**
 * The variants of one catalogue product, or null when it is sold as a single item:
 *   { name, specKey, values, variants: [{ name, sku, price, mrp, stock, attributes, sortOrder }] }
 * The first choice is the base: it carries the catalogue price, so the product's "from" price stays the listed one.
 */
export function buildVariants(product) {
  const plan = VARIANT_PLANS[product.sku];
  if (!plan) return null;
  const [name, specKey, options] = plan;
  const heavy = product.shipClass === 'bulky' || product.shipClass === 'freight';
  // One product in three with three or more choices has a choice sold out, never the base one.
  const soldOut = options.length >= 3 && hash(`${product.sku}:gap`) % 3 === 0 ? between(`${product.sku}:gap-at`, 1, options.length - 1) : -1;

  return {
    name,
    specKey,
    values: options.map(([value]) => value),
    variants: options.map(([value, suffix, step], index) => ({
      name: value,
      sku: `${product.sku}-${suffix}`,
      price: product.sell + step,
      mrp: product.mrp + mrpStep(product, step),
      stock: index === soldOut ? 0 : between(`${product.sku}-${suffix}:stock`, 4, heavy ? 8 : 14),
      attributes: { [name]: value },
      sortOrder: index + 1,
    })),
  };
}
