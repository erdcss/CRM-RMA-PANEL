import { useEffect, useState } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppAlertBridge } from '@/components/ui/AppAlertBridge';
import { AuthGate, RootStack } from '@/components/auth/AuthGate';
import { AlertProvider } from '@/contexts/AlertContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { useMobileBranding } from '@/lib/branding';

const SPLASH_DURATION_MS = 5_000;

function AppContent() {
  const branding = useMobileBranding();
  const { loading } = useAuth();
  const [minimumSplashFinished, setMinimumSplashFinished] = useState(false);

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
        <StatusBar style="dark" />
        <RootStack />
      </AuthGate>
      {showSplash ? (
        <View style={styles.splash} pointerEvents="auto">
          {branding.b2b_mobile_splash ? (
            <ImageBackground
              source={{ uri: branding.b2b_mobile_splash }}
              resizeMode="cover"
              style={StyleSheet.absoluteFillObject}
            />
          ) : null}
          <StatusBar style="light" />
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AlertProvider>
          <AppContent />
        </AlertProvider>
      </AuthProvider>
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
