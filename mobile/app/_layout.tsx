import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

export default function RootLayout() {
  return (
    <>
      <StatusBar style="auto" />
      <Stack
        screenOptions={{
          headerShadowVisible: false,
          headerBackTitle: 'Geri',
          contentStyle: { backgroundColor: '#f9fafb' },
        }}
      >
        <Stack.Screen name="index" options={{ title: 'RMA Merkezi' }} />
        <Stack.Screen name="ticket/[id]" options={{ title: 'RMA Detayı' }} />
      </Stack>
    </>
  );
}
