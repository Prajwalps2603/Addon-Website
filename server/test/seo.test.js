import { startTestApp } from './helpers.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import { metaForPath, renderHead, safeJsonLd } from '../src/lib/seoMeta.js';

const INDEX_HTML = `<!doctype html>
<html lang="en-IN">
  <head>
    <meta charset="UTF-8" />
    <title>Addon Auto Motive</title>
    <!--app-head-->
    <script type="module" crossorigin src="/assets/index-AbC123.js"></script>
  </head>
  <body><div id="root"></div></body>
</html>
`;

const HOSTILE = 'Evil </script><script>alert("x")</script> & <b>Co</b>';
const html = { accept: 'text/html,application/xhtml+xml' };

function jsonLdBlocks(page) {
  return [...page.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((m) => JSON.parse(m[1]));
}
const metaContent = (page, attr, key) => {
  const match = page.match(new RegExp(`<meta ${attr}="${key.replace(/[:]/g, '\\$&')}" content="([^"]*)"`));
  return match ? match[1] : null;
};

describe('seo with a built client', () => {
  let t;
  let dist;
  let hostile;

  before(async () => {
    dist = fs.mkdtempSync(path.join(os.tmpdir(), 'addon-seo-dist-'));
    fs.mkdirSync(path.join(dist, 'assets'));
    fs.writeFileSync(path.join(dist, 'index.html'), INDEX_HTML);
    fs.writeFileSync(path.join(dist, 'assets', 'index-AbC123.js'), 'console.log(1);');
    fs.writeFileSync(path.join(dist, 'favicon.svg'), '<svg xmlns="http://www.w3.org/2000/svg"></svg>');
    t = await startTestApp({ config: { clientDist: dist, publicUrl: 'https://shop.example.in' } });

    const { db } = t.ctx;
    const { spoiler, wheel } = t.fixtures.products;
    db.run('UPDATE products SET images = ? WHERE id = ?', [['/catalog/spoiler/spoiler-01.webp', '/catalog/spoiler/spoiler-02.webp'], spoiler.id]);
    // Reports: one real approved (counts), one demo approved and one pending (never count).
    db.run("INSERT INTO reviews (product_id, author_name, rating, status, is_demo) VALUES (?, 'Ravi', 4, 'approved', 0)", [spoiler.id]);
    db.run("INSERT INTO reviews (product_id, author_name, rating, status, is_demo) VALUES (?, 'Sample', 1, 'approved', 1)", [spoiler.id]);
    db.run("INSERT INTO reviews (product_id, author_name, rating, status, is_demo) VALUES (?, 'Wait', 2, 'pending', 0)", [spoiler.id]);
    db.run("INSERT INTO reviews (product_id, author_name, rating, status, is_demo) VALUES (?, 'Sample', 5, 'approved', 1)", [wheel.id]);

    const id = db.run(
      `INSERT INTO products (slug, sku, name, brand, category_id, short_description, price, mrp, images)
       VALUES ('hostile-part', 'T-EVIL-1', ?, ?, ?, ?, 999, 1499, ?)`,
      [HOSTILE, 'Bad "Brand"', t.fixtures.categories.spoilers.id, 'Short </script> & "quoted"', ['/catalog/x/evil.webp?a=1&b="2"']],
    ).lastInsertRowid;
    hostile = { id, slug: 'hostile-part' };
    db.run("INSERT INTO products (slug, sku, name, category_id, price, mrp, is_active) VALUES ('hidden-part', 'T-HID-1', 'Hidden', ?, 100, 100, 0)", [
      t.fixtures.categories.spoilers.id,
    ]);

    const state = { bodyType: 'hatchback', paint: '#ffffff', parts: {} };
    db.run(
      "INSERT INTO builds (slug, title, vehicle_label, state, product_ids, status, created_at) VALUES ('night-swift', 'Night Swift', 'Maruti Suzuki Swift (2018-2024)', ?, ?, 'approved', '2026-10-01T10:00:00Z')",
      [state, [spoiler.id, wheel.id]],
    );
    db.run("INSERT INTO builds (slug, title, state, product_ids, status) VALUES ('secret-build', 'Secret', ?, ?, 'private')", [state, [spoiler.id]]);
  });

  after(async () => {
    await t?.close();
    fs.rmSync(dist, { recursive: true, force: true });
  });

  test('product page carries title, price, photo and Product JSON-LD', async () => {
    const { spoiler } = t.fixtures.products;
    const res = await t.api(`/p/${spoiler.slug}`, { headers: html });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/html/);
    assert.equal(res.headers.get('cache-control'), 'no-cache');
    const page = res.body;
    assert.ok(!page.includes('<!--app-head-->'), 'marker replaced');
    assert.equal(page.match(/<title>/g).length, 1, 'default title replaced, not duplicated');
    assert.match(page, /<title>Addon Aero Roof Spoiler for Maruti Suzuki Swift \(2018-2024\) \| Addon Automotive<\/title>/);
    assert.ok(page.includes('/assets/index-AbC123.js'), 'rest of the shell kept');

    const description = metaContent(page, 'name', 'description');
    assert.match(description, /₹3,499/);
    assert.match(description, /MRP ₹4,999/);
    assert.match(description, /A part from the test catalogue/);
    assert.equal(metaContent(page, 'property', 'og:image'), 'https://shop.example.in/catalog/spoiler/spoiler-01.webp');
    assert.equal(metaContent(page, 'property', 'og:url'), `https://shop.example.in/p/${spoiler.slug}`);
    assert.equal(metaContent(page, 'property', 'og:type'), 'product');
    assert.equal(metaContent(page, 'property', 'og:site_name'), 'Addon Automotive');
    assert.ok(metaContent(page, 'property', 'og:title'));
    assert.ok(metaContent(page, 'property', 'og:description'));
    assert.equal(metaContent(page, 'name', 'twitter:card'), 'summary_large_image');
    assert.match(page, new RegExp(`<link rel="canonical" href="https://shop.example.in/p/${spoiler.slug}" />`));
    assert.equal(metaContent(page, 'name', 'robots'), null);

    const blocks = jsonLdBlocks(page);
    const product = blocks.find((block) => block['@type'] === 'Product');
    assert.ok(product);
    assert.equal(product.name, spoiler.name);
    assert.equal(product.sku, spoiler.sku);
    assert.deepEqual(product.brand, { '@type': 'Brand', name: 'Addon Aero' });
    assert.equal(product.offers.price, 3499);
    assert.equal(product.offers.priceCurrency, 'INR');
    assert.equal(product.offers.availability, 'https://schema.org/InStock');
    assert.deepEqual(product.image, [
      'https://shop.example.in/catalog/spoiler/spoiler-01.webp',
      'https://shop.example.in/catalog/spoiler/spoiler-02.webp',
    ]);
    // Only the real approved report counts.
    assert.deepEqual(product.aggregateRating, { '@type': 'AggregateRating', ratingValue: 4, reviewCount: 1, bestRating: 5, worstRating: 1 });
    const crumbs = blocks.find((block) => block['@type'] === 'BreadcrumbList');
    assert.deepEqual(
      crumbs.itemListElement.map((item) => item.name),
      ['Home', 'Exterior Styling', 'Spoilers & Wings', spoiler.name],
    );
  });

  test('no aggregateRating from demo reports, out of stock and variant price ranges', async () => {
    const wheel = jsonLdBlocks((await t.api(`/p/${t.fixtures.products.wheel.slug}`, { headers: html })).body).find((b) => b['@type'] === 'Product');
    assert.equal(wheel.aggregateRating, undefined);
    assert.equal(wheel.offers['@type'], 'AggregateOffer');
    assert.equal(wheel.offers.lowPrice, 21999);
    assert.equal(wheel.offers.highPrice, 23999);

    const oos = jsonLdBlocks((await t.api(`/p/${t.fixtures.products.outOfStock.slug}`, { headers: html })).body).find((b) => b['@type'] === 'Product');
    assert.equal(oos.offers.availability, 'https://schema.org/OutOfStock');
    assert.equal(oos.aggregateRating, undefined);
  });

  test('hostile product names are escaped in tags and cannot break out of JSON-LD', async () => {
    const res = await t.api(`/p/${hostile.slug}`, { headers: html });
    assert.equal(res.status, 200);
    const page = res.body;
    assert.ok(!page.includes('<script>alert'), 'no injected script tag');
    assert.ok(!page.includes('<b>Co</b>'));
    assert.ok(page.includes('Evil &lt;/script&gt;&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt; &amp; &lt;b&gt;Co&lt;/b&gt;'));
    // Every </script> in the page is a real closing tag of one of our script elements.
    const opens = page.match(/<script\b/g).length;
    const closes = page.match(/<\/script>/g).length;
    assert.equal(opens, closes);
    const product = jsonLdBlocks(page).find((b) => b['@type'] === 'Product');
    assert.equal(product.name, HOSTILE, 'the JSON still decodes to the real name');
    assert.equal(product.brand.name, 'Bad "Brand"');
    assert.equal(metaContent(page, 'property', 'og:image'), 'https://shop.example.in/catalog/x/evil.webp?a=1&amp;b=&quot;2&quot;');
  });

  test('renderHead and safeJsonLd escape on their own', () => {
    assert.equal(safeJsonLd({ a: '</script><!--' }), '{"a":"\\u003c/script\\u003e\\u003c!--"}');
    const head = renderHead({ title: '"><img src=x>', description: "it's", image: '', canonical: 'https://x/?a=1&b=2', jsonLd: [], siteName: 'S' });
    assert.ok(head.includes('<title>&quot;&gt;&lt;img src=x&gt;</title>'));
    assert.ok(head.includes('content="it&#39;s"'));
    assert.ok(head.includes('href="https://x/?a=1&amp;b=2"'));
    assert.ok(head.includes('<meta name="twitter:card" content="summary" />'));
  });

  test('unknown and inactive products answer 404 with the app shell and noindex', async () => {
    for (const address of ['/p/no-such-part', '/p/hidden-part', '/p/BAD%20SLUG']) {
      const res = await t.api(address, { headers: html });
      assert.equal(res.status, 404, address);
      assert.match(res.headers.get('content-type'), /text\/html/);
      assert.ok(res.body.includes('<div id="root"></div>'));
      assert.equal(metaContent(res.body, 'name', 'robots'), 'noindex, nofollow');
      assert.equal(res.headers.get('x-robots-tag'), 'noindex, nofollow');
    }
    assert.equal((await t.api('/no-such-page', { headers: html })).status, 404);
    assert.equal((await t.api('/shop/no-such-category', { headers: html })).status, 404);
    assert.equal((await t.api('/builds/no-such-build', { headers: html })).status, 404);
  });

  test('private pages are noindex', async () => {
    for (const address of ['/cart', '/checkout', '/account', '/account/orders', '/admin', '/admin/products/3', '/order/ADN-1', '/track', '/quote/abc', '/search?q=dikki', '/styleguide', '/book-fitting/ADN-B-000001', '/admin/bookings']) {
      const res = await t.api(address, { headers: html });
      assert.equal(res.status, 200, address);
      assert.equal(metaContent(res.body, 'name', 'robots'), 'noindex, nofollow', address);
      assert.ok(!res.body.includes('rel="canonical"'), address);
    }
    const search = await t.api('/search?q=%3Cscript%3E', { headers: html });
    assert.ok(search.body.includes('Search: &lt;script&gt;'));
    const shop = await t.api('/shop', { headers: html });
    assert.equal(metaContent(shop.body, 'name', 'robots'), null);
  });

  test('home, category, build, feature and content pages', async () => {
    const home = (await t.api('/', { headers: html })).body;
    assert.match(home, /<title>Addon Automotive: Upgrade your ride\. Elevate your style\.<\/title>/);
    const org = jsonLdBlocks(home).find((b) => b['@type'] === 'Organization');
    assert.ok(org);
    // Contact details come from the settings, never from the code.
    const settings = t.ctx.settings.get();
    assert.equal(org.telephone, settings.phone || undefined);
    if (settings.social.instagram) assert.ok(org.sameAs.includes(settings.social.instagram));
    assert.match(metaContent(home, 'name', 'description'), /fitting studio/);
    assert.equal(metaContent(home, 'property', 'og:url'), 'https://shop.example.in/');

    t.ctx.db.run("UPDATE categories SET image = '/catalog/alloy/tile.webp' WHERE slug = 'alloy-wheels'");
    const sub = (await t.api('/shop/wheels-tyres/alloy-wheels', { headers: html })).body;
    assert.match(sub, /<title>Alloy Wheels \| Addon Automotive<\/title>/);
    assert.equal(metaContent(sub, 'name', 'description'), 'Alloy Wheels for the test catalogue.');
    assert.equal(metaContent(sub, 'property', 'og:image'), 'https://shop.example.in/catalog/alloy/tile.webp');
    const crumbs = jsonLdBlocks(sub).find((b) => b['@type'] === 'BreadcrumbList');
    assert.deepEqual(crumbs.itemListElement.map((i) => i.item), [
      'https://shop.example.in/',
      'https://shop.example.in/shop',
      'https://shop.example.in/shop/wheels-tyres',
      'https://shop.example.in/shop/wheels-tyres/alloy-wheels',
    ]);
    // A category without a tile borrows a product photo.
    const parent = (await t.api('/shop/exterior-styling', { headers: html })).body;
    assert.equal(metaContent(parent, 'property', 'og:image'), 'https://shop.example.in/catalog/spoiler/spoiler-01.webp');
    assert.equal((await t.api('/shop/exterior-styling/alloy-wheels', { headers: html })).status, 404);

    const build = (await t.api('/builds/night-swift', { headers: html })).body;
    assert.match(build, /<title>Night Swift \| Addon Automotive<\/title>/);
    assert.match(metaContent(build, 'name', 'description'), /^2 parts on a Maruti Suzuki Swift \(2018-2024\), ₹25,498 in all/);
    assert.equal(metaContent(build, 'name', 'robots'), null);
    const secret = (await t.api('/builds/secret-build', { headers: html })).body;
    assert.equal(metaContent(secret, 'name', 'robots'), 'noindex, nofollow');

    const car = await t.api('/cars/maruti-suzuki/swift', { headers: html });
    assert.equal(car.status, 200);
    assert.match(car.body, /Parts for the Maruti Suzuki Swift/);
    assert.equal((await t.api('/cars/maruti-suzuki/nope', { headers: html })).status, 404);

    for (const [address, title] of [
      ['/friday-five', 'The Friday Five'],
      ['/build-bay', 'Build Bay'],
      ['/light-lab', 'Light Lab'],
      ['/show-plate', 'Show Plate Designer'],
      ['/new-car', 'New car planner'],
      ['/pocket-builds', 'Pocket Builds'],
      ['/book-fitting', 'Book a fitting'],
      ['/policies/returns', 'Returns policy'],
      ['/faq', 'Questions and answers'],
    ]) {
      const res = await t.api(address, { headers: html });
      assert.equal(res.status, 200, address);
      assert.ok(res.body.includes(`<title>${title} | Addon Automotive</title>`), address);
    }
  });

  test('metaForPath reports the documented keys', () => {
    const meta = metaForPath(t.ctx, `/p/${t.fixtures.products.spoiler.slug}/`, '');
    for (const key of ['title', 'description', 'image', 'canonical', 'type', 'jsonLd', 'noindex']) assert.ok(key in meta, key);
    assert.equal(meta.canonical, `https://shop.example.in/p/${t.fixtures.products.spoiler.slug}`);
    assert.equal(meta.noindex, false);
  });

  test('robots.txt', async () => {
    const res = await t.api('/robots.txt');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/plain/);
    assert.match(res.body, /^User-agent: \*$/m);
    assert.match(res.body, /^Allow: \/$/m);
    for (const prefix of ['/cart', '/checkout', '/account', '/admin', '/order', '/track', '/quote', '/search', '/styleguide', '/api/']) {
      assert.match(res.body, new RegExp(`^Disallow: ${prefix}$`, 'm'), prefix);
    }
    assert.match(res.body, /^Sitemap: https:\/\/shop\.example\.in\/sitemap\.xml$/m);
  });

  test('sitemap.xml is valid and lists the catalogue, then caches', async () => {
    const res = await t.api('/sitemap.xml');
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /application\/xml/);
    const body = res.body;
    assert.ok(body.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">'));
    assert.ok(body.trimEnd().endsWith('</urlset>'));
    // Well formed: every & starts an entity, url elements balance, every url has one loc.
    assert.ok(!/&(?!(amp|lt|gt|quot|apos);)/.test(body));
    const urls = body.match(/<url>[\s\S]*?<\/url>/g);
    assert.equal(urls.length, body.match(/<url>/g).length);
    assert.equal(urls.length, body.match(/<\/url>/g).length);
    for (const url of urls) assert.match(url, /^<url><loc>https:\/\/shop\.example\.in\/[^<]*<\/loc>(<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>)?(<priority>[\d.]+<\/priority>)?<\/url>$/);
    const locs = urls.map((url) => url.match(/<loc>([^<]*)<\/loc>/)[1]);
    assert.equal(new Set(locs).size, locs.length, 'no duplicates');

    const has = (p) => locs.includes(`https://shop.example.in${p}`);
    assert.ok(has('/'));
    for (const p of ['/friday-five', '/build-bay', '/light-lab', '/show-plate', '/new-car', '/pocket-builds', '/faq', '/policies/terms']) assert.ok(has(p), p);
    assert.ok(has('/shop/exterior-styling'));
    assert.ok(has('/shop/exterior-styling/spoilers-wings'));
    assert.ok(has('/shop/wheels-tyres/alloy-wheels'));
    for (const product of Object.values(t.fixtures.products)) assert.ok(has(`/p/${product.slug}`), product.slug);
    assert.ok(has('/p/hostile-part'));
    assert.ok(!has('/p/hidden-part'), 'inactive products are left out');
    assert.ok(has('/builds/night-swift'));
    assert.ok(!has('/builds/secret-build'), 'private builds are left out');
    assert.ok(!locs.some((loc) => /\/(cart|checkout|account|admin)/.test(loc)));
    assert.match(urls.find((url) => url.includes('/builds/night-swift')), /<lastmod>2026-10-01<\/lastmod>/);
    assert.match(urls.find((url) => url.includes(`/p/${t.fixtures.products.spoiler.slug}<`)), /<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);

    // Cached: a product added now does not show until the cache expires.
    t.ctx.db.run("INSERT INTO products (slug, sku, name, category_id, price, mrp) VALUES ('fresh-part', 'T-NEW-1', 'Fresh', ?, 100, 100)", [
      t.fixtures.categories.spoilers.id,
    ]);
    const again = await t.api('/sitemap.xml');
    assert.equal(again.body, body);
  });

  test('static files: hashed assets cached for a year, others briefly, missing files 404', async () => {
    const asset = await t.api('/assets/index-AbC123.js');
    assert.equal(asset.status, 200);
    assert.match(asset.headers.get('cache-control'), /max-age=31536000/);
    assert.match(asset.headers.get('cache-control'), /immutable/);

    const icon = await t.api('/favicon.svg');
    assert.equal(icon.status, 200);
    assert.match(icon.headers.get('cache-control'), /max-age=3600/);

    assert.equal((await t.api('/assets/missing-XyZ.js')).status, 404);
    const missingPhoto = await t.api('/catalog/missing.webp', { headers: html });
    assert.equal(missingPhoto.status, 404);
    assert.ok(!String(missingPhoto.body).includes('<div id="root">'));

    const named = await t.api('/index.html', { headers: html });
    assert.equal(named.status, 301);
    assert.equal(named.headers.get('location'), '/');
  });

  test('API and uploads never reach the HTML fallback', async () => {
    const api = await t.api('/api/no-such-endpoint', { headers: html });
    assert.equal(api.status, 404);
    assert.match(api.headers.get('content-type'), /application\/json/);
    const upload = await t.api('/uploads/nothing', { headers: html });
    assert.equal(upload.status, 404);
    assert.ok(!String(upload.body).includes('<div id="root">'));
    // A client that only takes JSON gets the JSON 404, not the shell.
    const json = await t.api('/p/whatever', { headers: { accept: 'application/json' } });
    assert.equal(json.status, 404);
    assert.match(json.headers.get('content-type'), /application\/json/);
  });

  test('index.html is reloaded when it changes', async () => {
    const file = path.join(dist, 'index.html');
    fs.writeFileSync(file, INDEX_HTML.replace('<div id="root"></div>', '<div id="root" data-build="2"></div>'));
    const later = new Date(Date.now() + 5000);
    fs.utimesSync(file, later, later);
    const res = await t.api('/faq', { headers: html });
    assert.ok(res.body.includes('data-build="2"'));
  });
});

describe('seo without a built client (development)', () => {
  let t;
  before(async () => {
    t = await startTestApp({ config: { clientDist: path.join(os.tmpdir(), 'addon-no-dist-here-' + process.pid) } });
  });
  after(() => t.close());

  test('pages answer with a short note about Vite', async () => {
    const res = await t.api('/p/anything', { headers: html });
    assert.equal(res.status, 200);
    assert.match(res.headers.get('content-type'), /text\/plain/);
    assert.match(res.body, /Vite/);
    assert.match(res.body, /5173/);
  });

  test('robots.txt and sitemap.xml still work', async () => {
    assert.equal((await t.api('/robots.txt')).status, 200);
    const sitemap = await t.api('/sitemap.xml');
    assert.equal(sitemap.status, 200);
    assert.ok(sitemap.body.includes('http://localhost:5173/p/'));
  });
});
