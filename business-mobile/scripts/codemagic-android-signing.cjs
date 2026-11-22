#!/usr/bin/env node
// Expo CNG generates the Android project on Codemagic. Modify only the
// temporary native project and never store a keystore in source control.
const fs = require('node:fs');
const path = require('node:path');

const required = [
  'CM_KEYSTORE_PATH', 'CM_KEYSTORE_PASSWORD', 'CM_KEY_ALIAS', 'CM_KEY_PASSWORD',
];
for (const key of required) {
  if (!process.env[key]) {
    throw new Error(key + ' is missing. Upload the EXISTING Business Android release keystore to Codemagic first.');
  }
}
const file = path.join(__dirname, '..', 'android', 'app', 'build.gradle');
if (!fs.existsSync(file)) throw new Error('Run expo prebuild --platform android first');
let source = fs.readFileSync(file, 'utf8');
if (!/signingConfigs\s*\{/.test(source)) throw new Error('Unexpected Expo Android signing layout');
const releaseConfig = `
        release {
            storeFile file(System.getenv('CM_KEYSTORE_PATH'))
            storePassword System.getenv('CM_KEYSTORE_PASSWORD')
            keyAlias System.getenv('CM_KEY_ALIAS')
            keyPassword System.getenv('CM_KEY_PASSWORD')
        }`;
source = source.replace(/signingConfigs\s*\{/, (match) => match + releaseConfig);
const releaseSigning = /(buildTypes\s*\{[\s\S]*?release\s*\{[\s\S]*?signingConfig\s+)signingConfigs\.debug/;
if (!releaseSigning.test(source)) {
  throw new Error('Could not identify Android release signingConfig: aborting instead of using debug keys');
}
source = source.replace(releaseSigning, '$1signingConfigs.release');
fs.writeFileSync(file, source);
console.log('[Business Codemagic] Android release signing enabled using Codemagic-managed keystore');
