/** Stable URL references for assets saved in the admin panel.
 * Avoid serializing large base64 images into the React Native bridge. */
export function shareBadgeUrl(
  value: unknown,
  store: "app-store" | "google-play",
  revision: number,
): string | null {
  if(typeof value!=="string"||!value.trim())return null;
  if(/^https:\/\/\S+$/i.test(value))return value.trim();
  if(/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/s.test(value))
    return "/api/public/b2b-share-badge/"+store+"?v="+(Number.isFinite(revision)?revision:0);
  return null;
}

export function shareAppLogo(branding: {
  b2b_mobile_logo?:string|null;b2b_logo?:string|null;
}):string|null {
  return branding.b2b_mobile_logo||branding.b2b_logo||null;
}
