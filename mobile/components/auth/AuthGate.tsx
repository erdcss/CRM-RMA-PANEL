import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { useAppearance } from '@/contexts/AppearanceContext';
import { colors } from '@/constants/theme';

function isAuthRoute(segment: string | undefined) {
  return segment === 'login' || segment === 'signup' || segment === 'forgot-password';
}

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const { palette } = useAppearance();
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

    if (session?.user?.mustChangePassword && !onAuthScreen) {
      router.replace('/login');
      return;
    }

    if (session && !session.user.mustChangePassword && onAuthScreen) {
      router.replace('/(tabs)');
    }
  }, [session, loading, onAuthScreen, router]);

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: palette.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  return <>{children}</>;
}

export function RootStack() {
  const { palette } = useAppearance();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: palette.background },
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="my-orders" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="account/[section]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="forgot-password" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="login" options={{ animation: 'fade' }} />
      <Stack.Screen name="signup" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="product" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="checkout" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="payment-card" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="payment-result" options={{ animation: 'fade' }} />
      <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
    </Stack>
  );
}

const styles = StyleSheet.create({
  loader: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
