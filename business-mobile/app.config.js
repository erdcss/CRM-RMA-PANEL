module.exports = ({ config }) => {
  const isDevelopment = process.env.APP_VARIANT === "development";
  // Business is an ERP companion app, not an advertising tracker.
  // Old binaries with ATT usage descriptions must be replaced by a clean build.
  const infoPlist = {...(config.ios?.infoPlist || {})};
  delete infoPlist.NSUserTrackingUsageDescription;

  return {
    ...config,
    name: isDevelopment ? "Çalışkan Business Dev" : config.name,
    scheme: isDevelopment ? "caliskanbusiness-dev" : config.scheme,
    ios: {
      ...config.ios,
      infoPlist,
      bundleIdentifier: isDevelopment
        ? "com.caliskangroup.business.dev"
        : config.ios?.bundleIdentifier,
    },
    android: {
      ...config.android,
      package: isDevelopment
        ? "com.caliskangroup.business.dev"
        : config.android?.package,
    },
    extra: {
      ...(config.extra || {}),
      appVariant: isDevelopment ? "development" : "production",
    },
  };
};
