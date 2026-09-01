import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { appAlert } from '@/lib/appAlert';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { StatusSheet } from '@/components/rma/StatusSheet';
import { SupplierPickerModal } from '@/components/suppliers/SupplierPickerModal';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { getCategoryLabel, getStatusLabel } from '@/constants/statuses';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useSupplierItems } from '@/hooks/useRmaData';
import { rmaApi, type CatalogCustomer, type SupplierItem } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { recordHref } from '@/lib/routes';

export default function SupplierProductDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const itemId = Number(id);
  const { items, loading, refreshing, refresh } = useSupplierItems();
  const [statusOpen, setStatusOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [saving, setSaving] = useState(false);

  const item = useMemo(() => items.find((row) => row.id === itemId) ?? null, [items, itemId]);
  const product = item?.product;
  const ticket = product?.ticket;

  const updateStatus = async (status: string) => {
    if (!item) return;
    setSaving(true);
    try {
      await rmaApi.updateProductStatus(item.productId, status);
      setStatusOpen(false);
      await refresh();
    } catch (err) {
      appAlert('Durum güncellenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setSaving(false);
    }
  };

  const moveSupplier = async (supplier: CatalogCustomer) => {
    if (!item) return;
    try {
      await rmaApi.updateSupplierItem(item.id, {
        supplierAccountCode: supplier.accountCode,
        supplierName: supplier.accountName,
      });
      setMoveOpen(false);
      await refresh();
      router.back();
    } catch (err) {
      appAlert('Tedarikçi değiştirilemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    }
  };

  const removeItem = () => {
    if (!item) return;
    appAlert('Listeden çıkar', 'Ürün tedarikçi listesinden çıkarılsın mı?', [
      { text: 'Vazgeç', style: 'cancel' },
      {
        text: 'Çıkar',
        style: 'destructive',
        onPress: async () => {
          try {
            await rmaApi.deleteSupplierItem(item.id);
            router.back();
          } catch (err) {
            appAlert('İşlem başarısız', err instanceof Error ? err.message : 'Bilinmeyen hata');
          }
        },
      },
    ]);
  };

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  if (!item || !product) {
    return (
      <Screen>
        <AppHeader title="Ürün Detayı" onBack={() => router.back()} />
        <View style={styles.missing}>
          <Text style={styles.missingText}>Ürün kaydı bulunamadı.</Text>
        </View>
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader title={product.name || 'Ürün Detayı'} subtitle={item.supplierName} onBack={() => router.back()} />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <Card style={styles.hero}>
          <View style={styles.heroTop}>
            <Text style={styles.productName}>{product.name}</Text>
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{getStatusLabel(product.status)}</Text>
            </View>
          </View>
          <Text style={styles.meta}>{[product.stockCode, product.serialNumber].filter(Boolean).join(' · ') || 'Kod yok'}</Text>
        </Card>

        <Card style={styles.info}>
          <Info label="Tedarikçi" value={item.supplierName} />
          <Info label="Cari" value={item.supplierAccountCode} />
          <Info label="Müşteri" value={ticket?.customer?.name || '-'} />
          <Info label="Geliş" value={formatDateTime(ticket?.createdAt || item.createdAt)} />
          <Info label="İşlem" value={getCategoryLabel(product.category)} />
          <Info label="RMA" value={ticket?.receiptNumber || (ticket?.id ? `RMA-${ticket.id}` : '-')} />
          <Info label="Adet" value={String(product.quantity ?? 1)} />
          {item.notes ? <Info label="Not" value={item.notes} /> : null}
          {product.description ? <Info label="Açıklama" value={product.description} /> : null}
        </Card>

        {(product.statusHistory ?? []).length > 0 ? (
          <Card style={styles.info}>
            <Text style={styles.sectionTitle}>Son Hareketler</Text>
            {product.statusHistory!.slice(0, 6).map((entry) => (
              <View key={entry.id} style={styles.historyRow}>
                <View style={styles.dot} />
                <View style={styles.historyBody}>
                  <Text style={styles.historyStatus}>{getStatusLabel(entry.status)}</Text>
                  <Text style={styles.historyMeta}>{formatDateTime(entry.createdAt)}</Text>
                </View>
              </View>
            ))}
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Action icon="sync-outline" label="Durum Güncelle" onPress={() => setStatusOpen(true)} />
          <Action icon="swap-horizontal-outline" label="Tedarikçi Değiştir" onPress={() => setMoveOpen(true)} />
          {ticket?.id ? (
            <Action icon="open-outline" label="RMA Kaydına Git" onPress={() => router.push(recordHref(ticket.id))} />
          ) : null}
          <Action icon="trash-outline" label="Listeden Çıkar" danger onPress={removeItem} />
        </View>
      </ScrollView>

      <StatusSheet
        visible={statusOpen}
        currentStatus={product.status}
        loading={saving}
        onClose={() => setStatusOpen(false)}
        onSelect={updateStatus}
      />

      <SupplierPickerModal
        visible={moveOpen}
        title="Tedarikçi Değiştir"
        selectedAccountCode={item.supplierAccountCode}
        onClose={() => setMoveOpen(false)}
        onSelect={moveSupplier}
      />
    </Screen>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function Action({
  icon,
  label,
  onPress,
  danger,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  danger?: boolean;
}) {
  return (
    <Pressable style={[styles.actionBtn, danger && styles.actionDanger]} onPress={onPress}>
      <Ionicons name={icon} size={18} color={danger ? colors.danger : colors.primaryDark} />
      <Text style={[styles.actionText, danger && styles.actionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  missing: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  missingText: { ...typography.body, color: colors.textMuted },
  hero: { gap: spacing.sm },
  heroTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  productName: { ...typography.title, color: colors.text, flex: 1 },
  badge: {
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
  },
  badgeText: { fontSize: 11, fontWeight: '700', color: colors.primaryDark },
  meta: { ...typography.caption, color: colors.textSecondary },
  info: { gap: spacing.sm },
  sectionTitle: { ...typography.bodyMedium, color: colors.text, marginBottom: spacing.xs },
  infoRow: { gap: 2 },
  infoLabel: { ...typography.caption, color: colors.textMuted },
  infoValue: { ...typography.body, color: colors.text, fontWeight: '600' },
  historyRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary, marginTop: 5 },
  historyBody: { flex: 1 },
  historyStatus: { ...typography.caption, fontWeight: '700', color: colors.text },
  historyMeta: { ...typography.caption, color: colors.textMuted },
  actions: { gap: spacing.sm },
  actionBtn: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  actionDanger: { borderColor: colors.dangerSoft, backgroundColor: colors.dangerSoft },
  actionText: { ...typography.bodyMedium, color: colors.primaryDark, fontWeight: '700' },
  actionTextDanger: { color: colors.danger },
});
