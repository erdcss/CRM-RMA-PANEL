import { useEffect, useRef, useState } from 'react';
import { useRouter, useSegments } from 'expo-router';
import * as Notifications from 'expo-notifications';
import * as SplashScreen from 'expo-splash-screen';
import { AppState, ImageBackground, Platform, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppAlertBridge } from '@/components/ui/AppAlertBridge';
import { AuthGate, RootStack } from '@/components/auth/AuthGate';
import { AlertProvider } from '@/contexts/AlertContext';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { AppearanceProvider, useAppearance } from '@/contexts/AppearanceContext';
import { useMobileBranding } from '@/lib/branding';
import { registerB2BPush } from '@/lib/push';
import {openB2BNotificationTarget} from '@/lib/notification-navigation';
import {resolveB2BNotificationLink} from '@/lib/notification-link';
import { requestMetaEventsConsentOnce } from '@/lib/meta-app-events';
import { initializeTikTokIfConsented } from '@/lib/tiktok-app-events';
import { configureStoreNearby, isStoreNearbyEnabled, stopStoreNearby } from '@/lib/store-geofence';
import { trackMobilePresence } from '@/lib/customer-insights';

// Prevent the native iOS launch artwork from being dismissed before the
// admin-managed runtime splash has finished downloading and rendering.
// Call in module scope: a React effect is too late for the first frame.
void SplashScreen.preventAutoHideAsync();

const SPLASH_DURATION_MS = 5_000;

function AppContent() {
  const branding = useMobileBranding();
  const segments = useSegments();
  const router=useRouter();
  const [pendingNotification,setPendingNotification]=useState<{key:string;target:string}|null>(null);
  const handledNotification=useRef<string|null>(null);
  const { loading, session } = useAuth();
  const { mode } = useAppearance();
  const [minimumSplashFinished, setMinimumSplashFinished] = useState(false);
  const [paintedSplashUrl, setPaintedSplashUrl] = useState<string | null>(null);
  const [initialRoutePainted, setInitialRoutePainted] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web') return;
    // All foreground app visitors count, including customers not yet signed in.
    // Backgrounded devices expire automatically from the 5-minute live window.
    const heartbeat = () => {
      if (AppState.currentState === 'active') void trackMobilePresence();
    };
    heartbeat();
    const interval = setInterval(heartbeat, 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') heartbeat();
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
    };
  }, []);

  useEffect(()=>{
    if(Platform.OS==='web')return;
    // Store the push tap until authentication is restored, including cold starts.
    // Never open notification URLs before validating the official B2B origin.
    const record=(response:Notifications.NotificationResponse)=>{
      const data=response.notification.request.content.data as Record<string,unknown> | undefined;
      const target=data?.targetPath;
      if(typeof target!=='string'||!resolveB2BNotificationLink(target))return;
      const key=response.notification.request.identifier;
      setPendingNotification(current=>current?.key===key?current:{key,target});
    };
    const subscription=Notifications.addNotificationResponseReceivedListener(record);
    void Notifications.getLastNotificationResponseAsync().then(response=>{if(response)record(response);})
      .catch(error=>console.warn('[push] Previous tap unavailable',error));
    return ()=>subscription.remove();
  },[]);

  // End any active geofence as soon as a customer signs out.
  useEffect(() => {
    if (!session?.user?.id) void stopStoreNearby();
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

  // Until the live image is painted, keep the first-frame iOS storyboard up.
  // It is generated by expo-splash-screen's native config plugin. The runtime
  // image always uses Admin's latest content and is shown only after load.
  // Request optional store-nearby consent on the FIRST USABLE SIGNED-IN
  // launch, not from the Notifications page and never behind the splash.
  // configureStoreNearby persists a per-customer decision and does not
  // re-prompt on subsequent launches. A refused permission never blocks login.
  // Apple controls the system permission prompts; iOS Always requires an
  // additional approval for notifications while the application is closed.
  // Android's Play release does not request marketing location permissions.
  // Sequentialize the native permission requests to avoid overlapping dialogs.
  useEffect(() => {
    if (showSplash || !initialRoutePainted || loading) return;
    let active = true;
    const userId = session?.user?.id ? String(session.user.id) : null;
    const timer = setTimeout(() => {
      void (async () => {
        if (Platform.OS === 'ios' && userId) {
          try { await configureStoreNearby(userId); }
          catch (error) { console.warn('[store-geofence] launch consent:',error); }
        }
        if (!active) return;
        if (userId) await registerB2BPush();
        if (!active) return;
        await requestMetaEventsConsentOnce();
        if (active) await initializeTikTokIfConsented();
      })().catch(error => console.warn('[startup] optional permissions:',error));
    }, 800);
    return () => { active = false; clearTimeout(timer); };
  }, [showSplash, initialRoutePainted, loading, session?.user?.id]);

  // On return from iOS Settings, restore geofencing only for customers
  // who have opted in. Never re-prompt those who declined.
  useEffect(() => {
    if (Platform.OS !== 'ios' || !session?.user?.id) return;
    const userId=String(session.user.id);
    const listener=AppState.addEventListener('change', state => {
      if (state === 'active') void isStoreNearbyEnabled(userId)
        .then(consented => consented ? configureStoreNearby(userId) : undefined)
        .catch(error=>console.warn('[store-geofence] resume:',error));
    });
    return ()=>listener.remove();
  }, [session?.user?.id]);

  useEffect(()=>{
    if(!pendingNotification||!session?.user?.id||session.user.mustChangePassword||
       loading||!routeReady||showSplash||!initialRoutePainted||Platform.OS==='web')return;
    if(handledNotification.current===pendingNotification.key){
      setPendingNotification(null);return;
    }
    handledNotification.current=pendingNotification.key;
    setPendingNotification(null);
    void openB2BNotificationTarget(router,pendingNotification.target)
      .catch(error=>console.warn('[push] Notification target could not open',error));
    void Notifications.clearLastNotificationResponseAsync().catch(()=>undefined);
  },[pendingNotification,session?.user?.id,session?.user?.mustChangePassword,loading,routeReady,showSplash,initialRoutePainted,router]);

  const runtimeSplashReady = !liveSplashUrl || paintedSplashUrl === liveSplashUrl;
  useEffect(() => {
    if (branding.loaded && (runtimeSplashReady || !showSplash) && initialRoutePainted) {
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
