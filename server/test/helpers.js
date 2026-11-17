// Shared test harness. Import this before anything from ../src so NODE_ENV is 'test'
// by the time the server modules load (cheap password hashing, no rate limits, quiet logs).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

process.env.NODE_ENV = 'test';

export const ADMIN_PASSWORD = 'Admin@12345';
export const CUSTOMER_PASSWORD = 'Customer@12345';

function insertFixtures(ctx, passwordHashes) {
  const { db } = ctx;
  const insert = (sql, params) => db.run(sql, params).lastInsertRowid;

  return db.tx(() => {
    const category = (slug, name, parentId, artKind, sortOrder) =>
      insert('INSERT INTO categories (slug, name, parent_id, blurb, art_kind, sort_order) VALUES (?, ?, ?, ?, ?, ?)', [
        slug,
        name,
        parentId,
        `${name} for the test catalogue.`,
        artKind,
        sortOrder,
      ]);
    const exteriorId = category('exterior-styling', 'Exterior Styling', null, 'body-kit', 1);
    const spoilersId = category('spoilers-wings', 'Spoilers & Wings', exteriorId, 'spoiler', 1);
    const wheelsId = category('wheels-tyres', 'Wheels & Tyres', null, 'alloy-wheel', 2);
    const alloysId = category('alloy-wheels', 'Alloy Wheels', wheelsId, 'alloy-wheel', 1);

    const vehicle = (make, makeSlug, model, modelSlug, generation, bodyType, yearFrom, yearTo, pcd, sortOrder) =>
      insert(
        `INSERT INTO vehicles (make, make_slug, model, model_slug, generation, body_type, year_from, year_to, pcd, is_popular, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?)`,
        [make, makeSlug, model, modelSlug, generation, bodyType, yearFrom, yearTo, pcd, sortOrder],
      );
    const swiftOldId = vehicle('Maruti Suzuki', 'maruti-suzuki', 'Swift', 'swift', '3rd gen', 'hatchback', 2018, 2024, '4x100', 1);
    const swiftNewId = vehicle('Maruti Suzuki', 'maruti-suzuki', 'Swift', 'swift', '4th gen', 'hatchback', 2024, null, '4x100', 2);
    const cretaId = vehicle('Hyundai', 'hyundai', 'Creta', 'creta', '2nd gen', 'suv', 2020, null, '5x114.3', 3);

    const product = (fields) => {
      const row = {
        brand: 'Addon',
        short_description: 'A part from the test catalogue.',
        cost_price: null,
        stock: 10,
        ship_class: 'small',
        fitment_type: 'universal',
        body_types: [],
        pcd: '',
        legality: 'road_legal',
        legality_note: '',
        install_difficulty: 1,
        cod_eligible: true,
        goals: [],
        essential_rank: 0,
        build_slot: null,
        build_style: null,
        custom_kind: null,
        ...fields,
      };
      const id = insert(
        `INSERT INTO products (slug, sku, name, brand, category_id, short_description, price, mrp, cost_price, stock, ship_class,
           fitment_type, body_types, pcd, legality, legality_note, install_difficulty, cod_eligible, goals, essential_rank,
           build_slot, build_style, custom_kind)
         VALUES (:slug, :sku, :name, :brand, :category_id, :short_description, :price, :mrp, :cost_price, :stock, :ship_class,
           :fitment_type, :body_types, :pcd, :legality, :legality_note, :install_difficulty, :cod_eligible, :goals, :essential_rank,
           :build_slot, :build_style, :custom_kind)`,
        row,
      );
      db.run('INSERT INTO price_history (product_id, price, mrp) VALUES (?, ?, ?)', [id, row.price, row.mrp]);
      return { id, slug: row.slug, sku: row.sku, name: row.name, price: row.price, mrp: row.mrp, stock: row.stock };
    };

    const spoiler = product({
      slug: 'addon-aero-roof-spoiler-swift',
      sku: 'T-EXT-001',
      name: 'Addon Aero Roof Spoiler for Maruti Suzuki Swift (2018-2024)',
      brand: 'Addon Aero',
      category_id: spoilersId,
      price: 3499,
      mrp: 4999,
      cost_price: 2100,
      stock: 12,
      ship_class: 'bulky',
      fitment_type: 'vehicle',
      install_difficulty: 2,
      goals: ['sporty'],
      essential_rank: 2,
      build_slot: 'spoiler',
      build_style: 'roof',
    });
    db.run("INSERT INTO product_fitments (product_id, vehicle_id, fit_type, note, is_verified) VALUES (?, ?, 'direct', '', 1)", [
      spoiler.id,
      swiftOldId,
    ]);

    const universal = product({
      slug: 'addon-universal-boot-lip-spoiler',
      sku: 'T-EXT-002',
      name: 'Addon Aero Universal Boot Lip Spoiler',
      brand: 'Addon Aero',
      category_id: spoilersId,
      price: 1299,
      mrp: 1999,
      cost_price: 700,
      stock: 40,
      goals: ['sporty', 'new_car'],
      essential_rank: 1,
    });

    const bodyType = product({
      slug: 'addon-hatchback-roof-spoiler',
      sku: 'T-EXT-003',
      name: 'Addon Aero Roof Spoiler for Hatchbacks',
      brand: 'Addon Aero',
      category_id: spoilersId,
      price: 2499,
      mrp: 3299,
      cost_price: 1500,
      stock: 8,
      ship_class: 'medium',
      fitment_type: 'body_type',
      body_types: ['hatchback'],
      install_difficulty: 2,
    });

    const wheel = product({
      slug: 'addon-forge-15-alloy-wheel-4x100',
      sku: 'T-WHL-001',
      name: 'Addon Forge 15 inch Alloy Wheels, Set of 4 (4x100)',
      brand: 'Addon Forge',
      category_id: alloysId,
      price: 21999,
      mrp: 27999,
      cost_price: 16000,
      stock: 6,
      ship_class: 'freight',
      fitment_type: 'pcd',
      pcd: '4x100',
      install_difficulty: 3,
      goals: ['sporty'],
      essential_rank: 3,
      build_slot: 'wheels',
      build_style: 'five-spoke',
    });
    const variant = (name, sku, price, mrp, stock, finish, sortOrder) => ({
      id: insert(
        'INSERT INTO product_variants (product_id, name, sku, price, mrp, stock, attributes, sort_order) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [wheel.id, name, sku, price, mrp, stock, { Size: '15 inch', Finish: finish }, sortOrder],
      ),
      name,
      sku,
      price,
      mrp,
      stock,
    });
    wheel.variants = [
      variant('15 inch / Gloss Black', 'T-WHL-001-BLK', 21999, 27999, 4, 'Gloss Black', 1),
      variant('15 inch / Gunmetal', 'T-WHL-001-GUN', 23999, 29999, 2, 'Gunmetal', 2),
    ];

    const outOfStock = product({
      slug: 'addon-forge-locking-wheel-nuts',
      sku: 'T-WHL-002',
      name: 'Addon Forge Locking Wheel Nuts, Set of 4',
      brand: 'Addon Forge',
      category_id: alloysId,
      price: 899,
      mrp: 1299,
      cost_price: 450,
      stock: 0,
    });

    const showPlate = product({
      slug: 'addon-show-plate',
      sku: 'T-EXT-004',
      name: 'Addon Custom Show Plate',
      category_id: spoilersId,
      price: 799,
      mrp: 999,
      cost_price: 300,
      stock: 100,
      fitment_type: 'none',
      legality: 'off_road_only',
      legality_note: 'A decorative show plate for display. It is not a registration plate.',
      cod_eligible: false,
      custom_kind: 'show-plate',
    });

    const couponId = insert(
      "INSERT INTO coupons (code, description, type, value, min_order, max_discount) VALUES ('FIT10', '10% off orders above ₹999', 'percent', 10, 999, 500)",
    );

    const user = (name, email, phone, role, password) => ({
      id: insert('INSERT INTO users (name, email, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)', [
        name,
        email,
        phone,
        passwordHashes[role],
        role,
      ]),
      name,
      email,
      phone,
      role,
      password,
    });

    return {
      categories: {
        exterior: { id: exteriorId, slug: 'exterior-styling' },
        spoilers: { id: spoilersId, slug: 'spoilers-wings', parentId: exteriorId },
        wheels: { id: wheelsId, slug: 'wheels-tyres' },
        alloys: { id: alloysId, slug: 'alloy-wheels', parentId: wheelsId },
      },
      vehicles: {
        swiftOld: { id: swiftOldId, label: 'Maruti Suzuki Swift (2018-2024)', bodyType: 'hatchback', pcd: '4x100' },
        swiftNew: { id: swiftNewId, label: 'Maruti Suzuki Swift (2024 onwards)', bodyType: 'hatchback', pcd: '4x100' },
        creta: { id: cretaId, label: 'Hyundai Creta (2020 onwards)', bodyType: 'suv', pcd: '5x114.3' },
      },
      products: { spoiler, universal, bodyType, wheel, outOfStock, showPlate },
      coupon: { id: couponId, code: 'FIT10', percent: 10, minOrder: 999, maxDiscount: 500 },
      admin: user('Asha Admin', 'admin@addon.test', '9812345670', 'admin', ADMIN_PASSWORD),
      customer: user('Kiran Customer', 'kiran@example.com', '9876543210', 'customer', CUSTOMER_PASSWORD),
    };
  });
}

