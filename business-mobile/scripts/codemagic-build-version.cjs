#!/usr/bin/env node
// Stamps monotonic-looking per-day Codemagic build numbers without Expo EAS.
// Run AFTER sync:branding and BEFORE expo prebuild.
const fs = require('node:fs');
const path = require('node:path');

const platform = process.argv[2];
if (!['ios', 'android'].includes(platform)) {
  throw new Error('Expected "ios" or "android"');
}
const raw = process.env.BUILD_NUMBER;
const sequence = Number(raw);
if (!raw || !Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999) {
  throw new Error('Codemagic BUILD_NUMBER must be between 1 and 999; refusing unsafe release version');
}
const configPath = path.join(__dirname, '..', 'app.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
const expo = config.expo;
const expected = 'com.caliskangroup.business';
if (expo?.ios?.bundleIdentifier !== expected || expo?.android?.package !== expected) {
  throw new Error('Wrong Business app identity; refusing to build another app');
}
if (expo.version !== '1.0.1') {
  throw new Error('Business app version differs from verified 1.0.1; review release versioning first');
}
const date = new Date();
const prefix = String(date.getUTCFullYear() % 100).padStart(2, '0') +
  String(date.getUTCMonth() + 1).padStart(2, '0') +
  String(date.getUTCDate()).padStart(2, '0');
const number = Number(prefix + String(sequence).padStart(3, '0'));
if (platform === 'ios') {
  expo.ios.buildNumber = String(number);
} else {
  if (number > 2100000000) throw new Error('Android versionCode exceeds Play limit');
  expo.android.versionCode = number;
}
fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n');
console.log('[Business Codemagic] ' + platform + ' · ' + expected + ' · version ' +
  expo.version + ' · build ' + number);
