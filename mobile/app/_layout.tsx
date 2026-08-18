import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AuthGate, RootStack } from '@/components/auth/AuthGate';
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <AuthGate>
          <StatusBar style="dark" />
          <RootStack />
        </AuthGate>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
