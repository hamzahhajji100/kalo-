import type { Db } from '../db';
import * as s from '../schema';
import { ensureDefaultMealTypes } from './mealTypes';

/** Delete every piece of user data in the database, then restore the default meal types. */
export function wipeUserData(db: Db): void {
  db.transaction((tx) => {
    // Children first because of foreign keys.
    for (const table of [
      s.diaryEntries,
      s.recipeItems,
      s.recipes,
      s.mealTemplateItems,
      s.mealTemplates,
      s.favorites,
      s.foods,
      s.goalsHistory,
      s.checkIns,
      s.profile,
      s.weights,
      s.bodyMeasurements,
      s.progressPhotos,
      s.waterLogs,
      s.mealTypes,
    ]) {
      tx.delete(table).run();
    }
  });
  ensureDefaultMealTypes(db);
}
