import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { appAlert } from '@/lib/appAlert';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BarcodeScannerModal } from '@/components/packages/BarcodeScannerModal';
import { StatusSheet } from '@/components/rma/StatusSheet';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getStatusLabel, getStatusVariant } from '@/constants/statuses';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { usePackageDrawer } from '@/contexts/PackageDrawerContext';
import { rmaApi, type RmaPackage, type RmaProduct } from '@/lib/api';
import { normalizeScannedBarcode } from '@/lib/barcodeNormalize';
import { playScanError, playScanSuccess } from '@/lib/scanFeedback';

const DRAWER_WIDTH = Math.min(Dimensions.get('window').width * 0.88, 400);
const PREPARED_STATUSES = new Set(['hazirlaniyor', 'kapatildi', 'sevke_hazir']);

function packageStatusLabel(status: string) {
  const map: Record<string, string> = {
    hazirlaniyor: 'Hazırlanıyor',
    kapatildi: 'Kapatıldı',
    sevke_hazir: 'Sevkiyata Hazır',
    sevk_edildi: 'Sevk Edildi'};
  return map[status] ?? status;
}

function packageStatusVariant(status: string) {
  if (status === 'sevke_hazir') return 'completed' as const;
  if (status === 'kapatildi') return 'review' as const;
  if (status === 'hazirlaniyor') return 'new' as const;
  return 'default' as const;
}

type SupplierGroup = {
  code: string;
  name: string;
  packages: RmaPackage[];
};

