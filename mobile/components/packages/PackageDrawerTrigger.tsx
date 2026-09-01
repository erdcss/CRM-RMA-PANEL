import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, minTouchTarget, radius, shadows, spacing, typography } from '@/constants/theme';
import { usePackageDrawer } from '@/contexts/PackageDrawerContext';

export function PackageDrawerTrigger() {
  const insets = useSafeAreaInsets();
  const { open, toggleDrawer } = usePackageDrawer();

  return (
    <Pressable
      style={[styles.handle, { top: insets.top + 72 }]}
      onPress={toggleDrawer}
      accessibilityRole="button"
      accessibilityLabel="Hazırlanan koliler çekmecesi"
    >
      <View style={[styles.tab, open && styles.tabOpen]}>
        <Ionicons name="cube" size={18} color={open ? colors.surface : colors.primary} />
        <Text style={[styles.label, open && styles.labelOpen]}>Koliler</Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  handle: {
    position: 'absolute',
    right: 0,
    zIndex: 50,
  },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingLeft: spacing.md,
    paddingRight: spacing.sm,
    borderTopLeftRadius: radius.lg,
    borderBottomLeftRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderRightWidth: 0,
    borderColor: colors.border,
    minHeight: minTouchTarget,
    ...shadows.card,
  },
  tabOpen: {
    backgroundColor: colors.primary,
    borderColor: colors.primaryDark,
  },
  label: {
    ...typography.caption,
    fontWeight: '700',
    color: colors.primary,
  },
  labelOpen: {
    color: colors.surface,
  },
});