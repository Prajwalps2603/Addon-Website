import fs from 'node:fs';
import path from 'node:path';
import express, { Router } from 'express';
import { categoryTree } from '../lib/catalog.js';
import { NOINDEX_PREFIXES, STATIC_PAGES, escapeHtml, metaForPath, renderHead } from '../lib/seoMeta.js';

const SITEMAP_TTL_MS = 10 * 60 * 1000;
const DEV_MESSAGE =
  'The storefront is served by Vite in development: open http://localhost:5173. This server (the API) only serves the built client from client/dist after "npm run build".\n';

// Feature, content and policy pages listed in the sitemap besides the home page and the catalogue.
const SITEMAP_PAGES = Object.keys(STATIC_PAGES);

const xml = (value) => escapeHtml(value).replace(/&#39;/g, '&apos;');
const day = (iso) => (typeof iso === 'string' && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : '');

/**
 * Mounted at / after every /api route.
 * - GET /robots.txt and GET /sitemap.xml, generated from the catalogue.
 * - The built client (client/dist): hashed /assets/* cached for a year, other files for an hour.
 * - Every other GET that accepts HTML gets index.html with the page's title, description, Open Graph
 *   tags and JSON-LD injected, so shared links preview with the right photo and price.
 *   Unknown products (and other unknown pages) are sent with status 404; the app shows its own page.
 * - Without client/dist (development) those pages answer with a short note pointing at Vite.
 */
export default function seoRoutes(ctx) {
  const router = Router();
  const dist = ctx.config.clientDist;
  const indexFile = path.join(dist, 'index.html');

  // ---- robots.txt ---------------------------------------------------------
  router.get('/robots.txt', (req, res) => {
    const lines = ['User-agent: *', 'Allow: /', ...['/api/', ...NOINDEX_PREFIXES].map((prefix) => `Disallow: ${prefix}`), '', `Sitemap: ${ctx.config.publicUrl}/sitemap.xml`, ''];
    res.set('Cache-Control', 'public, max-age=3600');
    res.type('text/plain').send(lines.join('\n'));
  });

  // ---- sitemap.xml --------------------------------------------------------
  let sitemap = { body: '', builtAt: -Infinity };

  function buildSitemap() {
    const base = ctx.config.publicUrl;
    const entries = [];
    const add = (pagePath, lastmod = '', priority = '') => entries.push({ loc: `${base}${pagePath}`, lastmod, priority });

    const latestProduct = ctx.db.get("SELECT MAX(updated_at) AS at FROM products WHERE is_active = 1")?.at ?? '';
    add('/', day(latestProduct), '1.0');
    for (const page of SITEMAP_PAGES) add(page, '', '0.6');

    // Freshest product change per category, for the category pages' lastmod (one query).
    const perCategory = new Map(
      ctx.db
        .all('SELECT category_id, MAX(updated_at) AS at FROM products WHERE is_active = 1 GROUP BY category_id')
        .map((row) => [row.category_id, row.at]),
    );
    for (const parent of categoryTree(ctx)) {
      const childDates = parent.children.map((child) => perCategory.get(child.id) ?? '');
      const parentDate = [perCategory.get(parent.id) ?? '', ...childDates].sort().at(-1);
      add(`/shop/${encodeURIComponent(parent.slug)}`, day(parentDate), '0.7');
      for (const child of parent.children) {
        add(`/shop/${encodeURIComponent(parent.slug)}/${encodeURIComponent(child.slug)}`, day(perCategory.get(child.id)), '0.7');
      }
    }

    // Products in active categories only: a product under a hidden category has no live page path to it.
    const products = ctx.db.all(
      `SELECT p.slug, p.updated_at FROM products p
       JOIN categories c ON c.id = p.category_id
       LEFT JOIN categories pc ON pc.id = c.parent_id
       WHERE p.is_active = 1 AND c.is_active = 1 AND (pc.id IS NULL OR pc.is_active = 1)
       ORDER BY p.id`,
    );
    for (const product of products) add(`/p/${encodeURIComponent(product.slug)}`, day(product.updated_at), '0.8');

    const builds = ctx.db.all("SELECT slug, created_at FROM builds WHERE status = 'approved' ORDER BY is_house DESC, id");
    for (const build of builds) add(`/builds/${encodeURIComponent(build.slug)}`, day(build.created_at), '0.5');

    const body = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...entries.map(
        (entry) =>
          `  <url><loc>${xml(entry.loc)}</loc>${entry.lastmod ? `<lastmod>${entry.lastmod}</lastmod>` : ''}${entry.priority ? `<priority>${entry.priority}</priority>` : ''}</url>`,
      ),
      '</urlset>',
      '',
    ].join('\n');
    return body;
  }

  router.get('/sitemap.xml', (req, res) => {
    const now = Date.now();
    if (now - sitemap.builtAt > SITEMAP_TTL_MS) sitemap = { body: buildSitemap(), builtAt: now };
    res.set('Cache-Control', 'public, max-age=600');
    res.type('application/xml').send(sitemap.body);
  });

  // ---- the app shell ------------------------------------------------------
  // index.html is read once and read again only when its modification time changes (a new build).
  let shell = { mtimeMs: -1, html: '' };

  function loadShell() {
    let stat;
    try {
      stat = fs.statSync(indexFile);
    } catch {
      return null;
    }
    if (stat.mtimeMs !== shell.mtimeMs) shell = { mtimeMs: stat.mtimeMs, html: fs.readFileSync(indexFile, 'utf8') };
    return shell.html;
  }

  function injectHead(html, head) {
    let out = html.replace(/<title>[\s\S]*?<\/title>\s*/i, '');
    if (out.includes('<!--app-head-->')) return out.replace('<!--app-head-->', () => head);
    if (/<\/head>/i.test(out)) return out.replace(/<\/head>/i, () => `${head}\n  </head>`);
    return head + out;
  }

  function sendPage(req, res) {
    const html = loadShell();
    if (html === null) {
      res.set('Cache-Control', 'no-store');
      return res.type('text/plain').send(DEV_MESSAGE);
    }
    const search = req.originalUrl.includes('?') ? req.originalUrl.slice(req.originalUrl.indexOf('?')) : '';
    const meta = metaForPath(ctx, req.path, search);
    res.status(meta.status ?? 200);
    res.set('Cache-Control', 'no-cache');
    if (meta.noindex) res.set('X-Robots-Tag', 'noindex, nofollow');
    return res.type('html').send(injectHead(html, renderHead(meta)));
  }

  const isServerPath = (p) => p === '/api' || p.startsWith('/api/') || p === '/uploads' || p.startsWith('/uploads/');

  // index.html asked for by name is the home page, never the raw file with its marker.
  router.get('/index.html', (req, res, next) => (req.accepts('html') ? res.redirect(301, '/') : next()));

  router.use(
    '/assets',
    express.static(path.join(dist, 'assets'), { index: false, maxAge: '1y', immutable: true, fallthrough: false }),
  );
  router.use(
    express.static(dist, {
      index: false,
      maxAge: '1h',
      setHeaders(res, filePath) {
        if (filePath.endsWith('.html')) res.setHeader('Cache-Control', 'no-cache');
        // Catalogue and editorial photos are many and heavy, and change rarely: a week, then a cheap ETag check.
        else if (/[\\/](catalog|editorial)[\\/].+\.webp$/i.test(filePath)) {
          res.setHeader('Cache-Control', 'public, max-age=604800, stale-while-revalidate=86400');
        }
      },
    }),
  );

  router.get('/{*page}', (req, res, next) => {
    // A missing file (/catalog/x.webp) must be a 404, not the app shell; API and uploads never get here.
    if (isServerPath(req.path) || path.extname(req.path) !== '' || !req.accepts('html')) return next();
    return sendPage(req, res);
  });

  return router;
}
