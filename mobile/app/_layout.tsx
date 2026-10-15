import { useEffect, useState } from 'react';
import { ImageBackground, StyleSheet, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppAlertBridge } from '@/components/ui/AppAlertBridge';
import { AuthGate, RootStack } from '@/components/auth/AuthGate';
import { AlertProvider } from '@/contexts/AlertContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppearanceProvider, useAppearance } from '@/contexts/AppearanceContext';
import { useMobileBranding } from '@/lib/branding';
import { managedSplash } from '@/lib/managed-splash';
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

  // Keep Expo Router mounted from the first render. The fully opaque splash
  // masks it until both the five-second minimum and auth recovery finish.
  const showSplash = !minimumSplashFinished || loading;
  return (
    <View style={styles.root}>
      <AppAlertBridge />
      <AuthGate>
        <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
        <RootStack />
      </AuthGate>
      {showSplash ? (
        <View style={styles.splash} pointerEvents="auto">
          {managedSplash ? (
            <ImageBackground source={managedSplash} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
          ) : branding.b2b_mobile_splash ? (
            <ImageBackground source={{ uri: branding.b2b_mobile_splash }} resizeMode="cover" style={StyleSheet.absoluteFillObject} />
          ) : (
            <View style={styles.splashFallback}>
              <Text style={styles.splashBrand}>ÇALIŞKAN</Text>
              <Text style={styles.splashSub}>B2B</Text>
            </View>
          )}
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
  splashFallback: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFCD00' },
  splashBrand: { color: '#101010', fontSize: 35, fontWeight: '900', letterSpacing: 1 },
  splashSub: { color: '#101010', fontSize: 24, fontWeight: '900', alignSelf: 'center' },
});
