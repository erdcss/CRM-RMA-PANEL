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
import { useLocalSearchParams, useRouter } from 'expo-router';

import { FormField } from '@/components/forms/FormField';
import { StatusSheet } from '@/components/rma/StatusSheet';
import { SupplierPickerModal } from '@/components/suppliers/SupplierPickerModal';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { getCategoryLabel, getStatusLabel } from '@/constants/statuses';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useSupplierItems } from '@/hooks/useRmaData';
import { rmaApi, type CatalogCustomer, type SupplierItem } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { recordHref } from '@/lib/routes';
import { previewSupplierPdf, shareSupplierPdf } from '@/lib/supplierPdf';

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

function draftFromItem(item: SupplierItem): EditDraft {
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

export default function SupplierDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string }>();
  const supplierCode = decodeURIComponent(String(params.code || ''));
  const { items, loading, refreshing, error, refresh } = useSupplierItems();

  const [statusItem, setStatusItem] = useState<SupplierItem | null>(null);
  const [savingStatus, setSavingStatus] = useState(false);
  const [editItem, setEditItem] = useState<SupplierItem | null>(null);
  const [editDraft, setEditDraft] = useState<EditDraft | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [moveItem, setMoveItem] = useState<SupplierItem | null>(null);
  const [sharing, setSharing] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  const supplierItems = useMemo(
    () => items.filter((item) => item.supplierAccountCode === supplierCode),
    [items, supplierCode],
  );

  const supplierName = supplierItems[0]?.supplierName || 'Tedarikçi';
  const totalQuantity = supplierItems.reduce((sum, item) => sum + Number(item.product.quantity ?? 1), 0);
  const openCount = supplierItems.filter((item) => !['teslim_edildi', 'iptal'].includes(item.product.status)).length;

  const updateStatus = async (status: string) => {
    if (!statusItem) return;
    setSavingStatus(true);
    try {
      await rmaApi.updateProductStatus(statusItem.productId, status);
      setStatusItem(null);
      await refresh();
    } catch (err) {
      Alert.alert('Durum güncellenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setSavingStatus(false);
    }
  };

  const openEdit = (item: SupplierItem) => {
    setEditItem(item);
    setEditDraft(draftFromItem(item));
  };

  const saveEdit = async () => {
    if (!editItem || !editDraft) return;
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
          quantity: Math.max(1, Number(editDraft.quantity) || 1),
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

  const moveSupplier = async (supplier: CatalogCustomer) => {
    if (!moveItem) return;
    try {
      await rmaApi.updateSupplierItem(moveItem.id, {
        supplierAccountCode: supplier.accountCode,
        supplierName: supplier.accountName,
      });
      setMoveItem(null);
      await refresh();
      Alert.alert('Tedarikçi değiştirildi', 'Ürün seçilen tedarikçi listesine taşındı.');
    } catch (err) {
      Alert.alert('Tedarikçi değiştirilemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    }
  };

  const removeItem = (item: SupplierItem) => {
    Alert.alert(
      'Tedarikçi listesinden çıkar',
      `${item.product.name || 'Ürün'} bu tedarikçi listesinden çıkarılsın mı? RMA kaydı silinmez.`,
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
            {supplierItems.map((item) => {
              const product = item.product;
              const ticket = product.ticket;
              const customer = ticket?.customer;
              const history = product.statusHistory ?? [];

              return (
                <Card key={item.id} style={styles.productCard}>
                  <View style={styles.productHeader}>
                    <View style={styles.productBody}>
                      <Text style={styles.productName}>{product.name || 'İsimsiz ürün'}</Text>
                      <Text style={styles.productMeta}>
                        {[product.stockCode, product.serialNumber ? `Seri: ${product.serialNumber}` : null]
                          .filter(Boolean)
                          .join(' · ') || 'Kod / seri bilgisi yok'}
                      </Text>
                    </View>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>{getStatusLabel(product.status)}</Text>
                    </View>
                  </View>

                  <View style={styles.traceBox}>
                    <TraceRow icon="person-outline" label="Müşteri" value={customer?.name || '-'} />
                    <TraceRow
                      icon="calendar-outline"
                      label="Geliş tarihi"
                      value={formatDateTime(ticket?.createdAt || item.createdAt)}
                    />
                    <TraceRow icon="repeat-outline" label="İşlem" value={getCategoryLabel(product.category)} />
                    <TraceRow
                      icon="receipt-outline"
                      label="RMA"
                      value={ticket?.receiptNumber || (ticket?.id ? `RMA-${ticket.id}` : '-')}
                    />
                    {item.notes ? <TraceRow icon="document-text-outline" label="Not" value={item.notes} /> : null}
                  </View>

                  {history.length > 0 ? (
                    <View style={styles.historyBox}>
                      <Text style={styles.historyTitle}>Son Hareketler</Text>
                      {history.slice(0, 4).map((entry) => (
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

                  <View style={styles.actionsGrid}>
                    <ActionButton icon="sync-outline" label="Durum" onPress={() => setStatusItem(item)} />
                    <ActionButton icon="create-outline" label="Düzenle" onPress={() => openEdit(item)} />
                    <ActionButton icon="swap-horizontal-outline" label="Tedarikçi" onPress={() => setMoveItem(item)} />
                    <ActionButton
                      icon="open-outline"
                      label="RMA'ya Git"
                      onPress={() => ticket?.id && router.push(recordHref(ticket.id))}
                    />
                  </View>

                  <Pressable style={styles.removeButton} onPress={() => removeItem(item)}>
                    <Ionicons name="trash-outline" size={17} color={colors.danger} />
                    <Text style={styles.removeText}>Tedarikçi Listesinden Çıkar</Text>
                  </Pressable>
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>

      <StatusSheet
        visible={Boolean(statusItem)}
        currentStatus={statusItem?.product.status}
        loading={savingStatus}
        onClose={() => setStatusItem(null)}
        onSelect={updateStatus}
      />

      <SupplierPickerModal
        visible={Boolean(moveItem)}
        title="Tedarikçi Değiştir"
        selectedAccountCode={moveItem?.supplierAccountCode}
        onClose={() => setMoveItem(null)}
        onSelect={moveSupplier}
      />

      <Modal visible={Boolean(editItem && editDraft)} transparent animationType="slide" onRequestClose={() => setEditItem(null)}>
        <Pressable style={styles.overlay} onPress={() => setEditItem(null)}>
          <Pressable style={styles.sheet} onPress={(event) => event.stopPropagation()}>
            <SafeAreaView edges={['bottom']}>
              <View style={styles.handle} />
              <View style={styles.sheetHeader}>
                <View style={styles.sheetTitleBody}>
                  <Text style={styles.sheetTitle}>Ürün / Tedarikçi Kaydını Düzenle</Text>
                  <Text style={styles.sheetHint}>Değişiklikler aynı RMA ürününe de yansır.</Text>
                </View>
                <Pressable style={styles.headerButton} onPress={() => setEditItem(null)}>
                  <Ionicons name="close" size={22} color={colors.textSecondary} />
                </Pressable>
              </View>

              {editDraft ? (
                <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled">
                  <FormField label="Ürün Adı" value={editDraft.name} onChangeText={(value) => setEditDraft({ ...editDraft, name: value })} />
                  <FormField label="Stok Kodu" value={editDraft.stockCode} onChangeText={(value) => setEditDraft({ ...editDraft, stockCode: value })} />
                  <FormField label="Seri No" value={editDraft.serialNumber} onChangeText={(value) => setEditDraft({ ...editDraft, serialNumber: value })} />
                  <FormField label="Marka" value={editDraft.brand} onChangeText={(value) => setEditDraft({ ...editDraft, brand: value })} />
                  <FormField label="Model" value={editDraft.model} onChangeText={(value) => setEditDraft({ ...editDraft, model: value })} />
                  <FormField label="Adet" value={editDraft.quantity} onChangeText={(value) => setEditDraft({ ...editDraft, quantity: value })} keyboardType="number-pad" />
                  <FormField label="Ürün Açıklaması" value={editDraft.description} onChangeText={(value) => setEditDraft({ ...editDraft, description: value })} multiline />
                  <FormField label="Tedarikçi Notu" value={editDraft.notes} onChangeText={(value) => setEditDraft({ ...editDraft, notes: value })} multiline />

                  <Pressable style={[styles.saveButton, savingEdit && styles.disabled]} onPress={saveEdit} disabled={savingEdit}>
                    <Text style={styles.saveText}>{savingEdit ? 'Kaydediliyor…' : 'Değişiklikleri Kaydet'}</Text>
                  </Pressable>
                </ScrollView>
              ) : null}
            </SafeAreaView>
          </Pressable>
        </Pressable>
      </Modal>
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
      <Ionicons name={icon} size={16} color={colors.textMuted} />
      <Text style={styles.traceLabel}>{label}</Text>
      <Text style={styles.traceValue}>{value}</Text>
    </View>
  );
}

function ActionButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable style={styles.actionButton} onPress={onPress}>
      <Ionicons name={icon} size={17} color={colors.primaryDark} />
      <Text style={styles.actionText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  headerButton: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  error: {
    ...typography.caption,
    color: colors.danger,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  summaryBox: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
    padding: spacing.md,
    gap: 2,
  },
  summaryValue: {
    ...typography.title,
    color: colors.text,
  },
  summaryLabel: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  pdfActions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  pdfAction: {
    flex: 1,
    minWidth: 0,
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  pdfActionText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
    flexShrink: 1,
  },
  list: {
    gap: spacing.lg,
  },
  productCard: {
    gap: spacing.md,
  },
  productHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  productBody: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  productName: {
    ...typography.subtitle,
    color: colors.text,
  },
  productMeta: {
    ...typography.caption,
    color: colors.textSecondary,
  },
  statusBadge: {
    borderRadius: radius.full,
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
  },
  statusText: {
    fontSize: 11,
    lineHeight: 14,
    fontWeight: '700',
    color: colors.primaryDark,
  },
  traceBox: {
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceSecondary,
  },
  traceRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  traceLabel: {
    ...typography.caption,
    color: colors.textMuted,
    width: 78,
  },
  traceValue: {
    ...typography.caption,
    color: colors.text,
    flex: 1,
    fontWeight: '600',
  },
  historyBox: {
    gap: spacing.sm,
  },
  historyTitle: {
    ...typography.caption,
    color: colors.textSecondary,
    fontWeight: '700',
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  historyDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    marginTop: 5,
  },
  historyBody: {
    flex: 1,
    gap: 1,
  },
  historyStatus: {
    ...typography.caption,
    color: colors.text,
    fontWeight: '700',
  },
  historyMeta: {
    ...typography.caption,
    color: colors.textMuted,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  actionButton: {
    width: '48%',
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
  },
  actionText: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '700',
  },
  removeButton: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.dangerSoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  removeText: {
    ...typography.caption,
    color: colors.danger,
    fontWeight: '700',
  },
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: colors.overlay,
  },
  sheet: {
    maxHeight: '88%',
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
  },
  sheetTitleBody: {
    flex: 1,
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
  form: {
    gap: spacing.md,
    paddingBottom: spacing.xxl,
  },
  saveButton: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  saveText: {
    ...typography.bodyMedium,
    color: colors.surface,
    fontWeight: '700',
  },
  disabled: {
    opacity: 0.6,
  },
});
