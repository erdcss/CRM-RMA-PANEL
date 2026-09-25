import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getStatusLabel, getStatusVariant } from '@/constants/statuses';
import { colors, spacing, typography } from '@/constants/theme';
import type { RmaTicket } from '@/lib/api';
import { formatDateTime, formatRmaId } from '@/lib/format';

type RmaCardProps = {
  ticket: RmaTicket;
  onPress: () => void;
  compact?: boolean;
};

export function RmaCard({ ticket, onPress, compact }: RmaCardProps) {
  const visibleProducts = compact ? ticket.products.slice(0, 1) : ticket.products.slice(0, 3);
  const remaining = Math.max(0, ticket.products.length - visibleProducts.length);

  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.main}>
          <View style={styles.topRow}>
            <View style={styles.titleBody}>
              <Text style={styles.rmaId}>{formatRmaId(ticket)}</Text>
              <Text style={styles.customer}>{ticket.customer.name || 'Bilinmeyen müşteri'}</Text>
            </View>
            <Text style={styles.date}>{formatDateTime(ticket.createdAt)}</Text>
          </View>

          {visibleProducts.length === 0 ? (
            <View style={styles.productRow}>
              <Text style={styles.productName}>Ürün bilgisi yok</Text>
              <StatusBadge label="Beklemede" variant="new" />
            </View>
          ) : (
            <View style={styles.products}>
              {visibleProducts.map((product) => (
                <View key={product.id} style={styles.productRow}>
                  <View style={styles.productBody}>
                    <Text style={styles.productName} numberOfLines={1}>{product.name || 'Bilinmeyen ürün'}</Text>
                    {!compact ? (
                      <Text style={styles.productMeta} numberOfLines={1}>
                        {[product.stockCode, product.serialNumber ? `Seri: ${product.serialNumber}` : null]
                          .filter(Boolean)
                          .join(' · ') || 'Ürün bilgisi'}
                      </Text>
                    ) : null}
                  </View>
                  <StatusBadge
                    label={getStatusLabel(product.status)}
                    variant={getStatusVariant(product.status, product.category)}
                  />
                </View>
              ))}
            </View>
          )}

          {remaining > 0 ? <Text style={styles.moreText}>+{remaining} ürün daha</Text> : null}
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
    gap: spacing.md,
  },
  topRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  titleBody: {
    flex: 1,
    gap: 2,
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
  date: {
    ...typography.caption,
    color: colors.textMuted,
    textAlign: 'right',
    maxWidth: 110,
  },
  products: {
    gap: spacing.sm,
  },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.borderLight,
    paddingTop: spacing.sm,
  },
  productBody: {
    flex: 1,
    gap: 2,
  },
  productName: {
    ...typography.bodyMedium,
    color: colors.text,
    flex: 1,
  },
  productMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  moreText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
  },
});
