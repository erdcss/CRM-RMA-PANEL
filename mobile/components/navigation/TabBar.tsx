import { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, minTouchTarget, radius, shadows, spacing, typography } from '@/constants/theme';

const TAB_CONFIG: Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Ana Sayfa', icon: 'home-outline' },
  records: { label: 'Kayıtlar', icon: 'list-outline' },
  'new-rma': { label: 'Yeni RMA', icon: 'add' },
  suppliers: { label: 'Tedarikçi', icon: 'business-outline' },
  products: { label: 'Ürünler', icon: 'cube-outline' },
  customers: { label: 'Müşteriler', icon: 'people-outline' },
  profile: { label: 'Hesabım', icon: 'person-outline' },
};

export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, spacing.sm) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        const config = TAB_CONFIG[route.name] ?? { label: route.name, icon: 'ellipse-outline' as const };
        const onPress = () => {
          const event = navigation.emit({
            type: 'tabPress',
            target: route.key,
            canPreventDefault: true,
          });
          if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
        };

        if (route.name === 'new-rma') {
          return (
            <Pressable key={route.key} onPress={onPress} style={styles.centerWrap}>
              <View style={[styles.centerButton, focused && styles.centerButtonActive]}>
                <Ionicons name="add" size={25} color={colors.surface} />
              </View>
              <Text numberOfLines={1} style={[styles.centerLabel, focused && styles.labelActive]}>
                {config.label}
              </Text>
            </Pressable>
          );
        }

        return (
          <Pressable key={route.key} onPress={onPress} style={styles.tab}>
            <Ionicons
              name={config.icon}
              size={20}
              color={focused ? colors.primary : colors.textMuted}
            />
            <Text numberOfLines={1} style={[styles.label, focused && styles.labelActive]}>
              {config.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingTop: spacing.sm,
    paddingHorizontal: 2,
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    ...shadows.tab,
  },
  tab: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: minTouchTarget,
    gap: 2,
    paddingHorizontal: 0,
  },
  label: {
    ...typography.caption,
    fontSize: 9,
    lineHeight: 11,
    color: colors.textMuted,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelActive: {
    color: colors.primary,
  },
  centerWrap: {
    flex: 1,
    alignItems: 'center',
    marginTop: -17,
    gap: 3,
    paddingHorizontal: 0,
  },
  centerButton: {
    width: 50,
    height: 50,
    borderRadius: radius.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
    borderColor: colors.surface,
  },
  centerButtonActive: {
    backgroundColor: colors.primaryDark,
  },
  centerLabel: {
    ...typography.caption,
    fontSize: 9,
    lineHeight: 11,
    color: colors.textMuted,
    fontWeight: '700',
    textAlign: 'center',
  },
});
