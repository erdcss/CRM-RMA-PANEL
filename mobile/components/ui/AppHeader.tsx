import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

type AppHeaderProps = {
  title: string;
  subtitle?: string;
  showActions?: boolean;
  notificationCount?: number;
  avatarLabel?: string;
  onBack?: () => void;
  rightSlot?: ReactNode;
};

export function AppHeader({
  title,
  subtitle,
  showActions = false,
  notificationCount = 0,
  avatarLabel = 'RMA',
  onBack,
  rightSlot,
}: AppHeaderProps) {
  return (
    <View style={styles.container}>
      <View style={styles.left}>
        {onBack ? (
          <Pressable onPress={onBack} style={styles.backButton} hitSlop={8}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
        ) : null}
        <View style={styles.titles}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
        </View>
      </View>

      {rightSlot ?? (showActions ? (
        <View style={styles.actions}>
          <Pressable style={styles.iconButton}>
            <Ionicons name="notifications-outline" size={22} color={colors.text} />
            {notificationCount > 0 ? <View style={styles.dot} /> : null}
          </Pressable>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{avatarLabel.slice(0, 2).toUpperCase()}</Text>
          </View>
        </View>
      ) : null)}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
    backgroundColor: colors.background,
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  backButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: -spacing.sm,
  },
  titles: {
    flex: 1,
    gap: 2,
  },
  title: {
    ...typography.title,
    color: colors.text,
  },
  subtitle: {
    ...typography.body,
    color: colors.textSecondary,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  iconButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.danger,
    borderWidth: 1.5,
    borderColor: colors.surface,
  },
  avatar: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.full,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.primary,
  },
  avatarText: {
    color: colors.surface,
    fontWeight: '700',
    fontSize: 13,
  },
});
