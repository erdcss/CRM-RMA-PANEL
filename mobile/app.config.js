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

  // Compile the native SDK only when an EAS Client Token is configured.
  // The client token is a public mobile-app configuration value, NOT the App Secret.
  const metaClientToken = process.env.EXPO_PUBLIC_META_CLIENT_TOKEN?.trim();
  if (metaClientToken && !isDevelopment) {
    plugins.push([
      "react-native-fbsdk-next",
      {
        appID: "979770188524984",
        displayName: "Çalışkan B2B",
        clientToken: metaClientToken,
        scheme: "fb979770188524984",
        advertiserIDCollectionEnabled: false,
        autoLogAppEventsEnabled: false,
        isAutoInitEnabled: false,
        iosUserTrackingPermission: false,
      },
    ]);
  }

  // Native TikTok module is dormant until explicit in-app permission and EAS app secret.
  if (!plugins.some(p => p === './plugins/withTikTokAppEvents.js')) {
    plugins.push('./plugins/withTikTokAppEvents.js');
  }

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
