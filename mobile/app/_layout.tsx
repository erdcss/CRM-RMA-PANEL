import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Image } from 'expo-image';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppAlertBridge } from '@/components/ui/AppAlertBridge';
import { AuthGate, RootStack } from '@/components/auth/AuthGate';
import { AlertProvider } from '@/contexts/AlertContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { useMobileBranding } from '@/lib/branding';

export default function RootLayout() {
  const branding = useMobileBranding();
  const [showManagedSplash, setShowManagedSplash] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => setShowManagedSplash(false), 1400);
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

      {showManagedSplash && branding.b2b_mobile_splash ? (
        <View style={styles.splash} pointerEvents="none">
          <Image source={{ uri: branding.b2b_mobile_splash }} style={styles.splashImage} contentFit="contain" />
        </View>
      ) : null}
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  splash: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ffffff',
  },
  splashImage: {
    width: '82%',
    height: '82%',
  },
});