/**
 * Starts the whole API on a random port with a fresh in-memory database.
 *
 *   const t = await startTestApp();
 *   const res = await t.api('/api/health');            // { status, ok, body, headers }
 *   const admin = t.asAdmin();                         // same call shape, signed in as the admin
 *   await admin('/api/admin/coupons', { method: 'POST', body: { ... } });
 *   await t.close();
 *
 * Options: `config` is merged over the test config (for example { razorpay: { keyId, keySecret, webhookSecret } }),
 * `fixtures: false` starts with empty tables (then asAdmin and asCustomer are not available).
 */
export async function startTestApp({ config: configOverrides = {}, fixtures: withFixtures = true } = {}) {
  const [{ loadConfig }, { createContext }, { createApp }, auth] = await Promise.all([
    import('../src/config.js'),
    import('../src/context.js'),
    import('../src/app.js'),
    import('../src/lib/auth.js'),
  ]);

  const uploadsDir = fs.mkdtempSync(path.join(os.tmpdir(), 'addon-test-uploads-'));
  const config = {
    ...loadConfig({ NODE_ENV: 'test', JWT_SECRET: 'test-secret-for-node-test-only', DB_PATH: ':memory:', PUBLIC_URL: 'http://localhost:5173' }),
    uploadsDir,
    ...configOverrides,
  };
  const ctx = createContext({ config });

  let fixtures = null;
  if (withFixtures) {
    const [admin, customer] = await Promise.all([auth.hashPassword(ADMIN_PASSWORD), auth.hashPassword(CUSTOMER_PASSWORD)]);
    fixtures = insertFixtures(ctx, { admin, customer });
  }

  const app = createApp(ctx);
  const server = await new Promise((resolve, reject) => {
    const listening = app.listen(0, '127.0.0.1', (err) => (err ? reject(err) : resolve(listening)));
  });
  const url = `http://127.0.0.1:${server.address().port}`;

  // Each client keeps its own cookies, like a separate browser.
  function createClient(initialCookies = {}) {
    const jar = new Map(Object.entries(initialCookies));

    return async function api(pathname, { method = 'GET', body, cookie, headers = {} } = {}) {
      const requestHeaders = new Headers(headers);
      const cookieHeader = cookie ?? [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
      if (cookieHeader) requestHeaders.set('cookie', cookieHeader);

      let payload = body;
      const isRaw = typeof body === 'string' || body instanceof FormData || body instanceof Blob || ArrayBuffer.isView(body);
      if (body !== undefined && !isRaw) {
        payload = JSON.stringify(body);
        if (!requestHeaders.has('content-type')) requestHeaders.set('content-type', 'application/json');
      }

      const response = await fetch(url + pathname, { method, headers: requestHeaders, body: payload, redirect: 'manual' });

      for (const line of response.headers.getSetCookie()) {
        const [pair] = line.split(';');
        const separator = pair.indexOf('=');
        const name = pair.slice(0, separator).trim();
        const value = pair.slice(separator + 1).trim();
        if (value === '' || /max-age=0|expires=thu, 01 jan 1970/i.test(line)) jar.delete(name);
        else jar.set(name, value);
      }

      const text = await response.text();
      const isJson = (response.headers.get('content-type') ?? '').includes('application/json');
      return {
        status: response.status,
        ok: response.ok,
        body: isJson && text !== '' ? JSON.parse(text) : text,
        headers: response.headers,
      };
    };
  }

  /** A client signed in as the user with this id (the cookie is minted directly, no login route involved). */
  function asUser(userId) {
    return createClient({ [auth.SESSION_COOKIE]: auth.signSession(ctx, userId) });
  }

  function fixtureUser(role) {
    if (!fixtures) throw new Error(`startTestApp({ fixtures: false }) has no ${role} user. Insert one and use asUser(id).`);
    return fixtures[role];
  }

  let closed = false;
  async function close() {
    if (closed) return;
    closed = true;
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
    ctx.db.close();
    try {
      fs.rmSync(uploadsDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
    } catch {
      // Windows keeps a file locked while anything still has it open (sharp does, when given a path).
      // The folder is in the OS temp directory, so leaving it behind is harmless.
    }
  }

  return {
    ctx,
    app,
    url,
    /** A signed-out client. It keeps any cookies the server sets, so a login through the API sticks. */
    api: createClient(),
    /** A new signed-out client with its own cookie jar. */
    newClient: () => createClient(),
    asAdmin: () => asUser(fixtureUser('admin').id),
    asCustomer: () => asUser(fixtureUser('customer').id),
    asUser,
    fixtures,
    close,
  };
}
