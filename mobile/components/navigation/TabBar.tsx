import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

const TAB_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Ana Sayfa', icon: 'home-outline', activeIcon: 'home' },
  menu: { label: 'Menü', icon: 'grid-outline', activeIcon: 'grid' },
  discover: { label: 'Keşfet', icon: 'play-circle-outline', activeIcon: 'play-circle' },
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
      <View style={[styles.container, Platform.OS === 'ios' ? styles.iosGlass : styles.androidBar]}>
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
    minHeight: 64,
    paddingHorizontal: 6,
  },
  iosGlass: {
    marginHorizontal: 4,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.86)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.92)',
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
  iconWrap: {
    minWidth: 36,
    height: 30,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWrapActive: {
    backgroundColor: Platform.OS === 'ios' ? 'rgba(15,23,42,0.07)' : colors.surfaceSecondary,
  },
  label: {
    ...typography.caption,
    fontSize: 10,
    lineHeight: 13,
    color: colors.textMuted,
    fontWeight: '600',
  },
  labelActive: {
    color: colors.text,
    fontWeight: '700',
  },
});
