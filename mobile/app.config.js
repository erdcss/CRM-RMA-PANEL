module.exports = ({ config }) => {
  const isDevelopment = process.env.APP_VARIANT === "development";

  return {
    ...config,
    name: isDevelopment ? "Çalışkan B2B Dev" : config.name,
    scheme: isDevelopment ? "caliskanb2b-dev" : config.scheme,
    ios: {
      ...config.ios,
      bundleIdentifier: isDevelopment
        ? "com.caliskangroup.rma.dev"
        : config.ios?.bundleIdentifier,
    },
    android: {
      ...config.android,
      package: isDevelopment
        ? "com.caliskangroup.rma.dev"
        : config.android?.package,
    },
    extra: {
      ...(config.extra || {}),
      appVariant: isDevelopment ? "development" : "production",
    },
  };
};
