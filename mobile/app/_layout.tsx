import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppAlertBridge } from '@/components/ui/AppAlertBridge';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { AuthGate, RootStack } from '@/components/auth/AuthGate';
import { AlertProvider } from '@/contexts/AlertContext';
import { AuthProvider } from '@/contexts/AuthContext';
import { useMobileBranding } from '@/lib/branding';

export default function RootLayout() {
  const branding = useMobileBranding();
  const [showManagedSplash, setShowManagedSplash] = useState(true);

  useEffect(() => {
    if (!branding.loaded) return;
    const timer = setTimeout(() => setShowManagedSplash(false), 1600);
    return () => clearTimeout(timer);
  }, [branding.loaded, branding.b2b_mobile_splash]);

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
        <View style={styles.splash} pointerEvents="none">
          <BrandLogo
            uri={branding.b2b_mobile_splash || branding.b2b_mobile_logo}
            style={styles.splashImage}
          />
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
