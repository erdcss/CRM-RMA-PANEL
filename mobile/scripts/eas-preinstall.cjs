const fs = require("node:fs");
const path = require("node:path");

const mobileRoot = path.resolve(__dirname, "..");
const packagePath = path.join(mobileRoot, "package.json");

if (process.env.EXPO_UI_DEV_CLIENT !== "1") {
  console.log("[eas-preinstall] Standard native build: NIIMBOT autolinking unchanged.");
  process.exit(0);
}

const pkg = JSON.parse(fs.readFileSync(packagePath, "utf8"));
pkg.expo ||= {};
pkg.expo.autolinking ||= {};
pkg.expo.autolinking.ios ||= {};

const excluded = new Set(pkg.expo.autolinking.ios.exclude || []);
excluded.add("niimbot-printer");
pkg.expo.autolinking.ios.exclude = Array.from(excluded);

fs.writeFileSync(packagePath, JSON.stringify(pkg, null, 2) + "\n");
console.log("[eas-preinstall] UI development build: NIIMBOT iOS native module excluded from autolinking.");
