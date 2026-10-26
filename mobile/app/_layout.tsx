import { useEffect, useState } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppAlertBridge } from '@/components/ui/AppAlertBridge';
import { AuthGate, RootStack } from '@/components/auth/AuthGate';
import { AlertProvider } from '@/contexts/AlertContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppearanceProvider, useAppearance } from '@/contexts/AppearanceContext';
import { useMobileBranding } from '@/lib/branding';
import { registerB2BPush } from '@/lib/push';

const SPLASH_DURATION_MS = 5_000;

function AppContent() {
  const branding = useMobileBranding();
  const { loading, session } = useAuth();
  const { mode } = useAppearance();
  const [minimumSplashFinished, setMinimumSplashFinished] = useState(false);

  useEffect(() => {
    if (!session?.user?.id) return;
    // Expo push-token registration requires a real native build and user consent.
    // Failure must never block the app's normal login/navigation.
    void registerB2BPush();
  }, [session?.user?.id]);

  // Splash is the only rendered screen at cold launch. Keep it visible while
  // restoring auth so no intermediate login, loading spinner or tab flashes.
  useEffect(() => {
    const timer = setTimeout(() => setMinimumSplashFinished(true), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  // The configurable splash comes only from admin branding. In particular,
  // removal must never render an old image embedded in the native bundle.
  // Without a configured image, don't artificially hold a 5-second splash.
  const hasManagedSplash = Boolean(branding.b2b_mobile_splash);
  const showSplash = loading || (!minimumSplashFinished && (!branding.loaded || hasManagedSplash));
  return (
    <View style={styles.root}>
      <AppAlertBridge />
      <AuthGate>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <RootStack />
      </AuthGate>
      {showSplash ? (
        <View style={styles.splash} pointerEvents="auto">
          {branding.b2b_mobile_splash ? (
            <ImageBackground key={branding.b2b_mobile_splash} source={{ uri: branding.b2b_mobile_splash }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
          ) : null}
          <StatusBar hidden={showSplash} style="light" />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AppearanceProvider>
      <AuthProvider>
        <AlertProvider>
          <AppContent />
        </AlertProvider>
      </AuthProvider>
      </AppearanceProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#101010' },
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    backgroundColor: '#101010',
  },
});
