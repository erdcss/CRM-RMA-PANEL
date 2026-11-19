/**
 * VersionCode for chat-triggered signed Android releases.
 *
 * GitHub Actions `run_number` grows monotonically within this workflow,
 * including debug runs. Reserve 1000+ to stay above old EAS versions (<=28).
 * This file is executed ONLY by a signed release job.
 * The repository's checked-in app.json is never changed by CI.
 */
const fs = require('node:fs');
const path = require('node:path');
const current = path.resolve(__dirname, '..', 'app.json');
const config = JSON.parse(fs.readFileSync(current, 'utf8'));
const run = Number(process.env.GITHUB_RUN_NUMBER);
if (!process.env.GITHUB_ACTIONS || !Number.isSafeInteger(run) || run < 1) {
  throw new Error('[android-version] GitHub Actions run_number is required for signed Android builds.');
}
const code = 1000 + run;
const previous = Number(config.expo?.android?.versionCode);
if (config.expo?.android?.package !== 'com.caliskangroup.rma'
  || !Number.isSafeInteger(previous) || code <= previous
  || code >= 2100000000) {
  throw new Error('[android-version] Android versionCode must grow and remain valid for Google Play. Expected greater than ' + previous + ', got ' + code);
}
config.expo.android.versionCode = code;
fs.writeFileSync(current, JSON.stringify(config, null, 2) + '\n');
console.log('[android-version] ' + config.expo.version + ' (' + code + ') for GitHub Actions run ' + run);
