// Lines the owner sells that the researched catalogue (catalog.json) left out: sun control films
// ("cool films" on the shop's poster) and wheel covers ("wheel cups"). They are kept here rather
// than written into catalog.json, so that file stays the research output it was generated as.
// applyAdditions() adds them in the same shape, and every reader of the catalogue goes through it.

const FILM_NOTE =
  'Rule 100 of the Central Motor Vehicles Rules asks for at least 70 percent visual light transmission through the windscreen and rear window and 50 percent through the side windows. ' +
  'The Supreme Court (Avishek Goenka v. Union of India, 2012) barred dark films on car glass, and a 2020 amendment to the rules brought in safety glazing that meets the same limits. ' +
  'Enforcement differs by State and many traffic police still fine any film, so sell only films that keep the glass above the limits, never dark or mirror films, and say plainly that the buyer may still be stopped.';

const SUBCATEGORIES = [
  {
    category: 'exterior-styling',
    after: null, // at the end
    sub: {
      slug: 'sun-control-films',
      name: 'Sun Control Films',
      blurb: 'Clear heat-rejection films for the glass, kept inside the light limits the rules set for windscreens and side windows.',
      artKind: 'sun-film',
    },
  },
  {
    category: 'wheels-tyres',
    after: 'wheel-styling',
    sub: {
      slug: 'wheel-covers',
      name: 'Wheel Covers',
      blurb: 'Clip-on covers that dress 13 to 15 inch steel wheels for a fraction of the price of alloys.',
      artKind: 'wheel-cover',
    },
  },
];

const PRICE_BANDS = {
  'sun-control-films': { unit: 'car set', sellMin: 3999, sellMax: 9999, mrpMin: 5499, mrpMax: 12999, shipClass: 'small' },
  'wheel-covers': { unit: 'set', sellMin: 699, sellMax: 2499, mrpMin: 1199, mrpMax: 3499, shipClass: 'medium' },
};

const SPEC_TEMPLATES = {
  'sun-control-films': {
    attributes: [
      { key: 'filmType', label: 'Film type', example: 'Clear heat-rejection film, dyed, metal-free' },
      { key: 'windscreenLight', label: 'Light through windscreen and rear window', example: '70 percent or more, measured with the film on the glass' },
      { key: 'sideLight', label: 'Light through side windows', example: '50 percent or more, measured with the film on the glass' },
      { key: 'uvBlock', label: 'UV blocked', example: 'Up to 99 percent' },
      { key: 'thickness', label: 'Thickness', example: '1.5 mil (about 38 microns)' },
      { key: 'coverage', label: 'Coverage', example: 'Windscreen, rear window and the side windows of one car' },
      { key: 'signal', label: 'Phone and FASTag signal', example: 'Not affected: no metal layer' },
      { key: 'application', label: 'Application', example: 'At our studio, included in the price' },
      { key: 'warranty', label: 'Warranty', example: '3 years against peeling, bubbling and fading' },
    ],
    variants: [],
  },
  'wheel-covers': {
    attributes: [
      { key: 'diameter', label: 'Wheel size', example: '14 inch' },
      { key: 'fits', label: 'Fits', example: 'Steel wheels only, not alloy wheels' },
      { key: 'material', label: 'Material', example: 'UV-stabilised ABS plastic' },
      { key: 'finish', label: 'Finish', example: 'Silver' },
      { key: 'fixing', label: 'Fixing', example: 'Steel retaining ring and clips' },
      { key: 'valveCutOut', label: 'Valve cut-out', example: 'Yes' },
      { key: 'quantity', label: 'Quantity', example: 'Set of 4' },
      { key: 'warranty', label: 'Warranty', example: '6 months' },
    ],
    variants: [],
  },
};

const INSTALL_INFO = {
  'sun-control-films': {
    difficulty: 4,
    timeMinutes: [120, 180],
    timeLabel: '2 hr to 3 hr',
    professionalAdvised: true,
    note: 'Applied wet, panel by panel, by a film fitter in a clean, dust-free bay. Keep the windows shut for 3 days while the film cures.',
  },
  'wheel-covers': {
    difficulty: 1,
    timeMinutes: [10, 20],
    timeLabel: '10 min to 20 min',
    professionalAdvised: false,
    note: 'Wheel covers press onto steel wheels by hand, lined up with the valve. No tools are needed to fit them.',
  },
};

const COMPLIANCE = {
  'sunshades-organisers':
    'Position removable shades as parking and rear-passenger comfort items and let buyers check local rules for use while driving. Films are sold separately, under Sun Control Films, with their own light-limit note.',
  'sun-control-films': FILM_NOTE,
  'wheel-covers': 'Covers must clip on securely and must not stick out past the tyre sidewall. Sell them for steel wheels only.',
};

