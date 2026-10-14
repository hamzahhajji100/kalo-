import { Food } from '@kalo/schemas';
import { desc, eq } from 'drizzle-orm';

import type { Db } from '../db';
import { favorites } from '../schema';

export function isFavorite(db: Db, foodId: string): boolean {
  return !!db
    .select({ id: favorites.foodId })
    .from(favorites)
    .where(eq(favorites.foodId, foodId))
    .get();
}

/** Toggle a favourite. The food is stored as a snapshot so it renders without the catalogue. Returns the new state. */
export function toggleFavorite(db: Db, food: Food): boolean {
  if (isFavorite(db, food.id)) {
    db.delete(favorites).where(eq(favorites.foodId, food.id)).run();
    return false;
  }
  db.insert(favorites)
    .values({ foodId: food.id, foodJson: JSON.stringify(food) })
    .run();
  return true;
}

export function listFavorites(db: Db): Food[] {
  return db
    .select()
    .from(favorites)
    .orderBy(desc(favorites.createdAt))
    .all()
    .flatMap((r) => {
      const parsed = Food.safeParse(JSON.parse(r.foodJson));
      return parsed.success ? [parsed.data] : [];
    });
}
