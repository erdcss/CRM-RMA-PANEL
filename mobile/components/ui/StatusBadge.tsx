import { StyleSheet, Text, View } from 'react-native';

import { StatusVariant } from '@/constants/statuses';
import { colors, radius, spacing, typography } from '@/constants/theme';

const variantStyles: Record<StatusVariant, { bg: string; text: string }> = {
  new: { bg: colors.primarySoft, text: colors.primaryDark },
  review: { bg: colors.warningSoft, text: colors.warning },
  service: { bg: colors.purpleSoft, text: colors.purple },
  exchange: { bg: colors.orangeSoft, text: colors.orange },
  return: { bg: colors.dangerSoft, text: colors.danger },
  completed: { bg: colors.successSoft, text: colors.success },
  cancelled: { bg: colors.surfaceSecondary, text: colors.textSecondary },
  default: { bg: colors.surfaceSecondary, text: colors.textSecondary },
};

type StatusBadgeProps = {
  label: string;
  variant?: StatusVariant;
};

export function StatusBadge({ label, variant = 'default' }: StatusBadgeProps) {
  const palette = variantStyles[variant];
  return (
    <View style={[styles.badge, { backgroundColor: palette.bg }]}>
      <Text style={[styles.text, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.full,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
  },
  text: {
    ...typography.caption,
    fontWeight: '600',
  },
});
