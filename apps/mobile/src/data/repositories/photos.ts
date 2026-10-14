import { desc, eq } from 'drizzle-orm';

import { newId } from '@/lib/id';
import type { Db } from '../db';
import { progressPhotos } from '../schema';

export type ProgressPhoto = typeof progressPhotos.$inferSelect;

export function addProgressPhoto(db: Db, date: string, uri: string): string {
  const id = newId();
  db.insert(progressPhotos).values({ id, date, uri }).run();
  return id;
}

export function listProgressPhotos(db: Db): ProgressPhoto[] {
  return db.select().from(progressPhotos).orderBy(desc(progressPhotos.date)).all();
}

export function deleteProgressPhoto(db: Db, id: string): void {
  db.delete(progressPhotos).where(eq(progressPhotos.id, id)).run();
}
