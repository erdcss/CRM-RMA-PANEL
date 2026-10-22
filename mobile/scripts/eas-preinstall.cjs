const fs = require("node:fs");
const path = require("node:path");

// Refresh native assets on the remote build worker before Expo prebuild.
const {spawnSync}=require("node:child_process");
const branding=spawnSync(process.execPath,[path.join(__dirname,"eas-branding-preinstall.cjs")],{
  stdio:"inherit",env:process.env
});
if(branding.status!==0)process.exit(branding.status||1);

const mobileRoot = path.resolve(__dirname, "..");
const packagePath = path.join(mobileRoot, "package.json");

const skipNiimbot =
  process.env.EXPO_UI_DEV_CLIENT === "1" ||
  process.env.EXPO_SKIP_NIIMBOT === "1";

if (!skipNiimbot) {
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
console.log("[eas-preinstall] NIIMBOT iOS native module excluded from autolinking for this build profile.");
