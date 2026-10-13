import * as FileSystem from 'expo-file-system/legacy';

/**
 * Persist a selected product image in the app cache without depending on
 * the retired RMA Supabase client. Used by the B2B camera/gallery picker.
 */
export async function persistLocalImage(localUri: string): Promise<string> {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return localUri;
  try {
    const dest = `${cacheDir}b2b-picked-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: localUri, to: dest });
    return dest;
  } catch (error) {
    throw new Error('Görsel kaydedilemedi. Galeriden veya kameradan tekrar deneyin.');
  }
}
