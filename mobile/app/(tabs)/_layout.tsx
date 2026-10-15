import { Tabs } from 'expo-router';

import { TabBar } from '@/components/navigation/TabBar';

export default function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa' }} />
      <Tabs.Screen name="menu" options={{ title: 'Kategoriler' }} />
      <Tabs.Screen name="discover" options={{ title: 'Reels' }} />
      <Tabs.Screen name="shortages" options={{ title: 'Eksik Listem' }} />
      <Tabs.Screen name="orders" options={{ title: 'Sepetim' }} />
      <Tabs.Screen name="profile" options={{ title: 'Hesabım' }} />
      <Tabs.Screen name="products" options={{ href: null }} />
    </Tabs>
  );
}
