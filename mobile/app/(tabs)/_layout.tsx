import { Tabs } from 'expo-router';
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

import { TabBar } from '@/components/navigation/TabBar';

export default function TabsLayout() {
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then(value => {
      if (mounted) setReduceMotion(value);
    }).catch(() => undefined);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => { mounted = false; subscription.remove(); };
  }, []);
  return (
    <Tabs
      tabBar={(props) => <TabBar {...props} reduceMotion={reduceMotion} />}
      screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'fade' }}
    >
      <Tabs.Screen name="index" options={{ title: 'Ana Sayfa' }} />
      <Tabs.Screen name="menu" options={{ title: 'Kategoriler' }} />
      <Tabs.Screen name="discover" options={{ title: 'Reels' }} />
      <Tabs.Screen name="shortages" options={{ title: 'Eksik Listem' }} />
      <Tabs.Screen name="orders" options={{ title: 'Siparişlerim' }} />
      <Tabs.Screen name="profile" options={{ title: 'Hesabım' }} />
      <Tabs.Screen name="products" options={{ href: null }} />
      <Tabs.Screen name="marketplace" options={{ href: null }} />
    </Tabs>
  );
}
