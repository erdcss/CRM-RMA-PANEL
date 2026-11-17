/**
 * Android Play release intentionally does not collect device location.
 * The former marketing geofence was not a core app feature and cannot
 * justify ACCESS_BACKGROUND_LOCATION under Google Play policy.
 *
 * Metro resolves this Android-specific module before store-geofence.ts,
 * preserving the optional iOS behavior without bundling Android tracking.
 */
export async function stopStoreNearby():Promise<void>{}
export async function revokeStoreNearby(_user:string):Promise<void>{}
export async function isStoreNearbyEnabled(_user:string):Promise<boolean>{return false;}
export async function getStoreNearbyPermissionStatus(_user:string):Promise<{consented:boolean;ready:boolean}>{
  return {consented:false,ready:false};
}
export async function requestStoreNearbyOptIn(_user:string):Promise<boolean>{return false;}
export async function configureStoreNearby(_user:string):Promise<void>{}
