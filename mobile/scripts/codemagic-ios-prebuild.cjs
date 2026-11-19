/**
 * Codemagic-only Expo prebuild preparation.
 * - Keep the private NIIMBOT iOS SDK out of the initial TestFlight build
 *   (the proprietary .a libraries cannot be redistributed via public GitHub).
 * - Stamp a monotonic build number per calendar day / Codemagic workflow run
 *   into the generated Xcode project (no Expo EAS remote version service).
 */
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const packagePath = path.join(root, 'package.json');
const appPath = path.join(root, 'app.json');
const pkg = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
const app = JSON.parse(fs.readFileSync(appPath, 'utf8'));

if (process.env.EXPO_SKIP_NIIMBOT === '1') {
  pkg.expo ||= {};
  pkg.expo.autolinking ||= {};
  pkg.expo.autolinking.ios ||= {};
  const excluded = new Set(pkg.expo.autolinking.ios.exclude || []);
  excluded.add('niimbot-printer');
  pkg.expo.autolinking.ios.exclude = [...excluded];
  fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + '\n');
  console.log('[ios-ci] NIIMBOT private iOS SDK excluded from native autolinking.');
} else {
  console.log('[ios-ci] NIIMBOT iOS SDK enabled; the vendor binaries must be present.');
}

const raw = process.env.PROJECT_BUILD_NUMBER || process.env.BUILD_NUMBER;
const sequence = Number(raw);
if (!raw || !Number.isSafeInteger(sequence) || sequence < 1 || sequence > 999) {
  throw new Error('Codemagic PROJECT_BUILD_NUMBER must be a whole number between 1 and 999. Stop rather than risk reusing a TestFlight build number.');
}
const now = new Date();
const date = String(now.getUTCFullYear() % 100).padStart(2, '0')
  + String(now.getUTCMonth() + 1).padStart(2, '0')
  + String(now.getUTCDate()).padStart(2, '0');
const buildNumber = date + String(sequence).padStart(3, '0');

app.expo ||= {};
app.expo.ios ||= {};
app.expo.ios.buildNumber = buildNumber;
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');
console.log('[ios-ci] Bundle ID: ' + app.expo.ios.bundleIdentifier);
console.log('[ios-ci] App version: ' + app.expo.version + ', iOS buildNumber: ' + buildNumber);
