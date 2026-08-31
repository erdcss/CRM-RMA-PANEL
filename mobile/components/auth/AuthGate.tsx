import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { colors } from '@/constants/theme';

function isAuthRoute(segment: string | undefined) {
  return segment === 'login' || segment === 'signup';
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const segments = useSegments();
  const router = useRouter();
  const currentRoute = segments[0];
  const onAuthScreen = isAuthRoute(currentRoute);

  useEffect(() => {
    if (loading) return;

    if (!session && !onAuthScreen) {
      router.replace('/login');
      return;
    }

    if (session && onAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [session, loading, onAuthScreen, router]);

  if (loading) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (!session && !onAuthScreen) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  if (session && onAuthScreen) {
    return (
      <View style={styles.loader}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export function RootStack() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
      <Stack.Screen name="signup" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
      <Stack.Screen name="record/[id]/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="record/[id]/product/[productId]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="customer/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="package/scan" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="package/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="supplier/[code]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="supplier/[code]/ship" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="supplier/product/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="settings/barcode" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
  },
});
