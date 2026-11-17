// Command line entry for the seed: `npm run seed` (add `-- --reset` to rebuild the sample store).
import { createContext } from '../context.js';
import { runSeed } from './index.js';

const FLAGS = new Set(['--reset']);

const LABELS = {
  removed: 'Rows removed by the reset',
  admin: 'Admin accounts created',
  categories: 'Categories',
  subcategories: 'Subcategories',
  vehicles: 'Vehicles (generations)',
  products: 'Products',
  variants: 'Variants',
  fitments: 'Fitment rows',
  priceHistory: 'Price history rows',
  productsWithPhotos: 'Products with photos',
  relations: 'Relations',
  picks: 'Pick of Three entries',
  dropItems: 'Friday Five items',
  reports: 'Sample fitted reports',
  questions: 'Sample questions',
  coupons: 'Coupons',
  builds: 'House builds',
  promoImages: 'Promo banners given a photo',
};

function printCounts(result) {
  const width = Math.max(...Object.values(LABELS).map((label) => label.length));
  for (const [key, label] of Object.entries(LABELS)) {
    if (key === 'removed' && result.removed === 0) continue;
    console.log(`  ${label.padEnd(width)}  ${result[key]}`);
  }
}

async function main() {
  const args = process.argv.slice(2);
  const unknown = args.filter((arg) => !FLAGS.has(arg));
  if (unknown.length > 0) {
    console.error(`Unknown option: ${unknown.join(' ')}`);
    console.error('Usage: npm run seed            load the sample store into an empty database');
    console.error('       npm run seed -- --reset  delete the catalogue and sample data, then load it again');
    process.exitCode = 1;
    return;
  }

  let ctx;
  try {
    ctx = createContext();
  } catch (err) {
    console.error(err.message);
    process.exitCode = 1;
    return;
  }

  try {
    console.log(`[seed] Database: ${ctx.config.dbPath}`);
    const result = await runSeed(ctx, { reset: args.includes('--reset') });
    if (!result.skipped) {
      printCounts(result);
      console.log('[seed] Done.');
    }
  } catch (err) {
    console.error('[seed] The seed failed and nothing was written.');
    console.error(err);
    process.exitCode = 1;
  } finally {
    ctx.db.close();
  }
}

await main();
