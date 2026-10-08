import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

const TAB_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Ana Sayfa', icon: 'home-outline', activeIcon: 'home' },
  menu: { label: 'Menü', icon: 'grid-outline', activeIcon: 'grid' },
  discover: { label: 'Keşfet', icon: 'play-circle-outline', activeIcon: 'play-circle' },
  orders: { label: 'Siparişler', icon: 'list-outline', activeIcon: 'list' },
  profile: { label: 'Hesabım', icon: 'person-outline', activeIcon: 'person' },
};

const VISIBLE_TABS = new Set(Object.keys(TAB_CONFIG));

export function TabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const routes = state.routes
    .map((route, index) => ({ route, index }))
    .filter(({ route }) => VISIBLE_TABS.has(route.name));

  return (
    <View
      pointerEvents="box-none"
      style={[
        styles.safeWrap,
        Platform.OS === 'ios'
          ? { paddingBottom: Math.max(insets.bottom, 8) }
          : { paddingBottom: Math.max(insets.bottom, 6) },
      ]}
    >
      <View style={styles.container}>
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
            <Pressable key={route.key} onPress={onPress} style={styles.tab}>
              <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
                <Ionicons
                  name={focused ? config.activeIcon : config.icon}
                  size={21}
                  color={focused ? colors.text : colors.textMuted}
                />
              </View>
              <Text style={[styles.label, focused && styles.labelActive]}>{config.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
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
    backgroundColor: 'transparent',
  },
  androidBar: {
    backgroundColor: 'transparent',
  },
  tab: {
    flex: 1,
    minHeight: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  iconWrap: {
    minWidth: 32,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: 'transparent',
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
