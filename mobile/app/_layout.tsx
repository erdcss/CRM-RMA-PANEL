import { useEffect, useState } from 'react';
import { SplashScreen, useSegments } from 'expo-router';
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

// Prevent the native iOS launch artwork from being dismissed before the
// admin-managed runtime splash has finished downloading and rendering.
// Call in module scope: a React effect is too late for the first frame.
void SplashScreen.preventAutoHideAsync();

const SPLASH_DURATION_MS = 5_000;

function AppContent() {
  const branding = useMobileBranding();
  const segments = useSegments();
  const { loading, session } = useAuth();
  const { mode } = useAppearance();
  const [minimumSplashFinished, setMinimumSplashFinished] = useState(false);
  const [paintedSplashUrl, setPaintedSplashUrl] = useState<string | null>(null);
  const [initialRoutePainted, setInitialRoutePainted] = useState(false);

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

  // The splash is the only startup screen. The auth gate may still be
  // replacing the initial route after restoring a session; never reveal
  // the navigator until its correct destination has actually mounted.
  const firstSegment = segments[0] as string | undefined;
  const onAuthRoute = firstSegment === 'login' || firstSegment === 'signup' || firstSegment === 'forgot-password';
  const routeReady = !loading && (session && !session.user.mustChangePassword
    ? Boolean(firstSegment && !onAuthRoute)
    : onAuthRoute);

  useEffect(() => {
    if (!routeReady || initialRoutePainted) return;
    // Allow navigation and the target screen to paint before removing the
    // opaque splash overlay. This guard is only for cold startup.
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => setInitialRoutePainted(true));
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [routeReady, initialRoutePainted]);

  const liveSplashUrl = branding.b2b_mobile_splash;
  const hasManagedSplash = Boolean(liveSplashUrl);
  const showSplash = !branding.loaded || !initialRoutePainted || (hasManagedSplash && !minimumSplashFinished);

  // Until the live image is painted, the iOS native splash stays up.
  // If no image is configured or download fails, keep the native artwork
  // until navigation is ready, then go straight to the destination screen.
  const runtimeSplashReady = !liveSplashUrl || paintedSplashUrl === liveSplashUrl;
  useEffect(() => {
    if (branding.loaded && ((runtimeSplashReady && initialRoutePainted) || !showSplash)) {
      void SplashScreen.hideAsync();
    }
  }, [branding.loaded, runtimeSplashReady, initialRoutePainted, showSplash]);

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
            <ImageBackground
              key={branding.b2b_mobile_splash}
              source={{ uri: branding.b2b_mobile_splash }}
              resizeMode="cover"
              style={StyleSheet.absoluteFillObject}
              onLoad={() => {
                // An image being downloaded is not the same as a painted frame.
                requestAnimationFrame(() => requestAnimationFrame(() => {
                  setPaintedSplashUrl(branding.b2b_mobile_splash ?? null);
                }));
              }}
            />
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
