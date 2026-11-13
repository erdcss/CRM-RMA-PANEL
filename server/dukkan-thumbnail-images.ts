import {imageArray,validateDukkanImages} from "./dukkan-b2b-sync";

/**
 * Thumbnail uploads become the first image. Older gallery images are retained
 * in order (up to six), so changing the card cover never silently discards
 * the whole gallery.
 */
export function prependDukkanProductCover(
  uploadedImage:string,currentImages:unknown,currentCover:unknown,
):string[]{
  const [photo]=validateDukkanImages([uploadedImage]);
  const historical=imageArray(Array.isArray(currentImages)?currentImages:[]);
  const fallback=imageArray(typeof currentCover==="string"?[currentCover]:[]);
  const seen=new Set<string>();
  const next=[photo,...historical,...fallback]
    .filter(src=>{
      if(src.length>3_000_000||seen.has(src))return false;
      seen.add(src);return true;
    }).slice(0,6);
  return validateDukkanImages(next);
}
