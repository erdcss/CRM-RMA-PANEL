import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getStatusLabel, getStatusVariant } from '@/constants/statuses';
import { colors, spacing, typography } from '@/constants/theme';
import type { RmaTicket } from '@/lib/api';
import { formatDateTime, formatProductSummary, formatRmaId } from '@/lib/format';

type RmaCardProps = {
  ticket: RmaTicket;
  onPress: () => void;
  compact?: boolean;
};

export function RmaCard({ ticket, onPress, compact }: RmaCardProps) {
  const primaryProduct = ticket.products[0];
  const summary = primaryProduct
    ? formatProductSummary(primaryProduct)
    : {
        title: 'Ürün bilgisi yok',
        subtitle: '-',
        serial: '-',
        statusLabel: 'Beklemede',
      };

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.main}>
          <Text style={styles.rmaId}>{formatRmaId(ticket)}</Text>
          <Text style={styles.customer}>{ticket.customer.name || 'Bilinmeyen müşteri'}</Text>
          <Text style={styles.product}>{summary.title}</Text>
          {!compact ? <Text style={styles.meta}>Seri No: {summary.serial}</Text> : null}
          <View style={styles.footer}>
            <StatusBadge
              label={primaryProduct ? getStatusLabel(primaryProduct.status) : 'Beklemede'}
              variant={primaryProduct ? getStatusVariant(primaryProduct.status, primaryProduct.category) : 'new'}
            />
            <Text style={styles.date}>{formatDateTime(ticket.createdAt)}</Text>
          </View>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.sm,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  main: {
    flex: 1,
    gap: 4,
  },
  rmaId: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  customer: {
    ...typography.subtitle,
    color: colors.text,
  },
  product: {
    ...typography.body,
    color: colors.textSecondary,
  },
  meta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  date: {
    ...typography.caption,
    color: colors.textMuted,
    flex: 1,
    textAlign: 'right',
  },
});
