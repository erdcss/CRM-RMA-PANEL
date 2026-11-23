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

/**
 * Apple closes the entire TestFlight train when its marketing version is
 * approved. Increasing only CFBundleVersion does NOT reopen that train.
 */
function compareDottedVersions(current, previous) {
  const parse = (value) => {
    if (typeof value !== 'string' || !/^[0-9]+[.][0-9]+[.][0-9]+$/.test(value))
      throw new Error('iOS marketing version must be MAJOR.MINOR.PATCH: ' + value);
    return value.split('.').map(Number);
  };
  const left = parse(current), right = parse(previous);
  for (let i = 0; i < 3; i++) {
    if (left[i] !== right[i]) return left[i] > right[i] ? 1 : -1;
  }
  return 0;
}
const lastApproved = process.env.B2B_LAST_APPROVED_IOS_VERSION;
if (lastApproved && compareDottedVersions(app.expo?.version, lastApproved) <= 0)
  throw new Error('Apple TestFlight marketing version train is closed: ' +
    app.expo?.version + '. Increase expo.version above the approved version ' +
    lastApproved + ' before building again (90062 / 90186).');

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
const automaticCandidate = Number(date + String(sequence).padStart(3, '0'));
const applePrevious = process.env.B2B_APPSTORE_LATEST_BUILD_NUMBER;
let nextBuild = automaticCandidate;
// Two Codemagic workflows can reuse PROJECT_BUILD_NUMBER=1 on the same day.
// For TestFlight, always exceed the highest build Apple already knows about.
if (applePrevious !== undefined) {
  if (!/^[0-9]+$/.test(applePrevious.trim())) {
    throw new Error('App Store Connect returned a non-numeric build number; refusing a duplicate upload.');
  }
  const latest = Number(applePrevious);
  if (!Number.isSafeInteger(latest) || latest < 0) {
    throw new Error('Invalid latest App Store Connect build number.');
  }
  nextBuild = Math.max(automaticCandidate, latest + 1);
}
if (!Number.isSafeInteger(nextBuild) || nextBuild < 1 || nextBuild > 2147483647) {
  throw new Error('iOS build number is outside the safe positive integer range.');
}
const buildNumber = String(nextBuild);

app.expo ||= {};
app.expo.ios ||= {};
app.expo.ios.buildNumber = buildNumber;
fs.writeFileSync(appPath, JSON.stringify(app, null, 2) + '\n');
console.log('[ios-ci] Bundle ID: ' + app.expo.ios.bundleIdentifier);
console.log('[ios-ci] App version: ' + app.expo.version + ', iOS buildNumber: ' + buildNumber);
