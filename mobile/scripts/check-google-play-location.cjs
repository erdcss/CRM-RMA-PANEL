#!/usr/bin/env node
// Fail closed: Android must not request location for the optional marketing geofence.
// Run after expo prebuild (EAS gets the same app.json when generating native code).
const fs=require('node:fs');
const assert=require('node:assert/strict');
const expo=require('../app.json').expo;
const required=[
  ...['ACCESS_BACKGROUND_LOCATION','ACCESS_COARSE_LOCATION','ACCESS_FINE_LOCATION']
    .map(name=>'android.permission.'+name),
  'com.google.android.gms.permission.AD_ID',
  'android.permission.ACCESS_ADSERVICES_AD_ID',
];
const plugin=expo.plugins.find(p=>Array.isArray(p)&&p[0]==='expo-location')?.[1];
assert(plugin,'expo-location plugin is absent');
assert.equal(plugin.isAndroidBackgroundLocationEnabled,false);
assert.equal(plugin.isIosBackgroundLocationEnabled,true);
for(const name of required){
  assert(expo.android.blockedPermissions?.includes(name),'blockedPermissions missing '+name);
}
const stub=fs.readFileSync('lib/store-geofence.android.ts','utf8');
assert(!stub.includes('expo-location'),'Android geofence stub must not import location');
assert(!stub.includes('requestForegroundPermissionsAsync'),'Android geofence stub must not request location');
assert(!stub.includes('startGeofencingAsync'),'Android geofence stub must not start geofencing');
const notification=fs.readFileSync('app/notifications.tsx','utf8');
assert(!notification.includes("Konum izinlerini aç"),'Notifications must not request location permissions');
assert(!notification.includes('requestStoreNearbyOptIn'),'Notifications must not own geofence opt-in');
assert(notification.includes("Platform.OS === 'android'"),'Android notification opt-in must be separate');
const settings=fs.readFileSync('app/settings.tsx','utf8');
assert(settings.includes("Platform.OS === 'ios' && user?.id"),'Geofence preferences must be iOS-only in Settings');
assert(settings.includes('revokeStoreNearby'),'Users must retain a location opt-out in Settings');
const path='android/app/src/main/AndroidManifest.xml';
assert(fs.existsSync(path),'Expo Android native prebuild must complete before location check');
const manifest=fs.readFileSync(path,'utf8');
for(const name of required){
  const tags=manifest.match(/<uses-permission(?:\s[^>]*)?\/?>/g)||[];
  assert(tags.some(tag=>tag.includes('"'+name+'"')&&/tools:node\s*=\s*["']remove["']/.test(tag)),
    'Android manifest must exclude permission: '+name);
}
console.log('Android location and ad ID permissions blocked; iOS background location preserved.');
