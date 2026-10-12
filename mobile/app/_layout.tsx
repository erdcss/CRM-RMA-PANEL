import { useEffect, useState } from 'react';
import { ImageBackground, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppAlertBridge } from '@/components/ui/AppAlertBridge';
import { AuthGate, RootStack } from '@/components/auth/AuthGate';
import { AlertProvider } from '@/contexts/AlertContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { useMobileBranding } from '@/lib/branding';

const SPLASH_DURATION_MS = 5_000;

export default function RootLayout() {
  const branding = useMobileBranding();
  const [showManagedSplash, setShowManagedSplash] = useState(true);

  // Only once per cold app launch. Branding refreshes must not restart the splash.
  useEffect(() => {
    const timer = setTimeout(() => setShowManagedSplash(false), SPLASH_DURATION_MS);
    return () => clearTimeout(timer);
  }, []);

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AlertProvider>
          <AppAlertBridge />
          <AuthGate>
            <StatusBar style="dark" />
            <RootStack />
          </AuthGate>
        </AlertProvider>
      </AuthProvider>

      {showManagedSplash ? (
        <View style={styles.splash} pointerEvents="auto">
          {branding.b2b_mobile_splash ? (
            <ImageBackground
              source={{ uri: branding.b2b_mobile_splash }}
              resizeMode="cover"
              style={StyleSheet.absoluteFillObject}
            />
          ) : (
            <View style={StyleSheet.absoluteFillObject} />
          )}
          <StatusBar style="light" />
        </View>
      ) : null}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#101010',
  },
});
