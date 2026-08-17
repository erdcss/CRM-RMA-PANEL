import { Pressable, StyleSheet, Text, View } from 'react-native';

import { RmaTimeline } from '@/components/rma/RmaTimeline';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getCategoryLabel, getStatusLabel, getStatusVariant } from '@/constants/statuses';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import type { RmaProduct } from '@/lib/api';

type ProductDetailCardProps = {
  product: RmaProduct;
  index: number;
  onUpdateStatus: () => void;
};

export function ProductDetailCard({ product, index, onUpdateStatus }: ProductDetailCardProps) {
  return (
    <View style={styles.wrap}>
      <View style={styles.headerRow}>
        <Text style={styles.title}>ÜRÜN {index + 1}</Text>
        <StatusBadge
          label={getStatusLabel(product.status)}
          variant={getStatusVariant(product.status, product.category)}
        />
      </View>

      <Card style={styles.card}>
        <InfoRow label="Ürün adı" value={product.name || '-'} />
        <InfoRow label="Marka" value={product.brand || '-'} />
        <InfoRow label="Model" value={product.model || '-'} />
        <InfoRow label="Seri no" value={product.serialNumber || '-'} />
        <InfoRow label="Miktar" value={String(product.quantity ?? 1)} />
        <InfoRow label="Kategori" value={getCategoryLabel(product.category)} />
        <InfoRow label="Açıklama" value={product.description || '-'} />

        <Pressable style={styles.updateButton} onPress={onUpdateStatus}>
          <Text style={styles.updateButtonText}>Bu Ürünün Durumunu Güncelle</Text>
        </Pressable>
      </Card>

      <Card style={styles.timelineCard}>
        <Text style={styles.timelineTitle}>Durum Geçmişi</Text>
        <RmaTimeline history={product.statusHistory ?? []} />
      </Card>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
    letterSpacing: 0.6,
  },
  card: {
    gap: spacing.md,
  },
  timelineCard: {
    gap: spacing.md,
  },
  timelineTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  infoRow: {
    gap: 2,
  },
  infoLabel: {
    ...typography.caption,
    color: colors.textMuted,
  },
  infoValue: {
    ...typography.body,
    color: colors.text,
  },
  updateButton: {
    marginTop: spacing.sm,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  updateButtonText: {
    ...typography.bodyMedium,
    color: colors.primaryDark,
  },
});
