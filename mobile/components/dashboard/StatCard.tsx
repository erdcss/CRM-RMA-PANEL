import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { colors, spacing, typography } from '@/constants/theme';

type StatCardProps = {
  icon: keyof typeof Ionicons.glyphMap;
  value: number;
  label: string;
  tint?: string;
};

export function StatCard({ icon, value, label, tint = colors.primary }: StatCardProps) {
  return (
    <Card style={styles.card}>
      <View style={[styles.iconWrap, { backgroundColor: `${tint}14` }]}>
        <Ionicons name={icon} size={18} color={tint} />
      </View>
      <Text style={styles.value}>{value}</Text>
      <Text style={styles.label}>{label}</Text>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    minWidth: '47%',
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
