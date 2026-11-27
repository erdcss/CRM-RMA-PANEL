import { useEffect, useRef, useState } from 'react';
import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
  orders: { label: 'Sepet', icon: 'cart-outline', activeIcon: 'cart' },
  history: { label: 'Siparişlerim', icon: 'receipt-outline', activeIcon: 'receipt' },
  profile: { label: 'Hesabım', icon: 'person-outline', activeIcon: 'person' },
};

const VISIBLE_TABS = new Set(['index','menu','orders','history','profile']);

export function TabBar({ state, navigation, reduceMotion = false }: BottomTabBarProps & { reduceMotion?: boolean }) {
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
              reduceMotion={reduceMotion}
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
  config, focused, mode, palette, orderCount, onPress, reduceMotion,
}: {
  config: (typeof TAB_CONFIG)[string];
  focused: boolean;
  reduceMotion: boolean;
  mode: string;
  palette: ReturnType<typeof useAppearance>['palette'];
  orderCount: number;
  onPress: () => void;
}) {
  const focus = useRef(new Animated.Value(focused ? 1 : 0)).current;
  const press = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) {
      focus.setValue(focused ? 1 : 0);
      press.setValue(1);
      return;
    }
    const transition = Animated.timing(focus, {
      toValue: focused ? 1 : 0,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    transition.start();
    return () => transition.stop();
  }, [focus, focused, press, reduceMotion]);
  const scaleTo = (toValue: number) => {
    if (reduceMotion) return;
    Animated.spring(press, { toValue, stiffness: 300, damping: 26, mass: 0.8, useNativeDriver: true }).start();
  };
  const inactiveOpacity = focus.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
  const activeColor = mode === 'dark' ? '#FFCD00' : palette.text;
  return (
    <Pressable
      onPress={onPress}
      onPressIn={() => scaleTo(0.94)}
      onPressOut={() => scaleTo(1)}
      style={styles.tab}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={config.label + (orderCount ? `, ${orderCount} ürün` : '')}
    >
      <Animated.View style={{
        transform: [
          { translateY: focus.interpolate({ inputRange: [0, 1], outputRange: [0, -2] }) },
          { scale: Animated.multiply(press, focus.interpolate({ inputRange: [0, 1], outputRange: [1, 1.07] })) },
        ],
      }}>
        <View style={styles.iconWrap}>
          <Animated.View pointerEvents="none" style={[
            StyleSheet.absoluteFillObject,
            { borderRadius: radius.full, backgroundColor: mode === 'dark' ? '#383C40' : '#FFF1A8', opacity: focus },
          ]} />
          <Animated.View pointerEvents="none" style={{ opacity: inactiveOpacity }}>
            <Ionicons name={config.icon} size={21} color={palette.textSecondary} />
          </Animated.View>
          <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFillObject, styles.iconLayer, { opacity: focus }]}>
            <Ionicons name={config.activeIcon} size={21} color={mode === 'dark' ? '#FFCD00' : '#191919'} />
          </Animated.View>
          {orderCount > 0 ? (
            <View style={styles.counterBadge}>
              <Text style={styles.counterText}>{orderCount > 9 ? '+9' : orderCount}</Text>
            </View>
          ) : null}
        </View>
      </Animated.View>
      <Animated.View style={{ transform: [{ translateY: focus.interpolate({ inputRange: [0, 1], outputRange: [0, -1] }) }] }}>
        <Animated.Text style={[styles.label, { color: palette.textSecondary, opacity: inactiveOpacity }]}>{config.label}</Animated.Text>
        <Animated.Text style={[styles.label, styles.labelOverlay, { color: activeColor, opacity: focus }]}>{config.label}</Animated.Text>
      </Animated.View>
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
  iconLayer: { alignItems: 'center', justifyContent: 'center' },
  labelOverlay: { position: 'absolute', top: 0, left: 0, right: 0, textAlign: 'center' },
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
