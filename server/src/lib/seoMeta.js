/**
 * Link previews and search-engine basics for the HTML the server sends.
 *
 * The storefront is a client-rendered app, so a crawler (WhatsApp, Instagram, Google) only sees what
 * the server writes into index.html. metaForPath() works out the title, description, photo, canonical
 * address and JSON-LD for a page address; renderHead() turns that into escaped <head> tags.
 */
import * as z from 'zod';
import { getCategory, getProductRow, getProductsByIds } from './catalog.js';
import { idList, toBuild, toProductDetail, vehicleLabel } from './mappers.js';
import { applyDrop, formatINR } from './money.js';

const DEFAULT_IMAGE = '/brand/icon-512.png';
const DESCRIPTION_MAX = 200;

/** Pages that must stay out of search results (also listed in robots.txt). */
export const NOINDEX_PREFIXES = [
  '/cart',
  '/checkout',
  '/account',
  '/admin',
  '/order',
  '/track',
  '/quote',
  '/search',
  '/styleguide',
];
// Private to the visitor, not worth listing either, but not named in robots.txt.
const PRIVATE_PATHS = new Set(['/garage', '/wishlist', '/compare', '/login', '/register', '/forgot-password', '/reset-password']);

/** Feature and content pages with fixed text. */
export const STATIC_PAGES = {
  '/friday-five': {
    title: 'The Friday Five',
    description: 'A short dated drop on up to five parts, each with the reason it is cheaper and its real price history. No permanent sale banners.',
  },
  '/build-bay': {
    title: 'Build Bay',
    description: 'Dress a side view of your car part by part: wheels, spoiler, lights, decals. Every part maps to a real product with a running total.',
  },
  '/light-lab': {
    title: 'Light Lab',
    description: 'Switch halogen, LED and projector beams on a night road, add rain and fog, and see why whiter is not always better.',
  },
  '/show-plate': {
    title: 'Show Plate Designer',
    description: 'Design a decorative show plate with a live preview and price. For display only, not for road use.',
  },
  '/new-car': {
    title: 'New car planner',
    description: 'Pick your new car, delivery date and budget. Get three kits of parts that fit, and compare them with the dealer quote.',
  },
  '/pocket-builds': {
    title: 'Pocket Builds',
    description: 'Type a budget, pick a vibe, and get a complete kit of parts under that number.',
  },
  '/book-fitting': {
    title: 'Book a fitting',
    description: 'Book a slot at our fitting studio and have our own team fit your parts, or come in for a free upgrade consultation.',
  },
  '/shop': { title: 'Shop all parts', description: 'Car accessories and modification parts, each with an honest fit verdict for your car.' },
  '/builds': { title: 'Builds', description: 'Cars dressed in Build Bay. Every build is shoppable, part by part.' },
  '/cars': { title: 'Parts by car', description: 'Pick your make and model to see the parts that fit it.' },
  '/glossary': { title: 'Glossary', description: 'PCD, offset, CANbus, lumens, IP67 and the rest, each in two plain lines.' },
  '/straight-label': {
    title: 'The Straight Label',
    description: 'Road legality, warranty impact, wiring, fitting difficulty, real fitting time and a fair labour cost on every product.',
  },
  '/about': { title: 'About us', description: 'Who we are: a car accessories shop and fitting studio, and how we make sure a part fits.' },
  '/contact': { title: 'Contact us', description: 'Ask us whether a part fits your car, or about an order.' },
  '/faq': { title: 'Questions and answers', description: 'Fitment, delivery, cash on delivery, returns and warranty, answered plainly.' },
  '/credits': { title: 'Photo credits', description: 'The open-licence photographs used in this store and who took them.' },
  '/policies/shipping': { title: 'Shipping policy', description: 'How and when we deliver, and what delivery costs.' },
  '/policies/returns': { title: 'Returns policy', description: 'What you can return, within how many days, and how refunds work.' },
  '/policies/warranty': { title: 'Warranty policy', description: 'What the warranty on our parts covers and how to claim it.' },
  '/policies/privacy': { title: 'Privacy policy', description: 'What we collect, why, and how long we keep it.' },
  '/policies/terms': { title: 'Terms of use', description: 'The terms for using this store and buying from it.' },
};

const slugSchema = z.string().min(1).max(160).regex(/^[a-z0-9][a-z0-9-]*$/);

const cleanText = (value) => String(value ?? '').replace(/\s+/g, ' ').trim();

