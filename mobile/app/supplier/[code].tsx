import { useMemo, useState } from 'react';
import { Alert, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { SupplierProductRow } from '@/components/suppliers/SupplierProductRow';
import { AppHeader } from '@/components/ui/AppHeader';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useSupplierItems } from '@/hooks/useRmaData';
import { previewSupplierPdf, shareSupplierPdf } from '@/lib/supplierPdf';

export default function SupplierDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const supplierCode = decodeURIComponent(String(params.code || ''));
  const { items, loading, refreshing, error, refresh } = useSupplierItems();
  const [sharing, setSharing] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const supplierItems = useMemo(
    () => items.filter((item) => item.supplierAccountCode === supplierCode),
    [items, supplierCode],
  );

  const supplierName = supplierItems[0]?.supplierName || 'Tedarikçi';
  const totalQuantity = supplierItems.reduce((sum, item) => sum + Number(item.product.quantity ?? 1), 0);
  const openCount = supplierItems.filter((item) => !['teslim_edildi', 'iptal'].includes(item.product.status)).length;

  const previewPdf = async () => {
    if (supplierItems.length === 0) return;
    setPreviewing(true);
    try {
      await previewSupplierPdf(supplierName, supplierCode, supplierItems);
    } catch (err) {
      Alert.alert('PDF görüntülenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setPreviewing(false);
    }
  };

  const exportPdf = async () => {
    if (supplierItems.length === 0) return;
    setSharing(true);
    try {
      await shareSupplierPdf(supplierName, supplierCode, supplierItems);
    } catch (err) {
      Alert.alert('PDF oluşturulamadı', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setSharing(false);
    }
  };

  const openShip = () => {
    router.push({
      pathname: '/supplier/[code]/ship',
      params: { code: supplierCode, name: supplierName },
    } as never);
  };

  if (loading) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader
        title={supplierName}
        subtitle={supplierCode ? `Cari: ${supplierCode}` : 'Tedarikçi detayı'}
        onBack={() => router.back()}
      />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          style={[styles.shipBtn, supplierItems.length === 0 && styles.disabled]}
          onPress={openShip}
          disabled={supplierItems.length === 0}
        >
          <Ionicons name="airplane-outline" size={22} color={colors.surface} />
          <View style={styles.shipBtnBody}>
            <Text style={styles.shipBtnTitle}>Ürünleri Sevk Et</Text>
            <Text style={styles.shipBtnHint}>Koli oluştur, barkod ata ve sevkiyata hazırla</Text>
          </View>
          <Ionicons name="chevron-forward" size={22} color={colors.surface} />
        </Pressable>

        <View style={styles.summaryRow}>
          <SummaryBox label="Ürün" value={String(supplierItems.length)} />
          <SummaryBox label="Adet" value={String(totalQuantity)} />
          <SummaryBox label="Açık" value={String(openCount)} />
        </View>

        <View style={styles.pdfActions}>
          <Pressable
            style={[styles.pdfAction, (previewing || supplierItems.length === 0) && styles.disabled]}
            onPress={previewPdf}
            disabled={previewing || supplierItems.length === 0}
          >
            <Ionicons name="eye-outline" size={19} color={colors.primaryDark} />
            <Text style={styles.pdfActionText}>{previewing ? 'Açılıyor…' : 'PDF Görüntüle'}</Text>
          </Pressable>
          <Pressable
            style={[styles.pdfAction, (sharing || supplierItems.length === 0) && styles.disabled]}
            onPress={exportPdf}
            disabled={sharing || supplierItems.length === 0}
          >
            <Ionicons name="share-outline" size={19} color={colors.primaryDark} />
            <Text style={styles.pdfActionText}>{sharing ? 'Hazırlanıyor…' : 'PDF Paylaş'}</Text>
          </Pressable>
        </View>

        {supplierItems.length === 0 ? (
          <EmptyState
            icon="cube-outline"
            title="Bu tedarikçide ürün yok"
            description="Ürün başka tedarikçiye taşınmış veya listeden çıkarılmış olabilir."
            actionLabel="Tedarikçi Listesine Dön"
            onAction={() => router.replace('/(tabs)/suppliers')}
          />
        ) : (
          <View style={styles.list}>
            <Text style={styles.listTitle}>Ürünler</Text>
            {supplierItems.map((item) => (
              <SupplierProductRow
                key={item.id}
                item={item}
                onOpen={() => router.push(`/supplier/product/${item.id}` as never)}
              />
            ))}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

function SummaryBox({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryBox}>
      <Text style={styles.summaryValue}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  error: { ...typography.caption, color: colors.danger },
  shipBtn: {
    minHeight: minTouchTarget + 8,
    borderRadius: radius.lg,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  shipBtnBody: { flex: 1, gap: 2 },
  shipBtnTitle: { ...typography.subtitle, color: colors.surface, fontWeight: '700' },
  shipBtnHint: { ...typography.caption, color: 'rgba(255,255,255,0.85)' },
  summaryRow: { flexDirection: 'row', gap: spacing.sm },
  summaryBox: {
    flex: 1,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    gap: 2,
  },
  summaryValue: { ...typography.title, color: colors.text },
  summaryLabel: { ...typography.caption, color: colors.textSecondary },
  pdfActions: { flexDirection: 'row', gap: spacing.sm },
  pdfAction: {
    flex: 1,
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  pdfActionText: { ...typography.caption, color: colors.primaryDark, fontWeight: '700' },
  list: { gap: spacing.sm },
  listTitle: { ...typography.bodyMedium, color: colors.textSecondary },
  disabled: { opacity: 0.6 },
});
