// The category tree: 9 top-level categories and their 61 subcategories, in catalogue order.

const poolOf = (photos, artKind) => photos.catalog[artKind] ?? [];

// A top-level tile borrows a photo from its lead subcategory: the one that shares its art kind.
// It takes that pool's second photo where there is one, so the two tiles do not show the same picture.
function topLevelImage(category, photos) {
  const lead = category.subcategories.find((sub) => sub.artKind === category.artKind) ?? category.subcategories[0];
  const ordered = [lead, ...category.subcategories.filter((sub) => sub !== lead)];
  for (const sub of ordered) {
    const pool = poolOf(photos, sub.artKind);
    if (pool.length > 0) return (sub === lead && pool[1] ? pool[1] : pool[0]).url;
  }
  return '';
}

/**
 * Inserts the categories. Returns { ids, categories, subcategories } where `ids` maps every
 * slug (top-level and sub) to its row id.
 */
export function seedCategories(ctx, { catalog, photos }) {
  const ids = new Map();
  const insert = (row) => {
    const { lastInsertRowid } = ctx.db.run(
      `INSERT INTO categories (slug, name, parent_id, blurb, art_kind, image, sort_order, is_active)
       VALUES (:slug, :name, :parentId, :blurb, :artKind, :image, :sortOrder, 1)`,
      row,
    );
    ids.set(row.slug, lastInsertRowid);
    return lastInsertRowid;
  };

  let subcategories = 0;
  catalog.categories.forEach((category, index) => {
    const parentId = insert({
      slug: category.slug,
      name: category.name,
      parentId: null,
      blurb: category.blurb,
      artKind: category.artKind,
      image: topLevelImage(category, photos),
      sortOrder: index + 1,
    });
    category.subcategories.forEach((sub, subIndex) => {
      insert({
        slug: sub.slug,
        name: sub.name,
        parentId,
        blurb: sub.blurb,
        artKind: sub.artKind,
        image: poolOf(photos, sub.artKind)[0]?.url ?? '',
        sortOrder: subIndex + 1,
      });
      subcategories += 1;
    });
  });

  return { ids, categories: catalog.categories.length, subcategories };
}