function clip(value, max = DESCRIPTION_MAX) {
  const textValue = cleanText(value);
  if (textValue.length <= max) return textValue;
  const cut = textValue.slice(0, max - 1);
  const space = cut.lastIndexOf(' ');
  return `${(space > max * 0.6 ? cut.slice(0, space) : cut).replace(/[\s,.;:]+$/, '')}…`;
}

/** Site-relative URLs become absolute on PUBLIC_URL; absolute http(s) URLs pass through; anything else is dropped. */
export function absoluteUrl(ctx, url) {
  const value = cleanText(url);
  if (!value) return '';
  if (/^https?:\/\//i.test(value)) return value;
  if (value.startsWith('//')) return `https:${value}`;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value)) return '';
  return `${ctx.config.publicUrl}${value.startsWith('/') ? '' : '/'}${value}`;
}

function slugOf(segment) {
  let decoded;
  try {
    decoded = decodeURIComponent(segment ?? '');
  } catch {
    return null;
  }
  const result = slugSchema.safeParse(decoded);
  return result.success ? result.data : null;
}

function normalizePath(pathname) {
  let value = String(pathname || '/').split('?')[0].split('#')[0];
  if (!value.startsWith('/')) value = `/${value}`;
  value = value.replace(/\/{2,}/g, '/');
  if (value.length > 1) value = value.replace(/\/+$/, '');
  return value || '/';
}

function storeInfo(ctx) {
  const settings = ctx.settings.get();
  return {
    name: cleanText(settings.storeName) || 'Addon Automotive',
    tagline: cleanText(settings.tagline),
    promos: Array.isArray(settings.promos) ? settings.promos : [],
    phone: cleanText(settings.phone),
    links: Object.values(settings.social ?? {})
      .map(cleanText)
      .filter((url) => /^https:\/\//i.test(url)),
  };
}

function breadcrumbList(ctx, items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: absoluteUrl(ctx, item.path),
    })),
  };
}

function base(ctx, store, path) {
  return {
    title: store.name,
    description: store.tagline || `${store.name}: car accessories and a fitting studio.`,
    image: absoluteUrl(ctx, DEFAULT_IMAGE),
    canonical: absoluteUrl(ctx, path === '/' ? '/' : path),
    type: 'website',
    jsonLd: [],
    noindex: false,
    status: 200,
    siteName: store.name,
  };
}

const titled = (store, title) => `${title} | ${store.name}`;

function notFoundMeta(meta, store) {
  return { ...meta, title: titled(store, 'Page not found'), description: 'There is nothing at this address.', noindex: true, status: 404, jsonLd: [] };
}

// ---------------------------------------------------------------------------
// Products
// ---------------------------------------------------------------------------

