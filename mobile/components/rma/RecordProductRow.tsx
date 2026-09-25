import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';

import { StatusBadge } from '@/components/ui/StatusBadge';
import { getCategoryLabel, getStatusLabel, getStatusVariant } from '@/constants/statuses';
import { colors, radius, spacing, typography } from '@/constants/theme';
import type { RmaProduct } from '@/lib/api';

type RecordProductRowProps = {
  product: RmaProduct;
  index: number;
  imageUri?: string | null;
  onOpen: () => void;
  trailing?: ReactNode;
};

export function RecordProductRow({ product, index, imageUri, onOpen, trailing }: RecordProductRowProps) {
  return (
    <View style={styles.row}>
      <Pressable style={styles.main} onPress={onOpen}>
        <View style={styles.accent} />
        {imageUri ? (
          <Image source={{ uri: imageUri }} style={styles.thumb} contentFit="cover" />
        ) : (
          <View style={styles.thumbPlaceholder}>
            <Ionicons name="camera-outline" size={18} color={colors.textMuted} />
          </View>
        )}
        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text style={styles.indexLabel}>ÜRÜN {index + 1}</Text>
            <StatusBadge
              label={getStatusLabel(product.status)}
              variant={getStatusVariant(product.status, product.category)}
            />
          </View>
          <Text style={styles.name} numberOfLines={1}>
            {product.name || 'İsimsiz ürün'}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {[product.stockCode, product.serialNumber ? `Seri: ${product.serialNumber}` : null]
              .filter(Boolean)
              .join(' · ') || 'Kod / seri yok'}
          </Text>
          <Text style={styles.category}>{getCategoryLabel(product.category)}</Text>
        </View>
      </Pressable>

      <Pressable style={styles.openBtn} onPress={onOpen} accessibilityLabel="Ürün detayını aç">
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
    minHeight: 84,
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
    alignItems: 'stretch',
  },
  accent: {
    width: 4,
    backgroundColor: colors.primary,
  },
  thumb: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    marginVertical: spacing.sm,
    marginLeft: spacing.sm,
    alignSelf: 'center',
  },
  thumbPlaceholder: {
    width: 56,
    height: 56,
    borderRadius: radius.sm,
    marginVertical: spacing.sm,
    marginLeft: spacing.sm,
    alignSelf: 'center',
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: {
    flex: 1,
    minWidth: 0,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    justifyContent: 'center',
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.xs,
  },
  indexLabel: {
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '700',
    color: colors.textMuted,
    letterSpacing: 0.4,
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
  category: {
    ...typography.caption,
    color: colors.textMuted,
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
