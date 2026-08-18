import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/constants/theme';

type StatCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  tint?: string;
  onPress?: () => void;
};

export function StatCard({ icon, value, label, tint = colors.primary, onPress }: StatCardProps) {
  return (
    <Pressable
      style={({ pressed }) => [styles.wrap, pressed && onPress ? styles.pressed : null]}
      onPress={onPress}
      disabled={!onPress}
    >
      <Card style={styles.card}>
        <View style={[styles.iconWrap, { backgroundColor: `${tint}14` }]}>
          <Ionicons name={icon} size={18} color={tint} />
        </View>
        <View style={styles.valueRow}>
          <Text style={styles.value}>{value}</Text>
          {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textMuted} /> : null}
        </View>
        <Text style={styles.label}>{label}</Text>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flex: 1,
    minWidth: '47%',
  },
  pressed: {
    opacity: 0.72,
  },
  card: {
    flex: 1,
    gap: spacing.sm,
    padding: spacing.lg,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  valueRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  value: {
    ...typography.title,
    color: colors.text,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '600',
  },
});