function productMeta(ctx, store, meta, slug) {
  const row = slug ? getProductRow(ctx, slug) : null;
  if (!row || !row.is_active) return notFoundMeta(meta, store);
  const product = toProductDetail(row);
  const path = `/p/${product.slug}`;

  // Variants: the offer spans the cheapest to the dearest active variant, at today's price.
  const variantRange = product.hasVariants
    ? ctx.db.get(
        'SELECT MIN(price) AS low, MAX(price) AS high, SUM(MAX(stock, 0)) AS stock, COUNT(*) AS n FROM product_variants WHERE product_id = ? AND is_active = 1',
        [product.id],
      )
    : null;
  // Only real approved reports count: seeded (demo) reports never become search-engine ratings.
  const rating = ctx.db.get(
    "SELECT COUNT(*) AS n, AVG(rating) AS avg FROM reviews WHERE product_id = ? AND status = 'approved' AND is_demo = 0",
    [product.id],
  );

  const pricePart =
    product.mrp > product.price
      ? `${formatINR(product.price)} (MRP ${formatINR(product.mrp)}, inclusive of all taxes).`
      : `${formatINR(product.price)}, inclusive of all taxes.`;
  const fromPart = variantRange && variantRange.n > 1 && variantRange.high > variantRange.low ? `From ${pricePart}` : pricePart;
  const description = clip(`${fromPart} ${product.shortDescription || product.categoryName}`);

  const images = product.images.map((url) => absoluteUrl(ctx, url)).filter(Boolean);
  const image = images[0] || meta.image;
  const canonical = absoluteUrl(ctx, path);
  const availability = product.inStock ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';

  let offers;
  if (variantRange && variantRange.n > 0) {
    const low = applyDrop(variantRange.low, product.drop?.percentOff ?? 0);
    const high = applyDrop(variantRange.high, product.drop?.percentOff ?? 0);
    offers =
      variantRange.n > 1 && high > low
        ? { '@type': 'AggregateOffer', priceCurrency: 'INR', lowPrice: low, highPrice: high, offerCount: variantRange.n, availability, url: canonical }
        : { '@type': 'Offer', priceCurrency: 'INR', price: low, availability, url: canonical, itemCondition: 'https://schema.org/NewCondition' };
  } else {
    offers = { '@type': 'Offer', priceCurrency: 'INR', price: product.price, availability, url: canonical, itemCondition: 'https://schema.org/NewCondition' };
  }
  if (product.drop?.endsAt) offers.priceValidUntil = product.drop.endsAt.slice(0, 10);

  const productLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.name,
    description: clip(product.shortDescription || product.description, 500) || undefined,
    sku: product.sku,
    brand: { '@type': 'Brand', name: product.brand || store.name },
    category: [product.parentCategoryName, product.categoryName].filter(Boolean).join(' > ') || undefined,
    image: images.length > 0 ? images : undefined,
    url: canonical,
    offers,
  };
  if (rating && rating.n > 0) {
    productLd.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue: Math.round(Number(rating.avg) * 10) / 10,
      reviewCount: rating.n,
      bestRating: 5,
      worstRating: 1,
    };
  }

  const crumbs = [{ name: 'Home', path: '/' }];
  if (product.parentCategorySlug) crumbs.push({ name: product.parentCategoryName, path: `/shop/${product.parentCategorySlug}` });
  if (product.categorySlug) {
    crumbs.push({
      name: product.categoryName,
      path: product.parentCategorySlug ? `/shop/${product.parentCategorySlug}/${product.categorySlug}` : `/shop/${product.categorySlug}`,
    });
  }
  crumbs.push({ name: product.name, path });

  return {
    ...meta,
    title: titled(store, product.name),
    description,
    image,
    canonical,
    type: 'product',
    jsonLd: [productLd, breadcrumbList(ctx, crumbs)],
    product: { price: product.price, currency: 'INR', availability: product.inStock ? 'instock' : 'oos' },
  };
}

function fittingCardMeta(ctx, store, meta, slug) {
  const row = slug ? getProductRow(ctx, slug) : null;
  if (!row || !row.is_active) return notFoundMeta(meta, store);
  const product = toProductDetail(row);
  return {
    ...meta,
    title: titled(store, `Fitting card: ${product.name}`),
    description: 'Tools, steps, time and a fair labour charge for your mechanic, in English and Hindi.',
    image: absoluteUrl(ctx, product.images[0]) || meta.image,
    canonical: absoluteUrl(ctx, `/fitting/${product.slug}`),
  };
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

function categoryMeta(ctx, store, meta, parentSlug, subSlug) {
  let parent = parentSlug ? getCategory(ctx, parentSlug) : null;
  if (!parent) return notFoundMeta(meta, store);
  let category = parent;
  if (parent.parentId !== null) {
    // /shop/<subcategory> on its own: the same page as /shop/<parent>/<subcategory>, which is canonical.
    if (subSlug !== undefined) return notFoundMeta(meta, store);
    const owner = getCategory(ctx, parent.parentId);
    if (!owner) return notFoundMeta(meta, store);
    category = owner.children.find((child) => child.id === parent.id) ?? parent;
    parent = owner;
  } else if (subSlug !== undefined) {
    category = parent.children.find((child) => child.slug === subSlug) ?? null;
    if (!category) return notFoundMeta(meta, store);
  }
  const path = category === parent ? `/shop/${parent.slug}` : `/shop/${parent.slug}/${category.slug}`;

  let image = category.image || (category !== parent ? parent.image : '');
  if (!image) {
    // No tile photo yet: borrow the main photo of the category's best product.
    const ids = [category.id, ...category.children.map((child) => child.id)];
    const row = ctx.db.get(
      `SELECT p.images FROM products p
       WHERE p.is_active = 1 AND p.images <> '[]' AND p.category_id IN (SELECT value FROM json_each(?))
       ORDER BY (p.stock > 0) DESC, p.is_featured DESC, p.sold_count DESC, p.id DESC LIMIT 1`,
      [ids],
    );
    const list = row ? safeArray(row.images) : [];
    image = typeof list[0] === 'string' ? list[0] : '';
  }

  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Shop', path: '/shop' },
    { name: parent.name, path: `/shop/${parent.slug}` },
  ];
  if (category !== parent) crumbs.push({ name: category.name, path });

  const count = category.productCount;
  return {
    ...meta,
    title: titled(store, category.name),
    description: clip(category.blurb || `${count} ${count === 1 ? 'part' : 'parts'} in ${category.name}, each with a fit verdict for your car.`),
    image: absoluteUrl(ctx, image) || meta.image,
    canonical: absoluteUrl(ctx, path),
    jsonLd: [breadcrumbList(ctx, crumbs)],
  };
}

