import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppAlertBridge } from '@/components/ui/AppAlertBridge';
import { AuthGate, RootStack } from '@/components/auth/AuthGate';
import { AlertProvider } from '@/contexts/AlertContext';
import { AuthProvider } from '@/contexts/AuthContext';

export default function RootLayout() {
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
    </SafeAreaProvider>
  );
}
