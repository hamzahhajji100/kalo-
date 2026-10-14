import { searchCatalog } from '@kalo/food-db';

import { getCatalog } from '@/data/catalog';
import { analyzeMealPhoto } from './api';
import { prepareImage } from './prepareImage';
import { reconcileItem, type EditableItem } from './reconcile';

export type AnalysisOutcome =
  { status: 'ok'; dishName: string; notes: string; items: EditableItem[] } | { status: 'no_food' };

/** Compress → analyse via the Kalo API → match each component against the offline catalogue. */
export async function runPhotoAnalysis(
  photo: { uri: string; width: number; height: number },
  locale: 'de' | 'en',
  signal?: AbortSignal,
): Promise<AnalysisOutcome> {
  const { base64, mediaType } = await prepareImage(photo.uri, photo.width, photo.height);
  const result = await analyzeMealPhoto({ image: base64, mediaType, locale }, signal);
  if (result.status === 'no_food') return result;
  const catalog = getCatalog();
  const search = (q: string) => (catalog ? searchCatalog(catalog, q, { limit: 5 }) : []);
  return {
    status: 'ok',
    dishName: result.dishName,
    notes: result.notes,
    items: result.items.map((item, i) => reconcileItem(item, `ai-${i}`, search)),
  };
}
