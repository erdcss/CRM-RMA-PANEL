module.exports = ({ config }) => {
  const isDevelopment = process.env.APP_VARIANT === "development";
  // Only the development build should register Expo's generated launcher scheme.
  // This prevents a future TestFlight build from intercepting dev-client QR links.
  const plugins = (config.plugins || []).map((plugin) => {
    if (plugin === "expo-dev-client") {
      return ["expo-dev-client", { addGeneratedScheme: isDevelopment }];
    }
    if (Array.isArray(plugin) && plugin[0] === "expo-dev-client") {
      return ["expo-dev-client", { ...(plugin[1] || {}), addGeneratedScheme: isDevelopment }];
    }
    return plugin;
  });

  return {
    ...config,
    plugins,
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
