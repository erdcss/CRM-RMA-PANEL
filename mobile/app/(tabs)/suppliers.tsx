import { useMemo, useState } from 'react';
import {
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { SupplierPickerModal } from '@/components/suppliers/SupplierPickerModal';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SearchInput } from '@/components/ui/SearchInput';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useSupplierItems, useTickets } from '@/hooks/useRmaData';
import { rmaApi, type CatalogCustomer, type RmaProduct } from '@/lib/api';

type PendingProduct = RmaProduct & {
  ticketId: number;
  ticketLabel: string;
  customerName: string;
};

export default function SuppliersScreen() {
  const router = useRouter();
  const { items, loading, refreshing, error, refresh } = useSupplierItems();
  const { tickets } = useTickets();
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<PendingProduct | null>(null);
  const [saving, setSaving] = useState(false);

  const groups = useMemo(() => {
    const q = query.trim().toLocaleLowerCase('tr-TR');
    const map = new Map<string, typeof items>();

    for (const item of items) {
      const searchable = [
        item.supplierAccountCode,
        item.supplierName,
        item.product.name,
        item.product.stockCode,
        item.product.ticket?.customer?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLocaleLowerCase('tr-TR');

      if (q && !searchable.includes(q)) continue;

      const key = `${item.supplierAccountCode}::${item.supplierName}`;
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }

    return Array.from(map.entries())
      .map(([key, groupItems]) => ({
        key,
        supplierAccountCode: groupItems[0]?.supplierAccountCode || '',
        supplierName: groupItems[0]?.supplierName || 'Tedarikçi',
        itemCount: groupItems.length,
        totalQuantity: groupItems.reduce((sum, item) => sum + Number(item.product.quantity ?? 1), 0),
        openCount: groupItems.filter((item) => !['teslim_edildi', 'iptal'].includes(item.product.status)).length,
      }))
      .sort((a, b) => a.supplierName.localeCompare(b.supplierName, 'tr'));
  }, [items, query]);

  const assignedProductIds = useMemo(() => new Set(items.map((item) => item.productId)), [items]);

  const availableProducts = useMemo<PendingProduct[]>(() => {
    const result: PendingProduct[] = [];
    for (const ticket of tickets) {
      for (const product of ticket.products) {
        if (assignedProductIds.has(product.id)) continue;
        result.push({
          ...product,
          ticketId: ticket.id,
          ticketLabel: ticket.receiptNumber || `RMA-${ticket.id}`,
          customerName: ticket.customer.name || 'Müşteri',
        });
      }
    }
    return result;
  }, [assignedProductIds, tickets]);

  const handleSupplierSelected = async (supplier: CatalogCustomer) => {
    if (!pendingProduct || saving) return;
    setSaving(true);
    try {
      await rmaApi.addSupplierItem({
        productId: pendingProduct.id,
        supplierAccountCode: supplier.accountCode,
        supplierName: supplier.accountName,
      });
      setPendingProduct(null);
      await refresh();
    } catch (err) {
      Alert.alert('Tedarikçi eklenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setSaving(false);
    }
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
      <AppHeader title="Tedarikçiler" subtitle="Tedarikçi bazlı RMA operasyonu" />

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="business-outline" size={24} color={colors.primaryDark} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroTitle}>Tedarikçi Listesi</Text>
            <Text style={styles.heroText}>
              Tedarikçiler alt alta listelenir. Bir firmaya dokunduğunuzda ürünleri ve tüm hareketleri ayrı sayfada açılır.
            </Text>
          </View>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <SearchInput value={query} onChangeText={setQuery} placeholder="Tedarikçi veya cari kodu ara" />
          </View>
          <Pressable style={styles.addButton} onPress={() => setAddOpen(true)}>
            <Ionicons name="add" size={24} color={colors.surface} />
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {groups.length === 0 ? (
          <EmptyState
            icon="business-outline"
            title="Tedarikçi bulunamadı"
            description="RMA ürününe tedarikçi atadığınızda firma burada listelenir."
            actionLabel="Mevcut Ürün Ekle"
            onAction={() => setAddOpen(true)}
          />
        ) : (
          <View style={styles.list}>
            {groups.map((group) => (
              <Card
                key={group.key}
                onPress={() =>
                  router.push(`/supplier/${encodeURIComponent(group.supplierAccountCode)}` as never)
                }
                style={styles.supplierCard}
              >
                <View style={styles.supplierRow}>
                  <View style={styles.avatar}>
                    <Ionicons name="business" size={21} color={colors.primaryDark} />
                  </View>

                  <View style={styles.supplierBody}>
                    <Text style={styles.supplierName}>{group.supplierName}</Text>
                    <Text style={styles.supplierCode}>Cari: {group.supplierAccountCode}</Text>
                    <View style={styles.metrics}>
                      <Text style={styles.metric}>{group.itemCount} ürün satırı</Text>
                      <View style={styles.dot} />
                      <Text style={styles.metric}>{group.totalQuantity} adet</Text>
                      <View style={styles.dot} />
                      <Text style={styles.metric}>{group.openCount} açık</Text>
                    </View>
                  </View>

                  <Ionicons name="chevron-forward" size={22} color={colors.textMuted} />
                </View>
              </Card>
            ))}
          </View>
        )}
      </ScrollView>

      <Modal visible={addOpen} transparent animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setAddOpen(false)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <View>
                  <Text style={styles.sheetTitle}>Tedarikçiye Ürün Ekle</Text>
                  <Text style={styles.sheetHint}>Henüz tedarikçi atanmamış RMA ürünlerinden seçim yapın.</Text>
                </View>
                <Pressable style={styles.closeButton} onPress={() => setAddOpen(false)}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>

              <ScrollView contentContainerStyle={styles.productList}>
                {availableProducts.length === 0 ? (
                  <Text style={styles.sheetHint}>Tedarikçiye atanabilecek ürün bulunmuyor.</Text>
                ) : (
                  availableProducts.map((product) => (
                    <Pressable
                      key={product.id}
                      style={styles.productOption}
                      onPress={() => {
                        setPendingProduct(product);
                        setAddOpen(false);
                      }}
                    >
                      <View style={styles.productOptionBody}>
                        <Text style={styles.productOptionTitle}>{product.name || 'İsimsiz ürün'}</Text>
                        <Text style={styles.productOptionMeta}>
                          {product.customerName} · {product.ticketLabel}
                        </Text>
                        <Text style={styles.productOptionMeta}>
                          {[product.stockCode, product.serialNumber].filter(Boolean).join(' · ') || 'Kod / seri bilgisi yok'}
                        </Text>
                      </View>
                      <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                    </Pressable>
                  ))
                )}
              </ScrollView>
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>

      <SupplierPickerModal
        visible={Boolean(pendingProduct)}
        title="Tedarikçi Seç"
        selectedAccountCode={undefined}
        onClose={() => setPendingProduct(null)}
        onSelect={handleSupplierSelected}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  hero: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
  },
  heroIcon: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: {
    flex: 1,
    gap: spacing.xs,
  },
  heroTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  heroText: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  searchWrap: {
    flex: 1,
  },
  addButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  list: {
    gap: spacing.md,
  },
  supplierCard: {
    padding: spacing.lg,
  },
  supplierRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  supplierBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  supplierName: {
    ...typography.bodyMedium,
    color: colors.text,
    fontWeight: '700',
  },
  supplierCode: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '600',
  },
  metrics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: spacing.xs,
  },
  metric: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  dot: {
    width: 3,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.textMuted,
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '82%',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginVertical: spacing.md,
  },
  sheetHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: spacing.md,
    marginBottom: spacing.md,
  },
  sheetTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  sheetHint: {
    ...typography.caption,
    color: colors.textSecondary,
    marginTop: 2,
  },
  closeButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  productList: {
    gap: spacing.sm,
    paddingBottom: spacing.xxl,
  },
  productOption: {
    minHeight: 68,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    backgroundColor: colors.surface,
  },
  productOptionBody: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  productOptionTitle: {
    ...typography.bodyMedium,
    color: colors.text,
  },
  productOptionMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
});
