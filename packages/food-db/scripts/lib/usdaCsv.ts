import { parse } from 'csv-parse';
import { createReadStream, existsSync } from 'node:fs';
import path from 'node:path';

import { usdaToFood, type Food, type Portion } from '@kalo/schemas';

/** Stream a FoodData Central CSV file as objects keyed by header. */
async function* readCsv(file: string): AsyncGenerator<Record<string, string>> {
  const parser = createReadStream(file).pipe(
    parse({ columns: true, relax_column_count: true, bom: true }),
  );
  for await (const row of parser) yield row as Record<string, string>;
}

export interface UsdaImportStats {
  foods: number;
  mapped: number;
  rejected: Record<string, number>;
}

/**
 * Read an unzipped FoodData Central CSV release (SR Legacy or Foundation) and map every food.
 * Expects food.csv and food_nutrient.csv; food_portion.csv and measure_unit.csv are optional.
 */
export async function readUsdaCsvDir(
  dir: string,
): Promise<{ foods: Food[]; stats: UsdaImportStats }> {
  const file = (name: string) => path.join(dir, name);
  if (!existsSync(file('food.csv')) || !existsSync(file('food_nutrient.csv'))) {
    throw new Error(
      `${dir} does not look like a FoodData Central CSV release (food.csv / food_nutrient.csv missing)`,
    );
  }

  const foods = new Map<number, { description: string; dataType: string }>();
  for await (const r of readCsv(file('food.csv'))) {
    const id = Number(r.fdc_id);
    if (Number.isFinite(id) && r.description)
      foods.set(id, { description: r.description, dataType: r.data_type ?? '' });
  }

  const nutrients = new Map<number, Map<number, number>>();
  for await (const r of readCsv(file('food_nutrient.csv'))) {
    const fdcId = Number(r.fdc_id);
    const nutrientId = Number(r.nutrient_id);
    const amount = Number(r.amount);
    if (
      !foods.has(fdcId) ||
      !Number.isFinite(nutrientId) ||
      r.amount === '' ||
      !Number.isFinite(amount)
    )
      continue;
    let m = nutrients.get(fdcId);
    if (!m) nutrients.set(fdcId, (m = new Map()));
    if (!m.has(nutrientId)) m.set(nutrientId, amount);
  }

  const units = new Map<string, string>();
  if (existsSync(file('measure_unit.csv'))) {
    for await (const r of readCsv(file('measure_unit.csv')))
      if (r.id && r.name) units.set(r.id, r.name);
  }
  const portions = new Map<number, Portion[]>();
  if (existsSync(file('food_portion.csv'))) {
    for await (const r of readCsv(file('food_portion.csv'))) {
      const fdcId = Number(r.fdc_id);
      const grams = Number(r.gram_weight);
      if (!foods.has(fdcId) || !(grams > 0)) continue;
      const unit = units.get(r.measure_unit_id ?? '');
      const label =
        r.portion_description?.trim() ||
        [r.amount, r.modifier?.trim() || (unit && unit !== 'undetermined' ? unit : '')]
          .filter(Boolean)
          .join(' ')
          .trim();
      if (!label) continue;
      const list = portions.get(fdcId) ?? [];
      list.push({ label, grams });
      portions.set(fdcId, list);
    }
  }

  const stats: UsdaImportStats = { foods: foods.size, mapped: 0, rejected: {} };
  const out: Food[] = [];
  for (const [fdcId, f] of foods) {
    const r = usdaToFood({
      fdcId,
      description: f.description,
      dataType: f.dataType,
      nutrients: nutrients.get(fdcId) ?? new Map(),
      portions: portions.get(fdcId) ?? [],
    });
    if (r.ok) {
      out.push(r.food);
      stats.mapped++;
    } else stats.rejected[r.reason] = (stats.rejected[r.reason] ?? 0) + 1;
  }
  return { foods: out, stats };
}