function safeArray(value) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Builds and cars
// ---------------------------------------------------------------------------

function buildMeta(ctx, store, meta, slug) {
  const row = slug ? ctx.db.get('SELECT * FROM builds WHERE slug = ?', [slug]) : null;
  if (!row || row.status === 'rejected') return notFoundMeta(meta, store);
  const build = toBuild(row, getProductsByIds(ctx, idList(row.product_ids)));
  const count = build.products.length;
  const parts = `${count} ${count === 1 ? 'part' : 'parts'}`;
  const car = build.vehicleLabel ? ` on a ${build.vehicleLabel}` : '';
  const description =
    count > 0
      ? `${parts}${car}, ${formatINR(build.total)} in all. A Build Bay style preview: every part is a real product you can buy.`
      : `A Build Bay build${car}.`;
  const image = build.products.map((product) => product.image).find(Boolean);
  return {
    ...meta,
    title: titled(store, build.title || 'Build'),
    description: clip(description),
    image: absoluteUrl(ctx, image) || meta.image,
    canonical: absoluteUrl(ctx, `/builds/${build.slug}`),
    type: 'article',
    // Private and pending builds open by link only; they are not for search results.
    noindex: build.status !== 'approved',
  };
}

function carsMeta(ctx, store, meta, makeSlug, modelSlug) {
  const rows = ctx.db.all(
    `SELECT * FROM vehicles WHERE make_slug = ? ${modelSlug ? 'AND model_slug = ?' : ''} ORDER BY year_from DESC`,
    modelSlug ? [makeSlug, modelSlug] : [makeSlug],
  );
  if (rows.length === 0) return notFoundMeta(meta, store);
  const name = modelSlug ? `${rows[0].make} ${rows[0].model}` : rows[0].make;
  const path = modelSlug ? `/cars/${makeSlug}/${modelSlug}` : `/cars/${makeSlug}`;
  const crumbs = [
    { name: 'Home', path: '/' },
    { name: 'Cars', path: '/cars' },
    { name: rows[0].make, path: `/cars/${makeSlug}` },
  ];
  if (modelSlug) crumbs.push({ name, path });
  const generations = modelSlug ? ` Covers ${rows.map((row) => vehicleLabel(row)).join(', ')}.` : '';
  return {
    ...meta,
    title: titled(store, `Parts for the ${name}`),
    description: clip(`Accessories and modification parts that fit the ${name}, with an honest fit verdict on each.${generations}`),
    canonical: absoluteUrl(ctx, path),
    jsonLd: [breadcrumbList(ctx, crumbs)],
  };
}

// ---------------------------------------------------------------------------
// The router of addresses
// ---------------------------------------------------------------------------

function isNoindexPath(path) {
  return NOINDEX_PREFIXES.some((prefix) => path === prefix || path.startsWith(`${prefix}/`)) || PRIVATE_PATHS.has(path);
}

/**
 * Meta for one page address: { title, description, image, canonical, type, jsonLd[], noindex, status, siteName }.
 * `status` is 404 for unknown products, categories, builds, cars and addresses the app has no page for:
 * the server still sends the app shell, which shows its own not-found page.
 */
