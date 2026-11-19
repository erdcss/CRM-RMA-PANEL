#!/usr/bin/env node
'use strict';
// Run only after expo prebuild. Credentials stay in CI environment variables;
// they must NEVER be written to source control or printed to build logs.
const fs = require('node:fs');
const path = require('node:path');

const required = [
  'B2B_ANDROID_KEYSTORE_PATH',
  'B2B_ANDROID_KEYSTORE_PASSWORD',
  'B2B_ANDROID_KEY_ALIAS',
  'B2B_ANDROID_KEY_PASSWORD',
];
for (const name of required) {
  if (!process.env[name]) {
    console.error('Missing release-signing secret: ' + name);
    process.exit(1);
  }
}
if (!fs.existsSync(process.env.B2B_ANDROID_KEYSTORE_PATH)) {
  throw Error('Android release keystore file is unavailable.');
}
const file = path.resolve(__dirname, '../android/app/build.gradle');
let gradle = fs.readFileSync(file, 'utf8');
if (gradle.includes('signingConfigs.b2bUpload')) {
  throw Error('Android Gradle release signing has already been patched.');
}
const configs = /^(\s*)signingConfigs\s*\{\s*$/m;
const match = configs.exec(gradle);
if (!match) throw Error('Generated Expo Android Gradle signingConfigs block not found.');
const indent = match[1];
const nested = indent + '    ';
const body = [
  nested + 'b2bUpload {',
  nested + '    storeFile file(System.getenv("B2B_ANDROID_KEYSTORE_PATH"))',
  nested + '    storePassword System.getenv("B2B_ANDROID_KEYSTORE_PASSWORD")',
  nested + '    keyAlias System.getenv("B2B_ANDROID_KEY_ALIAS")',
  nested + '    keyPassword System.getenv("B2B_ANDROID_KEY_PASSWORD")',
  nested + '}',
  '',
].join('\n');
const insertion = match.index + match[0].length;
gradle = gradle.slice(0, insertion) + '\n' + body + gradle.slice(insertion);

const types = gradle.indexOf('buildTypes {');
const release = gradle.indexOf('release {', types);
if (types === -1 || release === -1) throw Error('Generated Android Gradle release block not found.');
const before = gradle.slice(0, release);
let rest = gradle.slice(release);
const signing = /signingConfig\s+signingConfigs\.debug/;
if (!signing.test(rest.slice(0, 1600))) {
  throw Error('Expected Expo default debug signing within release block; refusing unsafe patch.');
}
rest = rest.replace(signing, 'signingConfig signingConfigs.b2bUpload');
gradle = before + rest;
fs.writeFileSync(file, gradle);
console.log('Release Gradle configured to use the supplied upload keystore (values not logged).');
