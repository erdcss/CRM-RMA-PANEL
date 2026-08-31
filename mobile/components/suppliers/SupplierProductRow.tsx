import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { getCategoryLabel, getStatusLabel } from '@/constants/statuses';
import type { SupplierItem } from '@/lib/api';

type SupplierProductRowProps = {
  item: SupplierItem;
  onOpen: () => void;
  trailing?: ReactNode;
};

export function SupplierProductRow({ item, onOpen, trailing }: SupplierProductRowProps) {
  const product = item.product;
  const ticket = product.ticket;
  const customer = ticket?.customer;

  return (
    <View style={styles.row}>
      <Pressable style={styles.main} onPress={onOpen}>
        <View style={styles.accent} />
        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {product.name || 'İsimsiz ürün'}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[product.stockCode, product.serialNumber ? `Seri: ${product.serialNumber}` : null]
              .filter(Boolean)
              .join(' · ') || 'Kod yok'}
          </Text>
          <View style={styles.tags}>
            <Text style={styles.tag}>{getStatusLabel(product.status)}</Text>
            <Text style={styles.tagMuted}>{getCategoryLabel(product.category)}</Text>
            {customer?.name ? <Text style={styles.tagMuted}>{customer.name}</Text> : null}
          </View>
        </View>
      </Pressable>

      <Pressable style={styles.openBtn} onPress={onOpen} accessibilityLabel="Detayı aç">
        <Ionicons name="open-outline" size={18} color={colors.primaryDark} />
      </Pressable>

      {trailing}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 72,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  main: {
    flex: 1,
    flexDirection: 'row',
    minWidth: 0,
  },
  accent: {
    width: 4,
    backgroundColor: colors.primary,
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    gap: 2,
  },
  name: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '700',
  },
  meta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 2,
  },
  tag: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    color: colors.primaryDark,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  tagMuted: {
    fontSize: 10,
    lineHeight: 13,
    color: colors.textMuted,
    backgroundColor: colors.surfaceSecondary,
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radius.full,
  },
  openBtn: {
    width: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderLeftWidth: 1,
    borderLeftColor: colors.borderLight,
    backgroundColor: colors.primarySoft,
  },
});