export function PackageDrawer() {
  const insets = useSafeAreaInsets();
  const { open, closeDrawer } = usePackageDrawer();
  const slideAnim = useRef(new Animated.Value(DRAWER_WIDTH)).current;

  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [packages, setPackages] = useState<RmaPackage[]>([]);
  const [selectedPkg, setSelectedPkg] = useState<RmaPackage | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [statusProduct, setStatusProduct] = useState<RmaProduct | null>(null);
  const [statusSaving, setStatusSaving] = useState(false);

  const loadPackages = useCallback(async () => {
    try {
      const all = await rmaApi.listPackages();
      const prepared = all
        .filter((row) => PREPARED_STATUSES.has(row.status))
        .sort((a, b) => {
          const aTime = new Date(a.closedAt || a.createdAt).getTime();
          const bTime = new Date(b.closedAt || b.createdAt).getTime();
          return bTime - aTime;
        });
      setPackages(prepared);
    } catch (err) {
      appAlert('Koliler yüklenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    }
  }, []);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await loadPackages();
    if (selectedPkg?.id) {
      try {
        setSelectedPkg(await rmaApi.getPackage(selectedPkg.id));
      } catch {
        /* keep current detail */
      }
    }
    setRefreshing(false);
  }, [loadPackages, selectedPkg?.id]);

  useEffect(() => {
    if (open) {
      setLoading(true);
      void loadPackages().finally(() => setLoading(false));
      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        damping: 22,
        stiffness: 220}).start();
    } else {
      Animated.timing(slideAnim, {
        toValue: DRAWER_WIDTH,
        duration: 220,
        useNativeDriver: true}).start();
      setSelectedPkg(null);
      setScanOpen(false);
    }
  }, [open, slideAnim, loadPackages]);

  const supplierGroups = useMemo(() => {
    const map = new Map<string, SupplierGroup>();
    for (const pkg of packages) {
      const key = pkg.supplierAccountCode || pkg.supplierName;
      const existing = map.get(key);
      if (existing) {
        existing.packages.push(pkg);
      } else {
        map.set(key, {
          code: pkg.supplierAccountCode,
          name: pkg.supplierName,
          packages: [pkg]});
      }
    }
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, 'tr'));
  }, [packages]);

  const openPackageDetail = async (pkg: RmaPackage) => {
    try {
      setSelectedPkg(await rmaApi.getPackage(pkg.id));
    } catch (err) {
      appAlert('Koli detayı', err instanceof Error ? err.message : 'Bilinmeyen hata');
    }
  };

  const handleScan = async (rawValue: string) => {
    const value = normalizeScannedBarcode(rawValue);
    if (!value) return;

    setScanOpen(false);
    try {
      const found = await rmaApi.lookupPackage(value);
      playScanSuccess();
      setSelectedPkg(found);
    } catch {
      playScanError();
      appAlert('Koli bulunamadı', 'Taranan barkod sistemde eşleşmedi.');
    }
  };

  const handleStatusSelect = async (status: string) => {
    if (!statusProduct || !selectedPkg) return;
    setStatusSaving(true);
    try {
      await rmaApi.updateProductStatus(statusProduct.id, status);
      setStatusProduct(null);
      setSelectedPkg(await rmaApi.getPackage(selectedPkg.id));
      await loadPackages();
    } catch (err) {
      appAlert('Durum güncellenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setStatusSaving(false);
    }
  };

  const renderList = () => (
    <ScrollView
      contentContainerStyle={styles.listContent}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
    >
      {loading ? (
        <ActivityIndicator color={colors.primary} style={styles.loader} />
      ) : supplierGroups.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="cube-outline" size={36} color={colors.textMuted} />
          <Text style={styles.emptyTitle}>Hazırlanan koli yok</Text>
          <Text style={styles.emptyHint}>Tedarikçi sevkiyat ekranından koli oluşturabilirsiniz.</Text>
        </View>
      ) : (
        supplierGroups.map((group) => (
          <View key={group.code} style={styles.group}>
            <Text style={styles.groupTitle}>{group.name}</Text>
            <Text style={styles.groupCode}>{group.code}</Text>
            {group.packages.map((pkg) => (
              <Pressable key={pkg.id} style={styles.pkgRow} onPress={() => void openPackageDetail(pkg)}>
                <View style={styles.pkgMain}>
                  <Text style={styles.pkgNumber}>{pkg.packageNumber}</Text>
                  <Text style={styles.pkgBarcode} numberOfLines={1}>
                    {pkg.barcodeValue || pkg.qrValue || '—'}
                  </Text>
                  <Text style={styles.pkgMeta}>
                    {(pkg.productCount ?? pkg.items?.length ?? 0)} ürün
                  </Text>
                </View>
                <StatusBadge label={packageStatusLabel(pkg.status)} variant={packageStatusVariant(pkg.status)} />
              </Pressable>
            ))}
          </View>
        ))
      )}
    </ScrollView>
  );

  const renderDetail = () => {
    if (!selectedPkg) return null;
    const products = selectedPkg.items ?? [];

    return (
      <ScrollView
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      >
        <Pressable style={styles.backRow} onPress={() => setSelectedPkg(null)}>
          <Ionicons name="chevron-back" size={20} color={colors.primary} />
          <Text style={styles.backText}>Koli listesine dön</Text>
        </Pressable>

        <View style={styles.detailCard}>
          <Text style={styles.detailTitle}>{selectedPkg.packageNumber}</Text>
          <Text style={styles.detailSupplier}>{selectedPkg.supplierName}</Text>
          <Text style={styles.detailBarcode}>{selectedPkg.barcodeValue || selectedPkg.qrValue || '—'}</Text>
          <StatusBadge
            label={packageStatusLabel(selectedPkg.status)}
            variant={packageStatusVariant(selectedPkg.status)}
          />
        </View>

        <Text style={styles.sectionTitle}>Koli İçeriği</Text>
        {products.length === 0 ? (
          <Text style={styles.emptyHint}>Bu kolide ürün bulunmuyor.</Text>
        ) : (
          products.map((item) => {
            const product = item.product;
            if (!product) return null;
            return (
              <Pressable
                key={item.id}
                style={styles.productRow}
                onPress={() => setStatusProduct(product)}
              >
                <View style={styles.productMain}>
                  <Text style={styles.productName}>{product.name}</Text>
                  <Text style={styles.productMeta}>
                    {product.stockCode || '—'} · {product.serialNumber || 'Seri yok'}
                  </Text>
                </View>
                <View style={styles.productStatus}>
                  <StatusBadge
                    label={getStatusLabel(product.status)}
                    variant={getStatusVariant(product.status, product.category)}
                  />
                  <Ionicons name="chevron-forward" size={16} color={colors.textMuted} />
                </View>
              </Pressable>
            );
          })
        )}
      </ScrollView>
    );
  };

  return (
    <>
      <Modal visible={open} transparent animationType="none" onRequestClose={closeDrawer}>
        <View style={styles.root}>
          <Pressable style={styles.backdrop} onPress={closeDrawer} />
          <Animated.View
            style={[
              styles.panel,
              {
                width: DRAWER_WIDTH,
                paddingTop: insets.top,
                paddingBottom: Math.max(insets.bottom, spacing.md),
                transform: [{ translateX: slideAnim }]},
            ]}
          >
            <View style={styles.header}>
              <View style={styles.headerText}>
                <Text style={styles.title}>Hazırlanan Koliler</Text>
                <Text style={styles.subtitle}>Tedarikçi sevkiyat kolileri</Text>
              </View>
              <Pressable style={styles.closeBtn} onPress={closeDrawer} hitSlop={8}>
                <Ionicons name="close" size={24} color={colors.text} />
              </Pressable>
            </View>

            <Pressable style={styles.scanBtn} onPress={() => setScanOpen(true)}>
              <Ionicons name="scan-outline" size={20} color={colors.surface} />
              <Text style={styles.scanBtnText}>Barkod Tara</Text>
            </Pressable>

            <View style={styles.body}>
              {selectedPkg ? renderDetail() : renderList()}
            </View>
          </Animated.View>
        </View>
      </Modal>

      <BarcodeScannerModal visible={scanOpen} onClose={() => setScanOpen(false)} onScanned={(v) => void handleScan(v)} />

      <StatusSheet
        visible={Boolean(statusProduct)}
        currentStatus={statusProduct?.status}
        loading={statusSaving}
        onClose={() => setStatusProduct(null)}
        onSelect={(status) => void handleStatusSelect(status)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: colors.overlay},
  panel: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderBottomLeftRadius: radius.xl,
    shadowColor: '#0F172A',
    shadowOffset: { width: -4, height: 0 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 12},
  body: { flex: 1, minHeight: 0 },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight},
  headerText: { flex: 1, minWidth: 0 },
  title: { ...typography.subtitle, color: colors.text },
  subtitle: { ...typography.caption, color: colors.textMuted, marginTop: 2 },
  closeBtn: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center'},
  scanBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    marginHorizontal: spacing.lg,
    marginVertical: spacing.md,
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary},
  scanBtnText: { ...typography.bodyMedium, color: colors.surface, fontWeight: '700' },
  listContent: {
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.xxxl,
    gap: spacing.md},
  loader: { marginVertical: spacing.xxxl },
  empty: {
    alignItems: 'center',
    paddingVertical: spacing.xxxl,
    gap: spacing.sm},
  emptyTitle: { ...typography.subtitle, color: colors.text },
  emptyHint: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  group: {
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.borderLight},
  groupTitle: { ...typography.bodyMedium, color: colors.text, fontWeight: '700' },
  groupCode: { ...typography.caption, color: colors.textMuted, marginBottom: spacing.xs },
  pkgRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.background},
  pkgMain: { flex: 1, minWidth: 0, gap: 2 },
  pkgNumber: { ...typography.bodyMedium, color: colors.text, fontWeight: '700' },
  pkgBarcode: { ...typography.caption, color: colors.textSecondary, fontFamily: 'Courier' },
  pkgMeta: { ...typography.caption, color: colors.textMuted },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginBottom: spacing.sm},
  backText: { ...typography.bodyMedium, color: colors.primary, fontWeight: '600' },
  detailCard: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    backgroundColor: colors.primarySoft,
    borderWidth: 1,
    borderColor: '#BFDBFE',
    gap: spacing.sm,
    marginBottom: spacing.md},
  detailTitle: { ...typography.title2, color: colors.primaryDark },
  detailSupplier: { ...typography.body, color: colors.text },
  detailBarcode: { ...typography.caption, color: colors.textSecondary, fontFamily: 'Courier' },
  sectionTitle: { ...typography.subtitle, color: colors.text, marginBottom: spacing.sm },
  productRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.sm},
  productMain: { flex: 1, minWidth: 0, gap: 2 },
  productName: { ...typography.bodyMedium, color: colors.text, fontWeight: '600' },
  productMeta: { ...typography.caption, color: colors.textMuted },
  productStatus: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs }});
