module.exports = ({ config }) => {
  const isDevelopment = process.env.APP_VARIANT === "development";

  return {
    ...config,
    name: isDevelopment ? "Çalışkan Business Dev" : config.name,
    scheme: isDevelopment ? "caliskanbusiness-dev" : config.scheme,
    ios: {
      ...config.ios,
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