const film = (sku, title, bodyTypes, fitmentLabel, sell, mrp) => ({
  sku,
  title,
  category: 'exterior-styling',
  subcategory: 'sun-control-films',
  houseLine: 'Addon Aero',
  artKind: 'sun-film',
  fitment: { type: 'bodyType', bodyTypes },
  fitmentLabel,
  sell,
  mrp,
  discountPct: Math.round(((mrp - sell) / mrp) * 100),
  unit: 'car set',
  shipClass: 'small',
  installDifficulty: 4,
  professionalAdvised: true,
  hsn: '3920',
  gstRatePct: 18,
});

const cover = (sku, title, sell, mrp) => ({
  sku,
  title,
  category: 'wheels-tyres',
  subcategory: 'wheel-covers',
  houseLine: 'Addon Spoke',
  artKind: 'wheel-cover',
  fitment: { type: 'universal' },
  fitmentLabel: 'Universal fit',
  sell,
  mrp,
  discountPct: Math.round(((mrp - sell) / mrp) * 100),
  unit: 'set',
  shipClass: 'medium',
  installDifficulty: 1,
  professionalAdvised: false,
  hsn: '87087000',
  gstRatePct: 18,
});

const PRODUCTS = [
  film('ADN-EXT-023', 'Addon Aero Clear Sun Control Film, Full Car Set for Hatchbacks', ['hatchback'], 'Hatchbacks', 4499, 5999),
  film('ADN-EXT-024', 'Addon Aero Clear Sun Control Film, Full Car Set for Sedans', ['sedan'], 'Sedans', 5499, 7499),
  film('ADN-EXT-025', 'Addon Aero Ceramic Sun Control Film, Full Car Set for SUVs and MUVs', ['suv', 'muv'], 'SUVs and MUVs', 8999, 11999),
  cover('ADN-WHL-013', 'Addon Spoke 13 inch Wheel Covers, Silver (Set of 4)', 799, 1299),
  cover('ADN-WHL-014', 'Addon Spoke 14 inch Wheel Covers, Black and Silver (Set of 4)', 999, 1599),
  cover('ADN-WHL-015', 'Addon Spoke 15 inch Sport Wheel Covers, Black and Red (Set of 4)', 1499, 2299),
];

/** The subcategory slugs this module adds. */
export const ADDED_SUBCATEGORIES = SUBCATEGORIES.map((entry) => entry.sub.slug);

/** The catalogue with the owner's extra lines in it. Safe to call twice: it adds nothing that is already there. */
export function applyAdditions(catalog) {
  const known = new Set(catalog.categories.flatMap((category) => category.subcategories.map((sub) => sub.slug)));
  for (const { category: slug, after, sub } of SUBCATEGORIES) {
    if (known.has(sub.slug)) continue;
    const category = catalog.categories.find((entry) => entry.slug === slug);
    if (!category) throw new Error(`catalogue additions: no category ${slug}`);
    const index = after ? category.subcategories.findIndex((entry) => entry.slug === after) : -1;
    if (after && index === -1) throw new Error(`catalogue additions: no subcategory ${after} in ${slug}`);
    category.subcategories.splice(after ? index + 1 : category.subcategories.length, 0, { ...sub });
  }

  Object.assign(catalog.artKinds.extended, { 'sun-film': 'sunshade', 'wheel-cover': 'alloy-wheel' });
  Object.assign(catalog.priceBands, PRICE_BANDS);
  Object.assign(catalog.specTemplates, SPEC_TEMPLATES);
  Object.assign(catalog.installInfo, INSTALL_INFO);
  Object.assign(catalog.compliance, COMPLIANCE);
  catalog.hsnGst['exterior-styling'].bySubcategory['sun-control-films'] = { hsn: '3920', gstRatePct: 18, confidence: 'medium' };
  catalog.hsnGst['wheels-tyres'].bySubcategory['wheel-covers'] = { hsn: '87087000', gstRatePct: 18, confidence: 'medium' };

  const skus = new Set(catalog.seedProducts.map((product) => product.sku));
  for (const product of PRODUCTS) {
    if (skus.has(product.sku)) continue;
    catalog.seedProducts.push(structuredClone(product));
    catalog.seedPlan[product.subcategory] = (catalog.seedPlan[product.subcategory] ?? 0) + 1;
  }

  catalog.meta.counts.subcategories = catalog.categories.reduce((sum, category) => sum + category.subcategories.length, 0);
  catalog.meta.counts.seedProducts = catalog.seedProducts.length;
  return catalog;
}
