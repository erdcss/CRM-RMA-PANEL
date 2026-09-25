import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

type QuickActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  badge?: string;
};

export function QuickAction({ icon, label, onPress, disabled, badge }: QuickActionProps) {
  return (
    <Card style={[styles.card, disabled ? styles.cardDisabled : undefined]} onPress={disabled ? undefined : onPress}>
      <View style={styles.headerRow}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={21} color={disabled ? colors.textMuted : colors.primary} />
        </View>
        <Ionicons name="chevron-forward" size={16} color={disabled ? colors.border : colors.textMuted} />
      </View>
      <Text style={[styles.label, disabled && styles.labelDisabled]} numberOfLines={2}>{label}</Text>
      {badge ? <Text style={styles.badge}>{badge}</Text> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: minTouchTarget + 46,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  cardDisabled: {
    opacity: 0.65,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '700',
  },
  labelDisabled: {
    color: colors.textMuted,
  },
  badge: {
    ...typography.caption,
    color: colors.warning,
    fontWeight: '600',
  },
});