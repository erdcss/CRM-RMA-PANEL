/**
 * Ensure marketing geofencing remains optional and first-use-only.
 * This protects against silently reintroducing the Notifications location
 * permission button or prompting while the native splash is still visible.
 */
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const notifications=read('app/notifications.tsx');
const layout=read('app/_layout.tsx');
const settings=read('app/settings.tsx');
const geofence=read('lib/store-geofence.ts');
const android=read('lib/store-geofence.android.ts');
const expo=JSON.parse(read('app.json')).expo;

assert.doesNotMatch(notifications,/Konum izinlerini aç|Konum izinlerini tamamla|Konum izinlerini kontrol et/);
assert.doesNotMatch(notifications,/requestStoreNearbyOptIn|getStoreNearbyPermissionStatus|revokeStoreNearby/);
assert.match(layout,/if \(showSplash \|\| !initialRoutePainted \|\| loading\) return/);
assert.match(layout,/Platform\.OS === 'ios' && userId/);
assert.match(layout,/await configureStoreNearby\(userId\)/);
assert.match(layout,/if \(userId\) await registerB2BPush\(\)/);
assert.match(layout,/isStoreNearbyEnabled\(userId\)/);
// The streamlined Settings screen no longer exposes optional location
// controls; first-use consent is handled at launch, never in Notifications.
if (settings.includes('Mağaza yakınlık bildirimleri')) {
  assert.match(settings,/requestStoreNearbyOptIn\(String\(user\.id\)\)/);
  assert.match(settings,/revokeStoreNearby\(String\(user\.id\)\)/);
} else {
  assert.doesNotMatch(settings,/requestStoreNearbyOptIn|getStoreNearbyPermissionStatus/);
  assert.doesNotMatch(settings,/Konum izinlerini aç|Konum izinlerini kontrol et/);
}
assert.match(geofence,/await Location\.requestForegroundPermissionsAsync\(\)/);
assert.match(geofence,/await Location\.requestBackgroundPermissionsAsync\(\)/);
assert.match(geofence,/CONSENT_PREFIX\+user,'no'/);
assert.match(geofence,/Location\.startGeofencingAsync\(TASK/);
assert.doesNotMatch(android,/import .*expo-location/);
assert.equal(expo.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-location')?.[1]?.isIosBackgroundLocationEnabled,true);
assert.ok(expo.android.blockedPermissions.includes('android.permission.ACCESS_BACKGROUND_LOCATION'));
console.log('B2B location first-use and opt-out regression checks passed.');
