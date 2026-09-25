import { Tabs } from 'expo-router';

import { TabBar } from '@/components/navigation/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa' }} />
      <Tabs.Screen name="records" options={{ title: 'Kayıtlar' }} />
      <Tabs.Screen name="new-rma" options={{ title: 'Yeni RMA' }} />
      <Tabs.Screen name="suppliers" options={{ title: 'Tedarikçiler' }} />
      <Tabs.Screen name="products" options={{ title: 'Ürünler' }} />
      <Tabs.Screen name="customers" options={{ title: 'Müşteriler' }} />
      <Tabs.Screen name="profile" options={{ title: 'Hesabım' }} />
    </Tabs>
  );
}
