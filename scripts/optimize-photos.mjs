// Converts the sourced photos under client/public/catalog and client/public/editorial
// into web-ready WebP files, then writes the two files the app reads:
//
//   server/src/seed/photos.json        subject -> photos (used by the seed to give products images)
//   client/src/data/photoCredits.json  every photo's author and licence (shown on the /credits page)
//
// For each source image NAME.jpg|jpeg|png it writes
//   NAME.webp       large rendition (catalog 1200px wide, editorial 1920px wide)
//   NAME-480.webp   card thumbnail  (catalog 480px wide,  editorial 960px wide -> NAME-960.webp)
// and removes the original. Safe to run again: already converted photos are left alone.
//
// Usage:  node scripts/optimize-photos.mjs
// sharp is loaded from server/node_modules (override with SHARP_FROM=<path to a package.json>).

import { createRequire } from 'node:module';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const requireFrom = createRequire(
  process.env.SHARP_FROM ? pathToFileURL(path.resolve(process.env.SHARP_FROM)) : pathToFileURL(path.join(root, 'server', 'package.json')),
);
const sharp = requireFrom('sharp');

const SETS = [
  { dir: path.join(root, 'client', 'public', 'catalog'), urlBase: '/catalog', large: 1200, small: 480, nested: true },
  { dir: path.join(root, 'client', 'public', 'editorial'), urlBase: '/editorial', large: 1920, small: 960, nested: false },
];

const SOURCE_EXT = new Set(['.jpg', '.jpeg', '.png']);

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function readCredits(folder) {
  const file = path.join(folder, 'credits.json');
  if (!(await exists(file))) return [];
  try {
    const parsed = JSON.parse(await fs.readFile(file, 'utf8'));
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn(`  ! could not parse ${file}: ${err.message}`);
    return [];
  }
}

/** Convert one folder of photos. Returns the photo records for that folder. */
async function processFolder(folder, urlBase, large, small) {
  const names = (await fs.readdir(folder)).sort();
  const credits = await readCredits(folder);
  const creditByStem = new Map(credits.map((c) => [path.parse(String(c.file ?? '')).name, c]));
  const records = [];
  const stats = { converted: 0, kept: 0, failed: 0 };

  for (const name of names) {
    const ext = path.extname(name).toLowerCase();
    const stem = path.parse(name).name;
    const src = path.join(folder, name);
    const largeOut = path.join(folder, `${stem}.webp`);
    const smallOut = path.join(folder, `${stem}-${small}.webp`);

    if (SOURCE_EXT.has(ext)) {
      try {
        const input = sharp(src, { failOn: 'error' }).rotate();
        const meta = await input.metadata();
        if (!meta.width || !meta.height || meta.width < 400) throw new Error(`too small or unreadable (${meta.width}x${meta.height})`);
        await input.clone().resize({ width: large, withoutEnlargement: true }).webp({ quality: 78 }).toFile(largeOut);
        await input.clone().resize({ width: small, withoutEnlargement: true }).webp({ quality: 72 }).toFile(smallOut);
        await fs.unlink(src);
        stats.converted += 1;
      } catch (err) {
        console.warn(`  ! skipped ${path.relative(root, src)}: ${err.message}`);
        await fs.rm(largeOut, { force: true });
        await fs.rm(smallOut, { force: true });
        stats.failed += 1;
        continue;
      }
    } else if (!(ext === '.webp' && !/-\d+$/.test(stem))) {
      continue; // thumbnails, credits.json, anything else
    } else {
      stats.kept += 1;
    }

    if (!(await exists(largeOut))) continue;
    const outMeta = await sharp(largeOut).metadata();
    const credit = creditByStem.get(stem) ?? {};
    records.push({
      url: `${urlBase}/${stem}.webp`,
      thumb: `${urlBase}/${stem}-${small}.webp`,
      width: outMeta.width,
      height: outMeta.height,
      shows: credit.shows ?? '',
      tone: credit.tone ?? 'mixed',
      orientation: credit.orientation ?? (outMeta.width >= outMeta.height * 1.1 ? 'landscape' : outMeta.height >= outMeta.width * 1.1 ? 'portrait' : 'square'),
      focalPoint: credit.focalPoint ?? 'centre',
      calmArea: credit.calmArea ?? 'none',
      title: credit.title ?? '',
      creator: credit.creator ?? 'Unknown',
      license: credit.license ?? '',
      licenseUrl: credit.licenseUrl ?? '',
      sourceUrl: credit.sourceUrl ?? '',
      provider: credit.provider ?? '',
      credited: Boolean(credit.license && credit.sourceUrl),
    });
  }
  return { records, stats };
}

const photos = { catalog: {}, editorial: [] };
const creditList = [];
const totals = { converted: 0, kept: 0, failed: 0, uncredited: 0 };

for (const set of SETS) {
  if (!(await exists(set.dir))) continue;
  const folders = set.nested
    ? (await fs.readdir(set.dir, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name).sort()
    : [''];
  for (const sub of folders) {
    const folder = path.join(set.dir, sub);
    const urlBase = sub ? `${set.urlBase}/${sub}` : set.urlBase;
    const { records, stats } = await processFolder(folder, urlBase, set.large, set.small);
    totals.converted += stats.converted;
    totals.kept += stats.kept;
    totals.failed += stats.failed;

    // A photo without a licence and source cannot be published: drop it.
    const usable = [];
    for (const r of records) {
      if (r.credited) {
        usable.push(r);
      } else {
        totals.uncredited += 1;
        console.warn(`  ! no credit for ${r.url}: removed`);
        await fs.rm(path.join(root, 'client', 'public', r.url), { force: true });
        await fs.rm(path.join(root, 'client', 'public', r.thumb), { force: true });
      }
    }

    const slim = usable.map(({ url, thumb, width, height, shows, tone, orientation, focalPoint, calmArea }) =>
      set.nested ? { url, thumb, width, height, shows, tone, orientation } : { url, thumb, width, height, shows, tone, focalPoint, calmArea },
    );
    if (set.nested) {
      if (slim.length) photos.catalog[sub] = slim;
    } else {
      photos.editorial.push(...slim);
    }
    for (const r of usable) {
      creditList.push({
        url: r.url,
        thumb: r.thumb,
        subject: sub || 'editorial',
        title: r.title,
        creator: r.creator,
        license: r.license,
        licenseUrl: r.licenseUrl,
        sourceUrl: r.sourceUrl,
        provider: r.provider,
      });
    }
    if (records.length) console.log(`${(sub || 'editorial').padEnd(18)} ${String(usable.length).padStart(2)} photos`);
  }
}

const seedOut = path.join(root, 'server', 'src', 'seed', 'photos.json');
const creditsOut = path.join(root, 'client', 'src', 'data', 'photoCredits.json');
await fs.mkdir(path.dirname(seedOut), { recursive: true });
await fs.mkdir(path.dirname(creditsOut), { recursive: true });
await fs.writeFile(seedOut, `${JSON.stringify(photos, null, 2)}\n`);
await fs.writeFile(creditsOut, `${JSON.stringify(creditList, null, 2)}\n`);

console.log(
  `\nDone: ${creditList.length} photos ready (${totals.converted} converted now, ${totals.kept} already converted, ${totals.failed} unreadable, ${totals.uncredited} dropped for missing credit).`,
);
console.log(`Subjects: ${Object.keys(photos.catalog).length}, editorial: ${photos.editorial.length}`);
console.log(`Wrote ${path.relative(root, seedOut)} and ${path.relative(root, creditsOut)}`);
