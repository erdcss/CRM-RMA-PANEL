#!/usr/bin/env node
// Check the regenerated native manifest, not just the JS Expo configuration.
// Google Play must not filter out landscape-only hardware merely because
// phone screens use portrait orientation by default.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const app = require("../app.json").expo;
const plugin = "./plugins/withOptionalPortraitFeature.js";
assert(app.plugins.includes(plugin), "Portrait compatibility config plugin is missing");
assert.equal(app.android.package, "com.caliskangroup.rma", "Unexpected Android app ID");

const manifestPath = path.resolve(__dirname, "../android/app/src/main/AndroidManifest.xml");
assert(fs.existsSync(manifestPath), "Run expo prebuild --platform android before verifying portrait compatibility");

const manifest = fs.readFileSync(manifestPath, "utf8");
const featureTags = manifest.match(/<uses-feature\b[^>]*>/g) || [];
const portraitTags = featureTags.filter((tag) =>
  /android:name\s*=\s*["']android\.hardware\.screen\.portrait["']/.test(tag)
);
assert.equal(portraitTags.length, 1, "Expected exactly one portrait feature declaration");
assert(
  /android:required\s*=\s*["']false["']/.test(portraitTags[0]),
  "Portrait hardware feature must be optional for Google Play"
);
console.log("Google Play compatibility: android.hardware.screen.portrait is optional.");