export function metaForPath(ctx, pathname, search = '') {
  const store = storeInfo(ctx);
  const path = normalizePath(pathname);
  const meta = base(ctx, store, path);
  const segments = path.split('/').filter(Boolean);
  const [first, second, third] = segments;

  if (path === '/') {
    const promoImage = store.promos.map((promo) => cleanText(promo?.image)).find(Boolean);
    return {
      ...meta,
      title: store.tagline ? `${store.name}: ${store.tagline}` : store.name,
      description: clip(
        `${store.tagline ? `${store.tagline} ` : ''}Car accessories and a fitting studio: buy the part and have our team fit it, or get it delivered.`,
      ),
      image: absoluteUrl(ctx, promoImage) || meta.image,
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Organization',
          name: store.name,
          url: absoluteUrl(ctx, '/'),
          logo: absoluteUrl(ctx, DEFAULT_IMAGE),
          // Only what the owner has filled in: blank settings leave the key out.
          telephone: store.phone || undefined,
          sameAs: store.links.length > 0 ? store.links : undefined,
        },
        { '@context': 'https://schema.org', '@type': 'WebSite', name: store.name, url: absoluteUrl(ctx, '/') },
      ],
    };
  }

  if (isNoindexPath(path)) {
    let title = first.charAt(0).toUpperCase() + first.slice(1).replaceAll('-', ' ');
    if (first === 'search') {
      const q = cleanText(new URLSearchParams(String(search || '').replace(/^\?/, '')).get('q')).slice(0, 80);
      title = q ? `Search: ${q}` : 'Search';
    }
    return { ...meta, title: titled(store, title), noindex: true };
  }

  // One customer's studio booking: a real page, but private to them.
  if (first === 'book-fitting' && segments.length === 2) return { ...meta, title: titled(store, 'Your booking'), noindex: true };

  if (first === 'p' && segments.length === 2) return productMeta(ctx, store, meta, slugOf(second));
  if (first === 'fitting' && segments.length === 2) return fittingCardMeta(ctx, store, meta, slugOf(second));
  if (first === 'shop' && (segments.length === 2 || segments.length === 3)) {
    const parent = slugOf(second);
    const sub = segments.length === 3 ? slugOf(third) : undefined;
    if (!parent || sub === null) return notFoundMeta(meta, store);
    return categoryMeta(ctx, store, meta, parent, sub);
  }
  if (first === 'builds' && segments.length === 2) return buildMeta(ctx, store, meta, slugOf(second));
  if (first === 'cars' && (segments.length === 2 || segments.length === 3)) {
    const make = slugOf(second);
    const model = segments.length === 3 ? slugOf(third) : undefined;
    if (!make || model === null) return notFoundMeta(meta, store);
    return carsMeta(ctx, store, meta, make, model);
  }

  const page = STATIC_PAGES[path];
  if (page) return { ...meta, title: titled(store, page.title), description: page.description };

  return notFoundMeta(meta, store);
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

// U+2028 and U+2029 are valid in JSON but end a line in older script parsers.
const LINE_SEPARATORS = new RegExp(`[${String.fromCharCode(0x2028, 0x2029)}]`, 'g');

/** JSON for a <script type="application/ld+json"> block: nothing in it can close the tag or open a comment. */
export function safeJsonLd(value) {
  return JSON.stringify(value)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/&/g, '\\u0026')
    .replace(LINE_SEPARATORS, (char) => `\\u${char.charCodeAt(0).toString(16)}`);
}

/** The <head> tags for a page: title, description, canonical, robots, Open Graph, Twitter card and JSON-LD. */
export function renderHead(meta) {
  const tag = (attr, key, content) => (content ? `<meta ${attr}="${key}" content="${escapeHtml(content)}" />` : '');
  const lines = [
    `<title>${escapeHtml(meta.title)}</title>`,
    tag('name', 'description', meta.description),
    meta.canonical && !meta.noindex ? `<link rel="canonical" href="${escapeHtml(meta.canonical)}" />` : '',
    meta.noindex ? tag('name', 'robots', 'noindex, nofollow') : '',
    tag('property', 'og:site_name', meta.siteName || 'Addon Automotive'),
    tag('property', 'og:type', meta.type || 'website'),
    tag('property', 'og:title', meta.title),
    tag('property', 'og:description', meta.description),
    tag('property', 'og:url', meta.canonical),
    tag('property', 'og:image', meta.image),
    tag('property', 'og:locale', 'en_IN'),
    meta.product ? tag('property', 'product:price:amount', String(meta.product.price)) : '',
    meta.product ? tag('property', 'product:price:currency', meta.product.currency) : '',
    meta.product ? tag('property', 'product:availability', meta.product.availability) : '',
    tag('name', 'twitter:card', meta.image ? 'summary_large_image' : 'summary'),
    tag('name', 'twitter:title', meta.title),
    tag('name', 'twitter:description', meta.description),
    tag('name', 'twitter:image', meta.image),
    ...(meta.jsonLd ?? []).map((block) => `<script type="application/ld+json">${safeJsonLd(block)}</script>`),
  ];
  return lines.filter(Boolean).join('\n    ');
}
