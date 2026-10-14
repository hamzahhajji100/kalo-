import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { db } from '@/data/client';
import { listWeights } from '@/data/repositories/body';
import { entriesBetween } from '@/data/repositories/diary';
import { listMealTypes } from '@/data/repositories/mealTypes';
import { localIsoDate } from '@/lib/date';
import { diaryCsv, weightsCsv } from './csv';

/** Write a CSV to the cache directory and open the system share sheet. Nothing leaves the device otherwise. */
export async function exportCsv(
  kind: 'diary' | 'weights',
  lang: 'de' | 'en',
  mealLabel: (key: string | null, name: string | null) => string,
): Promise<void> {
  const today = localIsoDate();
  let content: string;
  if (kind === 'diary') {
    const meals = new Map(
      listMealTypes(db, { includeArchived: true }).map((m) => [m.id, mealLabel(m.key, m.name)]),
    );
    content = diaryCsv(
      entriesBetween(db, '0000-01-01', '9999-12-31'),
      (id) => meals.get(id) ?? '',
      lang,
    );
  } else {
    content = weightsCsv(listWeights(db), lang);
  }
  const file = new File(Paths.cache, `kalo-${kind}-${today}.csv`);
  if (file.exists) file.delete();
  file.create();
  file.write(content);
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(file.uri, {
      mimeType: 'text/csv',
      dialogTitle: 'Kalo Export',
      UTI: 'public.comma-separated-values-text',
    });
  }
}
