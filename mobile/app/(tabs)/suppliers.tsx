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

import { FormField } from '@/components/forms/FormField';
import { StatusSheet } from '@/components/rma/StatusSheet';
import { SupplierPickerModal } from '@/components/suppliers/SupplierPickerModal';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { SearchInput } from '@/components/ui/SearchInput';
import { getCategoryLabel, getStatusLabel } from '@/constants/statuses';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useSupplierItems, useTickets } from '@/hooks/useRmaData';
import { rmaApi, type CatalogCustomer, type RmaProduct, type SupplierItem } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { recordHref } from '@/lib/routes';
import { shareSupplierPdf } from '@/lib/supplierPdf';

type EditDraft = {
  name: string;
  stockCode: string;
  serialNumber: string;
  brand: string;
  model: string;
  quantity: string;
  description: string;
  notes: string;
};

type PendingProduct = RmaProduct & {
  ticketId: number;
  ticketLabel: string;
  customerName: string;
};

function editDraftFromItem(item: SupplierItem): EditDraft {
  return {
    name: item.product.name || '',
    stockCode: item.product.stockCode || '',
    serialNumber: item.product.serialNumber || '',
    brand: item.product.brand || '',
    model: item.product.model || '',
    quantity: String(item.product.quantity ?? 1),
    description: item.product.description || '',
    notes: item.notes || '',
  };
}

