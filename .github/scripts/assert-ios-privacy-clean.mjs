import fs from "node:fs";

const [configPath, app] = process.argv.slice(2);
if (!configPath || !["b2b", "business"].includes(app)) {
  throw new Error("Usage: assert-ios-privacy-clean.mjs <expo-introspect-json> <b2b|business>");
}
const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
const forbidden = new Set(["NSUserTrackingUsageDescription"]);
if (app === "b2b") {
  forbidden.add("CaliskanTikTokAppSecret");
  forbidden.add("CaliskanTikTokAppleAppId");
  forbidden.add("CaliskanTikTokAppId");
  const eas = JSON.parse(fs.readFileSync("eas.json", "utf8"));
  for (const profile of ["production", "testflight"]) {
    if (eas.build?.[profile]?.env?.EXPO_PUBLIC_B2B_AD_TRACKING !== "0") {
      throw new Error("B2B " + profile + " must explicitly disable native ad tracking");
    }
  }
}
const detected = new Set();
function visit(value) {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) { for (const v of value) visit(v); return; }
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key)) detected.add(key);
    visit(child);
  }
}
visit(config);
if (detected.size) {
  throw new Error("iOS App Privacy blocker detected in generated configuration: " + [...detected].join(", "));
}
console.log(app + ": no ATT tracking usage description or unsafe native attribution config in Expo introspection");
