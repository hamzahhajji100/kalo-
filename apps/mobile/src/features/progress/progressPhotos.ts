import { Directory, File, Paths } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';

import { db } from '@/data/client';
import {
  addProgressPhoto,
  deleteProgressPhoto,
  type ProgressPhoto,
} from '@/data/repositories/photos';
import { localIsoDate } from '@/lib/date';
import { newId } from '@/lib/id';

const dir = () => new Directory(Paths.document, 'progress-photos');

/** Take or pick a progress photo and keep a private copy in the app's documents folder (never uploaded). */
export async function addPhoto(source: 'camera' | 'library'): Promise<boolean> {
  const res =
    source === 'camera'
      ? await ImagePicker.launchCameraAsync({ quality: 0.8 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });
  const asset = res.canceled ? undefined : res.assets[0];
  if (!asset) return false;
  const d = dir();
  if (!d.exists) d.create({ intermediates: true });
  const target = new File(d, `${newId()}.jpg`);
  await new File(asset.uri).copy(target);
  addProgressPhoto(db, localIsoDate(), target.uri);
  return true;
}

export function removePhoto(photo: ProgressPhoto): void {
  const f = new File(photo.uri);
  if (f.exists) f.delete();
  deleteProgressPhoto(db, photo.id);
}

/** Used by "delete all data". */
export function deleteAllPhotoFiles(): void {
  const d = dir();
  if (d.exists) d.delete();
}
