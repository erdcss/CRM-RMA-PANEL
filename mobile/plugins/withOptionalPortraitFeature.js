const { withAndroidManifest } = require("@expo/config-plugins");

const PORTRAIT_FEATURE = "android.hardware.screen.portrait";

/**
 * Keep portrait as the preferred phone orientation, but do not require
 * portrait-specific display hardware for Google Play device eligibility.
 * This change must survive each Expo prebuild / EAS native regeneration.
 */
module.exports = function withOptionalPortraitFeature(config) {
  return withAndroidManifest(config, (config) => {
    const manifest = config.modResults.manifest;
    const features = manifest["uses-feature"] || [];
    const retained = [];
    let found = false;

    for (const feature of features) {
      if (feature?.$?.["android:name"] !== PORTRAIT_FEATURE) {
        retained.push(feature);
        continue;
      }
      if (found) continue;
      found = true;
      retained.push({
        ...feature,
        $: {
          ...feature.$,
          "android:name": PORTRAIT_FEATURE,
          "android:required": "false",
        },
      });
    }

    if (!found) {
      retained.push({
        $: {
          "android:name": PORTRAIT_FEATURE,
          "android:required": "false",
        },
      });
    }

    manifest["uses-feature"] = retained;
    return config;
  });
};
