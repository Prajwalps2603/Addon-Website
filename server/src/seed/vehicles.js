// Every make, model and generation from the catalogue: one vehicles row per generation.

// A model sold under two names lists both ('Carens / Carens Clavis'). The bolt pattern list uses the first.
const shortModelName = (name) => name.split(' / ')[0];

// 'BMW 3 Series (G20)' is one generation only. A plain 'Hyundai Creta' covers every generation of the model.
function pcdRules(pcdReference) {
  const rules = [];
  for (const { pcd, confidentExamples } of pcdReference) {
    for (const example of confidentExamples) {
      const [, car, generation = null] = example.match(/^(.*?)(?: \(([^)]+)\))?$/);
      rules.push({ pcd, car, generation });
    }
  }
  return rules;
}

function generationLabel(generation, model) {
  const soldAs = generation.soldAs && generation.soldAs !== model.name ? `, sold as ${generation.soldAs}` : '';
  return `${generation.label}${soldAs}`;
}

/**
 * Inserts the vehicles. Returns { count, startingIn, overlapping }:
 *   startingIn(makeSlug, modelSlug, yearFrom)        the row of the generation that began that year, or undefined
 *   overlapping(makeSlug, modelSlug, yearFrom, yearTo)  every generation sold inside that range (yearTo null = still on sale)
 */
export function seedVehicles(ctx, { catalog }) {
  const rules = pcdRules(catalog.vehicles.pcdReference);
  const byModel = new Map();
  let sortOrder = 0;

  for (const make of catalog.vehicles.makes) {
    for (const model of make.models) {
      const car = `${make.name} ${shortModelName(model.name)}`;
      const rows = [];
      // Newest first, so the lowest sort_order of a model is the generation on sale now.
      for (const generation of [...model.generations].sort((a, b) => b.from - a.from)) {
        sortOrder += 1;
        const rule = rules.find((entry) => entry.car === car && (entry.generation === null || entry.generation === generation.label));
        const row = {
          make: make.name,
          make_slug: make.slug,
          model: model.name,
          model_slug: model.slug,
          generation: generationLabel(generation, model),
          body_type: model.bodyType,
          year_from: generation.from,
          year_to: generation.to,
          pcd: rule?.pcd ?? '',
          is_popular: model.popular === true,
          sort_order: sortOrder,
        };
        const { lastInsertRowid } = ctx.db.run(
          `INSERT INTO vehicles (make, make_slug, model, model_slug, generation, body_type, year_from, year_to, pcd, is_popular, sort_order)
           VALUES (:make, :make_slug, :model, :model_slug, :generation, :body_type, :year_from, :year_to, :pcd, :is_popular, :sort_order)`,
          row,
        );
        rows.push({ ...row, id: lastInsertRowid });
      }
      byModel.set(`${make.slug}/${model.slug}`, rows);
    }
  }

  const generationsOf = (makeSlug, modelSlug) => byModel.get(`${makeSlug}/${modelSlug}`) ?? [];

  return {
    count: sortOrder,
    startingIn: (makeSlug, modelSlug, yearFrom) => generationsOf(makeSlug, modelSlug).find((row) => row.year_from === yearFrom),
    // Neighbouring generations share their changeover year (2018 to 2024, then 2024 onwards),
    // so touching at one end does not count as overlap.
    overlapping: (makeSlug, modelSlug, yearFrom, yearTo) =>
      generationsOf(makeSlug, modelSlug).filter(
        (row) => row.year_from < (yearTo ?? Infinity) && (row.year_to ?? Infinity) > yearFrom,
      ),
  };
}
