import { useEffect, useRef, useState } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useAppearance } from '@/contexts/AppearanceContext';
import { getOrderList, subscribeOrderList } from '@/lib/b2b-order-list';

const TAB_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Ana Sayfa', icon: 'home-outline', activeIcon: 'home' },
  menu: { label: 'Kategoriler', icon: 'grid-outline', activeIcon: 'grid' },
  discover: { label: 'Reels', icon: 'play-circle-outline', activeIcon: 'play-circle' },
  shortages: { label: 'Eksik Listem', icon: 'clipboard-outline', activeIcon: 'clipboard' },
  orders: { label: 'Siparişlerim', icon: 'cart-outline', activeIcon: 'cart' },
  profile: { label: 'Hesabım', icon: 'person-outline', activeIcon: 'person' },
};

const VISIBLE_TABS = new Set(Object.keys(TAB_CONFIG));

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const { palette, mode } = useAppearance();
  const [orderCount, setOrderCount] = useState(0);
  useEffect(() => {
    let active = true;
    const reload = () => { void getOrderList().then(items => {
      if (active) setOrderCount(items.length);
    }); };
    reload();
    const unsubscribe = subscribeOrderList(reload);
    return () => { active = false; unsubscribe(); };
  }, []);
  const routes = state.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => VISIBLE_TABS.has(route.name));

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.safeWrap,
        { backgroundColor: palette.background },
        Platform.OS === 'ios'
          ? { paddingBottom: Math.max(insets.bottom, 8) }
          : { paddingBottom: Math.max(insets.bottom, 6) },
      ]}
    >
      <View
        style={[
          styles.container,
          Platform.OS === 'ios' ? styles.iosGlass : styles.androidBar,
          { backgroundColor: palette.background, borderColor: palette.border, shadowOpacity: 0 },
        ]}
      >
        {routes.map(({ route, index }) => {
          const focused = state.index === index;
          const config = TAB_CONFIG[route.name];

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });
            if (!focused && !event.defaultPrevented) {
              navigation.navigate(route.name);
            }
          };

          return (
            <TabButton
              key={route.key}
              config={config}
              focused={focused}
              mode={mode}
              palette={palette}
              orderCount={route.name === 'orders' ? orderCount : 0}
              onPress={onPress}
            />
          );
        })}
      </View>
    </View>
  );
}

/**
 * Native spring mirrors the web nav: active yellow capsule, a lifted icon,
 * label easing and touch compression. Native driver keeps transitions fluid.
 */
function TabButton({
  config, focused, mode, palette, orderCount, onPress,
}: {
  config: (typeof TAB_CONFIG)[string];
  focused: boolean;
  mode: string;
  palette: ReturnType<typeof useAppearance>['palette'];
  orderCount: number;
  onPress: () => void;
}) {
  const focus = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    Animated.spring(focus, {
      toValue: focused ? 1 : 0,
      stiffness: 470,
      damping: 35,
      mass: 1,
      useNativeDriver: true,
    }).start();
  }, [focus, focused]);
  const scaleTo = (toValue: number) => {
    Animated.spring(press, { toValue, stiffness: 420, damping: 27, useNativeDriver: true }).start();
  };
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => scaleTo(0.86)}
      onPressOut={() => scaleTo(1)}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={config.label + (orderCount ? `, ${orderCount} ürün` : '')}
    >
      <Animated.View style={{
        transform: [
          { translateY: focus.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
          { scale: Animated.multiply(press, focus.interpolate({ inputRange: [0, 1], outputRange: [1, 1.04] })) },
        ],
      }}>
        <View style={styles.iconWrap}>
          <Animated.View pointerEvents="none" style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: radius.full, backgroundColor: mode === 'dark' ? '#383C40' : '#FFF1A8', opacity: focus },
          ]} />
          <Ionicons name={focused ? config.activeIcon : config.icon} size={21}
            color={focused ? (mode === 'dark' ? '#FFCD00' : '#191919') : palette.textSecondary} />
          {orderCount > 0 ? (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>{orderCount > 9 ? '+9' : orderCount}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
      <Animated.Text style={[
        styles.label,
        focused && styles.labelActive,
        { color: focused ? (mode === 'dark' ? '#FFCD00' : palette.text) : palette.textSecondary,
          opacity: focus.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }),
          transform: [{ translateY: focus.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) }],
        },
      ]}>{config.label}</Animated.Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeWrap: {
    backgroundColor: 'transparent',
    paddingHorizontal: Platform.OS === 'ios' ? 12 : 0,
    paddingTop: 6,
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 66,
    paddingHorizontal: 4,
  },
  iosGlass: {
    marginHorizontal: 4,
    borderRadius: 24,
    backgroundColor: 'transparent',
    borderWidth: 1,
    borderColor: 'transparent',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.14,
    shadowRadius: 24,
  },
  androidBar: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    elevation: 10,
  },
  tab: {
    flex: 1,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  counterBadge: {
    position: 'absolute',
    top: -7,
    right: -13,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 3,
    borderRadius: 10,
    backgroundColor: '#E11D48',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  counterText: { fontSize: 10, lineHeight: 12, fontWeight: '900', color: '#FFFFFF' },
  iconWrap: {
    minWidth: 32,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor:
      Platform.OS === 'ios'
        ? 'rgba(15,23,42,0.07)'
        : colors.surfaceSecondary,
  },
  label: {
    ...typography.caption,
    fontSize: 9,
    lineHeight: 12,
    color: colors.textMuted,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.text,
    fontWeight: '700',
  },
});
