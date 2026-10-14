import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

/** Longest edge sent to the API: enough detail for recognition, small upload (~100–250 KB). */
export const MAX_EDGE = 1024;

/** Downscale and JPEG-compress a photo; returns base64 without prefix. The original stays on the device. */
export async function prepareImage(
  uri: string,
  width: number,
  height: number,
): Promise<{ base64: string; mediaType: 'image/jpeg' }> {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  const ctx = ImageManipulator.manipulate(uri);
  if (scale < 1)
    ctx.resize(
      width >= height
        ? { width: Math.round(width * scale) }
        : { height: Math.round(height * scale) },
    );
  const ref = await ctx.renderAsync();
  const out = await ref.saveAsync({ format: SaveFormat.JPEG, compress: 0.7, base64: true });
  if (!out.base64) throw new Error('Image encoding failed');
  return { base64: out.base64, mediaType: 'image/jpeg' };
}
