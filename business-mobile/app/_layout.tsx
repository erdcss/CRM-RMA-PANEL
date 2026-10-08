import { useEffect, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Stack } from "expo-router";
import "react-native-url-polyfill/auto";
import { useMobileBranding } from "../lib/branding";

const MANAGED_SPLASH_DURATION_MS = 1400;

export default function RootLayout() {
  const branding = useMobileBranding();
  const [showManagedSplash, setShowManagedSplash] = useState(true);

  useEffect(() => {
    if (!branding.loaded) return;
    const timer = setTimeout(() => setShowManagedSplash(false), MANAGED_SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, [branding.loaded, branding.business_mobile_splash]);

  return (
    <View style={styles.root}>
      <Stack initialRouteName="login" screenOptions={{ headerShown: false, animation: "fade" }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="index" />
        <Stack.Screen name="menu" />
        <Stack.Screen name="module/[slug]" />
      </Stack>

      {showManagedSplash ? (
        <View style={styles.splash} pointerEvents="none">
          {branding.business_mobile_splash || branding.business_mobile_logo ? (
            <Image
              source={{ uri: branding.business_mobile_splash || branding.business_mobile_logo || "" }}
              style={styles.splashImage}
              resizeMode="contain"
            />
          ) : branding.loaded ? (
            <Text style={styles.splashFallback}>Çalışkan Business</Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0B0B0B",
  },
  splashImage: {
    width: "82%",
    height: "82%",
  },
  splashFallback: {
    color: "#FFFFFF",
    fontSize: 28,
    fontWeight: "800",
    letterSpacing: -0.5,
  },
});
