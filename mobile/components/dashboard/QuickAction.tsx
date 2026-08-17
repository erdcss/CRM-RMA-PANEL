import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { colors, minTouchTarget, spacing, typography } from '@/constants/theme';

type QuickActionProps = {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  badge?: string;
};

export function QuickAction({ icon, label, onPress, disabled, badge }: QuickActionProps) {
  return (
    <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}>
      <Card style={styles.card}>
        <View style={styles.iconWrap}>
          <Ionicons name={icon} size={20} color={disabled ? colors.textMuted : colors.primary} />
        </View>
        <Text style={[styles.label, disabled && styles.labelDisabled]}>{label}</Text>
        {badge ? <Text style={styles.badge}>{badge}</Text> : null}
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '48%',
  },
  pressed: {
    opacity: 0.95,
  },
  card: {
    minHeight: minTouchTarget + 28,
    gap: spacing.sm,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    ...typography.bodyMedium,
    color: colors.text,
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
