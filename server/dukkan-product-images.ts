/** A Dükkan product may have a gallery, a legacy single image, or a
 * verified B2B catalog link. Never guess pictures using names or SKU collisions. */
export type DukkanPhotoRecord = {
  image_data?: unknown;
  images?: unknown;
  b2b_image_data?: unknown;
  b2b_images?: unknown;
};

export function isSupportedDukkanPhoto(value: unknown): value is string {
  return typeof value === "string" && (
    /^data:image\/(?:png|jpeg|webp);base64,[a-z0-9+/=]+$/i.test(value) ||
    /^https:\/\/[^\s]+$/i.test(value) ||
    /^\/uploads\/[a-z0-9._-]+$/i.test(value)
  );
}

function collectImages(images: unknown, legacy: unknown): string[] {
  const gallery = Array.isArray(images) ? images.filter(isSupportedDukkanPhoto).slice(0, 6) : [];
  if (isSupportedDukkanPhoto(legacy) && !gallery.includes(legacy)) gallery.push(legacy);
  return gallery;
}

export function dukkanPhotos(record: DukkanPhotoRecord): string[] {
  const local = collectImages(record.images, record.image_data);
  // B2B fallback is limited to the explicit b2b_product_id foreign mapping
  // enforced in the SQL join; no approximate or cross-store matching.
  return local.length ? local : collectImages(record.b2b_images, record.b2b_image_data);
}

export function dukkanPhotoAt(record: DukkanPhotoRecord, index = 0): string | null {
  return Number.isInteger(index) && index >= 0 && index < 6
    ? dukkanPhotos(record)[index] || null : null;
}