export default function SuppliersScreen() {
  const router = useRouter();
  const { items, loading, refreshing, error, refresh } = useSupplierItems();
  const { tickets } = useTickets();
  const [query, setQuery] = useState('');
  const [statusItem, setStatusItem] = useState<SupplierItem | null>(null);
  const [statusOpen, setStatusOpen] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [sharingKey, setSharingKey] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [pendingProduct, setPendingProduct] = useState<PendingProduct | null>(null);
  const [supplierPickerMode, setSupplierPickerMode] = useState<'add' | 'move' | null>(null);
  const [moveItem, setMoveItem] = useState<SupplierItem | null>(null);

  const [editItem, setEditItem] = useState<SupplierItem | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);

  const q = query.trim().toLocaleLowerCase('tr-TR');
  const filteredItems = useMemo(
    () =>
      items.filter((item) => {
        if (!q) return true;
        const product = item.product;
        const customer = product.ticket?.customer;
        return [
          item.supplierAccountCode,
          item.supplierName,
          product.stockCode,
          product.name,
          product.serialNumber,
          customer?.name,
          product.ticket?.receiptNumber,
          getStatusLabel(product.status),
        ]
          .filter(Boolean)
          .join(' ')
          .toLocaleLowerCase('tr-TR')
          .includes(q);
      }),
    [items, q],
  );

  const groups = useMemo(() => {
    const map = new Map<string, SupplierItem[]>();
    for (const item of filteredItems) {
      const key = `${item.supplierAccountCode}::${item.supplierName}`;
      const current = map.get(key) ?? [];
      current.push(item);
      map.set(key, current);
    }
    return Array.from(map.entries()).map(([key, groupItems]) => ({
      key,
      supplierAccountCode: groupItems[0]?.supplierAccountCode || '',
      supplierName: groupItems[0]?.supplierName || 'Tedarikçi',
      items: groupItems,
      totalQuantity: groupItems.reduce((sum, item) => sum + Number(item.product.quantity ?? 1), 0),
    }));
  }, [filteredItems]);

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

  const updateStatus = async (status: string) => {
    if (!statusItem) return;
    setSavingStatus(true);
    try {
      // The supplier screen updates the same products.status row used by RMA records.
      await rmaApi.updateProductStatus(statusItem.productId, status);
      setStatusOpen(false);
      setStatusItem(null);
      await refresh();
    } catch (err) {
      Alert.alert('Durum güncellenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setSavingStatus(false);
    }
  };

  const exportGroup = async (supplierName: string, supplierCode: string, groupItems: SupplierItem[]) => {
    const key = `${supplierCode}::${supplierName}`;
    setSharingKey(key);
    try {
      await shareSupplierPdf(supplierName, supplierCode, groupItems);
    } catch (err) {
      Alert.alert('PDF oluşturulamadı', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setSharingKey(null);
    }
  };

  const removeSupplierItem = (item: SupplierItem) => {
    Alert.alert(
      'Tedarikçi listesinden çıkar',
      `${item.product.name || 'Ürün'} tedarikçi listesinden çıkarılsın mı? RMA kaydı silinmez.`,
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Çıkar',
          style: 'destructive',
          onPress: async () => {
            try {
              await rmaApi.deleteSupplierItem(item.id);
              await refresh();
            } catch (err) {
              Alert.alert('Ürün çıkarılamadı', err instanceof Error ? err.message : 'Bilinmeyen hata');
            }
          },
        },
      ],
    );
  };

  const openEdit = (item: SupplierItem) => {
    setEditItem(item);
    setEditDraft(editDraftFromItem(item));
  };

  const saveEdit = async () => {
    if (!editItem || !editDraft) return;
    const quantity = Math.max(1, Number(editDraft.quantity) || 1);
    if (!editDraft.name.trim()) {
      Alert.alert('Eksik bilgi', 'Ürün adı boş bırakılamaz.');
      return;
    }

    setSavingEdit(true);
    try {
      await Promise.all([
        rmaApi.updateProduct(editItem.productId, {
          name: editDraft.name.trim(),
          stockCode: editDraft.stockCode.trim() || null,
          serialNumber: editDraft.serialNumber.trim() || null,
          brand: editDraft.brand.trim() || null,
          model: editDraft.model.trim() || null,
          quantity,
          description: editDraft.description.trim() || null,
        }),
        rmaApi.updateSupplierItem(editItem.id, {
          notes: editDraft.notes.trim() || null,
        }),
      ]);
      setEditItem(null);
      setEditDraft(null);
      await refresh();
    } catch (err) {
      Alert.alert('Değişiklikler kaydedilemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSupplierSelected = async (supplier: CatalogCustomer) => {
    if (supplierPickerMode === 'add' && pendingProduct) {
      try {
        await rmaApi.addSupplierItem({
          productId: pendingProduct.id,
          supplierAccountCode: supplier.accountCode,
          supplierName: supplier.accountName,
        });
        setPendingProduct(null);
        setSupplierPickerMode(null);
        await refresh();
      } catch (err) {
        Alert.alert('Tedarikçi eklenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
      }
      return;
    }

    if (supplierPickerMode === 'move' && moveItem) {
      try {
        await rmaApi.updateSupplierItem(moveItem.id, {
          supplierAccountCode: supplier.accountCode,
          supplierName: supplier.accountName,
        });
        setMoveItem(null);
        setSupplierPickerMode(null);
        await refresh();
      } catch (err) {
        Alert.alert('Tedarikçi değiştirilemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
      }
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
      <AppHeader title="Tedarikçiler" subtitle="RMA tedarikçi operasyonu" />
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
      >
        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Ionicons name="business-outline" size={24} color={colors.primaryDark} />
          </View>
          <View style={styles.heroBody}>
            <Text style={styles.heroTitle}>Tedarikçiye Gidecek Ürünler</Text>
            <Text style={styles.heroText}>
              Buradaki durum güncellemesi doğrudan aynı RMA ürününe yazılır; müşteri kayıtlarında da aynı anda görünür.
            </Text>
          </View>
        </View>

        <View style={styles.toolbar}>
          <View style={styles.searchWrap}>
            <SearchInput
              value={query}
              onChangeText={setQuery}
              placeholder="Tedarikçi, ürün, müşteri veya seri no ara"
            />
          </View>
          <Pressable style={styles.addButton} onPress={() => setAddOpen(true)}>
            <Ionicons name="add" size={22} color={colors.surface} />
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {groups.length === 0 ? (
          <EmptyState
            icon="business-outline"
            title="Tedarikçi listesi boş"
            description="Yeni RMA oluştururken ürünün tedarikçisini seçebilir veya mevcut bir RMA ürününü buradan ekleyebilirsiniz."
            actionLabel="Mevcut Ürün Ekle"
            onAction={() => setAddOpen(true)}
          />
        ) : (
          groups.map((group) => (
            <Card key={group.key} style={styles.groupCard}>
              <View style={styles.groupHeader}>
                <View style={styles.groupTitleWrap}>
                  <View style={styles.supplierAvatar}>
                    <Ionicons name="business" size={20} color={colors.primaryDark} />
                  </View>
                  <View style={styles.groupTitleBody}>
                    <Text style={styles.groupTitle}>{group.supplierName}</Text>
                    <Text style={styles.groupMeta}>
                      {group.supplierAccountCode} · {group.items.length} satır · {group.totalQuantity} adet
                    </Text>
                  </View>
                </View>
                <Pressable
                  style={styles.pdfButton}
                  disabled={sharingKey === group.key}
                  onPress={() => exportGroup(group.supplierName, group.supplierAccountCode, group.items)}
                >
                  <Ionicons name="document-text-outline" size={18} color={colors.primaryDark} />
                  <Text style={styles.pdfButtonText}>{sharingKey === group.key ? 'PDF…' : 'PDF'}</Text>
                </Pressable>
              </View>

              <View style={styles.groupItems}>
                {group.items.map((item) => {
                  const product = item.product;
                  const ticket = product.ticket;
                  const customer = ticket?.customer;
                  const history = product.statusHistory ?? [];
                  return (
                    <View key={item.id} style={styles.productCard}>
                      <View style={styles.productTop}>
                        <View style={styles.productBody}>
                          <Text style={styles.productName}>{product.name || 'İsimsiz ürün'}</Text>
                          <Text style={styles.productMeta}>
                            {[product.stockCode, product.serialNumber ? `Seri: ${product.serialNumber}` : null]
                              .filter(Boolean)
                              .join(' · ') || 'Kod / seri bilgisi yok'}
                          </Text>
                        </View>
                        <View style={styles.statusBadge}>
                          <Text style={styles.statusBadgeText}>{getStatusLabel(product.status)}</Text>
                        </View>
                      </View>

                      <View style={styles.traceBox}>
                        <TraceRow icon="person-outline" label="Müşteri" value={customer?.name || '-'} />
                        <TraceRow
                          icon="calendar-outline"
                          label="Geliş"
                          value={formatDateTime(ticket?.createdAt || item.createdAt)}
                        />
                        <TraceRow icon="repeat-outline" label="İşlem" value={getCategoryLabel(product.category)} />
                        <TraceRow
                          icon="receipt-outline"
                          label="RMA"
                          value={ticket?.receiptNumber || (ticket?.id ? `RMA-${ticket.id}` : '-')}
                        />
                      </View>

                      {history.length > 0 ? (
                        <View style={styles.historyBox}>
                          <Text style={styles.historyTitle}>Son Hareketler</Text>
                          {history.slice(0, 3).map((entry) => (
                            <View key={entry.id} style={styles.historyRow}>
                              <View style={styles.historyDot} />
                              <View style={styles.historyBody}>
                                <Text style={styles.historyStatus}>{getStatusLabel(entry.status)}</Text>
                                <Text style={styles.historyMeta}>
                                  {formatDateTime(entry.createdAt)}{entry.notes ? ` · ${entry.notes}` : ''}
                                </Text>
                              </View>
                            </View>
                          ))}
                        </View>
                      ) : null}

                      <View style={styles.productActions}>
                        <ActionButton
                          icon="sync-outline"
                          label="Durum"
                          onPress={() => {
                            setStatusItem(item);
                            setStatusOpen(true);
                          }}
                        />
                        <ActionButton icon="create-outline" label="Düzenle" onPress={() => openEdit(item)} />
                        <ActionButton
                          icon="swap-horizontal-outline"
                          label="Tedarikçi"
                          onPress={() => {
                            setMoveItem(item);
                            setSupplierPickerMode('move');
                          }}
                        />
                        <ActionButton
                          icon="open-outline"
                          label="RMA"
                          onPress={() => ticket?.id && router.push(recordHref(ticket.id))}
                        />
                        <ActionButton
                          icon="trash-outline"
                          label="Çıkar"
                          danger
                          onPress={() => removeSupplierItem(item)}
                        />
                      </View>
                    </View>
                  );
                })}
              </View>
            </Card>
          ))
        )}
      </ScrollView>

      <StatusSheet
        visible={statusOpen}
        currentStatus={statusItem?.product.status}
        loading={savingStatus}
        onClose={() => {
          setStatusOpen(false);
          setStatusItem(null);
        }}
        onSelect={updateStatus}
      />

      <Modal visible={addOpen} animationType="slide" onRequestClose={() => setAddOpen(false)}>
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>RMA Ürünü Ekle</Text>
              <Text style={styles.modalSubtitle}>Tedarikçiye yönlendirilmemiş mevcut bir ürünü seçin</Text>
            </View>
            <Pressable style={styles.closeButton} onPress={() => setAddOpen(false)}>
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.modalList}>
            {availableProducts.length === 0 ? (
              <Text style={styles.emptyText}>Tedarikçiye eklenebilecek RMA ürünü bulunmuyor.</Text>
            ) : (
              availableProducts.map((product) => (
                <Pressable
                  key={product.id}
                  style={styles.availableProduct}
                  onPress={() => {
                    setPendingProduct(product);
                    setAddOpen(false);
                    setSupplierPickerMode('add');
                  }}
                >
                  <View style={styles.availableIcon}>
                    <Ionicons name="cube-outline" size={20} color={colors.primaryDark} />
                  </View>
                  <View style={styles.availableBody}>
                    <Text style={styles.availableName}>{product.name || 'İsimsiz ürün'}</Text>
                    <Text style={styles.availableMeta}>
                      {product.ticketLabel} · {product.customerName} · {getStatusLabel(product.status)}
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
                </Pressable>
              ))
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      <Modal
        visible={Boolean(editItem && editDraft)}
        animationType="slide"
        onRequestClose={() => {
          setEditItem(null);
          setEditDraft(null);
        }}
      >
        <SafeAreaView style={styles.modalSafe}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Ürünü Düzenle</Text>
              <Text style={styles.modalSubtitle}>Değişiklikler müşteri RMA kaydına da yansır</Text>
            </View>
            <Pressable
              style={styles.closeButton}
              onPress={() => {
                setEditItem(null);
                setEditDraft(null);
              }}
            >
              <Ionicons name="close" size={22} color={colors.text} />
            </Pressable>
          </View>
          {editDraft ? (
            <ScrollView contentContainerStyle={styles.editContent} keyboardShouldPersistTaps="handled">
              <FormField
                label="Ürün Adı"
                value={editDraft.name}
                onChangeText={(value) => setEditDraft((current) => current ? { ...current, name: value } : current)}
              />
              <FormField
                label="Stok Kodu"
                value={editDraft.stockCode}
                onChangeText={(value) => setEditDraft((current) => current ? { ...current, stockCode: value } : current)}
              />
              <FormField
                label="Seri No"
                value={editDraft.serialNumber}
                onChangeText={(value) => setEditDraft((current) => current ? { ...current, serialNumber: value } : current)}
              />
              <FormField
                label="Marka"
                value={editDraft.brand}
                onChangeText={(value) => setEditDraft((current) => current ? { ...current, brand: value } : current)}
              />
              <FormField
                label="Model"
                value={editDraft.model}
                onChangeText={(value) => setEditDraft((current) => current ? { ...current, model: value } : current)}
              />
              <FormField
                label="Adet"
                value={editDraft.quantity}
                keyboardType="number-pad"
                onChangeText={(value) => setEditDraft((current) => current ? { ...current, quantity: value } : current)}
              />
              <FormField
                label="Müşteri Açıklaması"
                value={editDraft.description}
                multiline
                onChangeText={(value) => setEditDraft((current) => current ? { ...current, description: value } : current)}
              />
              <FormField
                label="Tedarikçi Notu"
                value={editDraft.notes}
                multiline
                onChangeText={(value) => setEditDraft((current) => current ? { ...current, notes: value } : current)}
              />
              <Pressable style={[styles.saveButton, savingEdit && styles.disabled]} disabled={savingEdit} onPress={saveEdit}>
                <Text style={styles.saveButtonText}>{savingEdit ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}</Text>
              </Pressable>
            </ScrollView>
          ) : null}
        </SafeAreaView>
      </Modal>

      <SupplierPickerModal
        visible={supplierPickerMode !== null}
        selectedAccountCode={
          supplierPickerMode === 'move' ? moveItem?.supplierAccountCode : undefined
        }
        onClose={() => {
          setSupplierPickerMode(null);
          if (supplierPickerMode === 'add') setPendingProduct(null);
          if (supplierPickerMode === 'move') setMoveItem(null);
        }}
        onSelect={handleSupplierSelected}
      />
    </Screen>
  );
}

function TraceRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.traceRow}>
      <Ionicons name={icon} size={15} color={colors.textMuted} />
      <Text style={styles.traceLabel}>{label}</Text>
      <Text style={styles.traceValue} numberOfLines={2}>{value}</Text>
    </View>
  );
}

function ActionButton({
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
    <Pressable style={[styles.actionButton, danger && styles.actionButtonDanger]} onPress={onPress}>
      <Ionicons name={icon} size={16} color={danger ? colors.danger : colors.primaryDark} />
      <Text style={[styles.actionText, danger && styles.actionTextDanger]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  hero: {
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: colors.primary,
    padding: spacing.lg,
    flexDirection: 'row',
    gap: spacing.md,
  },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroBody: { flex: 1, gap: spacing.xs },
  heroTitle: { ...typography.subtitle, color: colors.primaryDark },
  heroText: { ...typography.caption, color: colors.textSecondary },
  toolbar: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  searchWrap: { flex: 1 },
  addButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: { ...typography.caption, color: colors.danger },
  groupCard: { gap: spacing.lg, padding: spacing.lg },
  groupHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  groupTitleWrap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  supplierAvatar: {
    width: 42,
    height: 42,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  groupTitleBody: { flex: 1, gap: 2 },
  groupTitle: { ...typography.subtitle, color: colors.text },
  groupMeta: { ...typography.caption, color: colors.textSecondary },
  pdfButton: {
    minHeight: 38,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  pdfButtonText: { ...typography.caption, color: colors.primaryDark, fontWeight: '700' },
  groupItems: { gap: spacing.md },
  productCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    gap: spacing.md,
  },
  productTop: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  productBody: { flex: 1, gap: 2 },
  productName: { ...typography.bodyMedium, color: colors.text },
  productMeta: { ...typography.caption, color: colors.textSecondary },
  statusBadge: {
    borderRadius: radius.full,
    backgroundColor: colors.successSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    maxWidth: '43%',
  },
  statusBadgeText: { fontSize: 10, lineHeight: 13, color: colors.success, fontWeight: '700', textAlign: 'center' },
  traceBox: {
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  traceRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.xs },
  traceLabel: { ...typography.caption, color: colors.textMuted, width: 48 },
  traceValue: { ...typography.caption, color: colors.text, flex: 1, fontWeight: '600' },
  historyBox: { gap: spacing.sm },
  historyTitle: { ...typography.caption, color: colors.textSecondary, fontWeight: '700' },
  historyRow: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  historyDot: { width: 8, height: 8, borderRadius: radius.full, backgroundColor: colors.primary, marginTop: 5 },
  historyBody: { flex: 1, gap: 1 },
  historyStatus: { ...typography.caption, color: colors.text, fontWeight: '700' },
  historyMeta: { fontSize: 10, lineHeight: 14, color: colors.textMuted },
  productActions: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  actionButton: {
    minHeight: 36,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
  },
  actionButtonDanger: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  actionText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: colors.primaryDark },
  actionTextDanger: { color: colors.danger },
  modalSafe: { flex: 1, backgroundColor: colors.background },
  modalHeader: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  modalTitle: { ...typography.title, color: colors.text },
  modalSubtitle: { ...typography.caption, color: colors.textSecondary, marginTop: 2 },
  closeButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    borderRadius: radius.full,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalList: { padding: spacing.lg, gap: spacing.sm, flexGrow: 1 },
  availableProduct: {
    minHeight: 70,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
  },
  availableIcon: {
    width: 40,
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  availableBody: { flex: 1, gap: 2 },
  availableName: { ...typography.bodyMedium, color: colors.text },
  availableMeta: { ...typography.caption, color: colors.textSecondary },
  emptyText: { ...typography.body, color: colors.textSecondary, textAlign: 'center', marginTop: spacing.xxxl },
  editContent: { padding: spacing.lg, paddingBottom: spacing.xxxl, gap: spacing.lg },
  saveButton: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonText: { ...typography.bodyMedium, color: colors.surface },
  disabled: { opacity: 0.6 },
});
