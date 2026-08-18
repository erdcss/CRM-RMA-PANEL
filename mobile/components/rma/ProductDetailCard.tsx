import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { ProductImagePicker } from '@/components/forms/ProductImagePicker';
import { RmaTimeline } from '@/components/rma/RmaTimeline';
import { Card } from '@/components/ui/Card';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getCategoryLabel, getStatusLabel, getStatusVariant } from '@/constants/statuses';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import type { RmaProduct } from '@/lib/api';

type ProductDetailCardProps = {
  product: RmaProduct;
  index: number;
  imageUri?: string | null;
  onUpdateStatus: () => void;
  onPhotoChange?: (uri: string | null) => void;
  uploadingPhoto?: boolean;
};

export function ProductDetailCard({
  product,
  index,
  imageUri,
  onUpdateStatus,
  onPhotoChange,
  uploadingPhoto,
}: ProductDetailCardProps) {
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
        <View style={styles.topRow}>
          {onPhotoChange ? (
            <ProductImagePicker compact imageUri={imageUri} onChange={onPhotoChange} />
          ) : imageUri ? (
            <Image source={{ uri: imageUri }} style={styles.thumb} contentFit="cover" />
          ) : null}

          <View style={styles.infoCol}>
        <InfoRow label="Ürün adı" value={product.name || '-'} />
        <InfoRow label="Stok kodu" value={product.stockCode || '-'} />
        <InfoRow label="Marka" value={product.brand || '-'} />
            <InfoRow label="Model" value={product.model || '-'} />
          </View>
        </View>

        <InfoRow label="Seri no" value={product.serialNumber || '-'} />
        <InfoRow label="Miktar" value={String(product.quantity ?? 1)} />
        <InfoRow label="Kategori" value={getCategoryLabel(product.category)} />
        <InfoRow label="Açıklama" value={product.description || '-'} />

        {onPhotoChange ? (
          <Text style={styles.photoHint}>
            {uploadingPhoto ? 'Görsel yükleniyor…' : 'Görsele dokunarak fotoğraf çekin veya ekleyin'}
          </Text>
        ) : null}

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
  topRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'flex-start',
  },
  infoCol: {
    flex: 1,
    gap: spacing.sm,
  },
  thumb: {
    width: 72,
    height: 72,
    borderRadius: radius.md,
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
  photoHint: {
    ...typography.caption,
    color: colors.textMuted,
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
