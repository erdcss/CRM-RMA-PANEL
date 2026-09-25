import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { colors, radius, spacing, typography } from '@/constants/theme';

type StatCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  tint?: string;
  onPress?: () => void;
};

export function StatCard({ icon, value, label, tint = colors.primary, onPress }: StatCardProps) {
  return (
    <Card style={styles.card} onPress={onPress}>
      <View style={styles.topRow}>
        <View style={[styles.iconWrap, { backgroundColor: `${tint}14` }]}>
          <Ionicons name={icon} size={20} color={tint} />
        </View>
        {onPress ? <Ionicons name="chevron-forward" size={17} color={colors.textMuted} /> : null}
      </View>

      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label} numberOfLines={2}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: 0,
    minHeight: 126,
    borderRadius: radius.lg,
    padding: spacing.md,
    gap: spacing.sm,
    justifyContent: 'space-between',
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconWrap: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  value: {
    ...typography.title,
    color: colors.text,
  },
  label: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    minHeight: 32,
  },
});