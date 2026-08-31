import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Alert,
  Animated,
  LayoutAnimation,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  UIManager,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { BarcodeScannerModal } from '@/components/packages/BarcodeScannerModal';
import { SupplierProductRow } from '@/components/suppliers/SupplierProductRow';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { useSupplierItems } from '@/hooks/useRmaData';
import { rmaApi, type RmaPackage, type SupplierItem } from '@/lib/api';
import { printPackageLabel, sharePackageLabelPdf } from '@/lib/packageLabel';

const PACKABLE_STATUSES = new Set(['rma_deposunda', 'tedarikci_bekliyor', 'beklemede']);

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

function animateLayout() {
  LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    hazirlaniyor: 'Hazırlanıyor',
    kapatildi: 'Kapatıldı · Doğrulama Bekliyor',
    sevke_hazir: 'Sevkiyata Hazır',
    sevk_edildi: 'Sevk Edildi',
  };
  return map[status] ?? status;
}

export default function SupplierShipScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ code: string; name?: string }>();
  const supplierCode = decodeURIComponent(String(params.code || ''));
  const supplierName = params.name ? decodeURIComponent(String(params.name)) : 'Tedarikçi';

  const { items, loading, refreshing, refresh } = useSupplierItems();
  const [pkg, setPkg] = useState<RmaPackage | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(true);
  const [busyProductId, setBusyProductId] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMatched, setScanMatched] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const fadeAnim = useState(() => new Animated.Value(0))[0];

  const supplierItems = useMemo(
    () => items.filter((item) => item.supplierAccountCode === supplierCode),
    [items, supplierCode],
  );

  const inBoxMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of pkg?.items ?? []) {
      map.set(row.productId, row.id);
    }
    return map;
  }, [pkg]);

  const loadPackage = useCallback(async () => {
    setLoadingPkg(true);
    try {
      const openPackages = await rmaApi.listPackages({ supplier: supplierCode, status: 'hazirlaniyor' });
      const closed = await rmaApi.listPackages({ supplier: supplierCode, status: 'kapatildi' });
      const ready = await rmaApi.listPackages({ supplier: supplierCode, status: 'sevke_hazir' });
      const candidate = [...openPackages, ...closed, ...ready].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )[0];

      if (candidate?.id) {
        const detail = await rmaApi.getPackage(candidate.id);
        setPkg(detail);
        setScanMatched(Boolean(detail.verifiedAt) || detail.status === 'sevke_hazir');
      } else {
        setPkg(null);
        setScanMatched(false);
      }
    } catch {
      setPkg(null);
    } finally {
      setLoadingPkg(false);
    }
  }, [supplierCode]);

  useEffect(() => {
    void loadPackage();
  }, [loadPackage]);

  useEffect(() => {
    Animated.timing(fadeAnim, { toValue: 1, duration: 350, useNativeDriver: true }).start();
  }, [fadeAnim]);

  const reloadAll = async () => {
    await Promise.all([refresh(), loadPackage()]);
  };

  const addToBox = async (item: SupplierItem) => {
    if (!PACKABLE_STATUSES.has(item.product.status)) {
      Alert.alert(
        'Koliye eklenemez',
        'Ürün RMA deposunda ve sevke uygun durumda olmalıdır (RMA deposunda / tedarikçi bekliyor / beklemede).',
      );
      return;
    }

    setBusyProductId(item.productId);
    try {
      animateLayout();
      if (!pkg) {
        const created = await rmaApi.createPackage({
          supplierAccountCode: supplierCode,
          supplierName: item.supplierName,
          productIds: [item.productId],
        });
        setPkg(created);
      } else if (['hazirlaniyor', 'taslak'].includes(pkg.status)) {
        const updated = await rmaApi.addPackageItems(pkg.id, [item.productId]);
        setPkg(updated);
      } else {
        Alert.alert('Koli kilitli', 'Kapalı veya sevk edilmiş koli değiştirilemez.');
      }
      await refresh();
    } catch (err) {
      Alert.alert('Koliye eklenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setBusyProductId(null);
    }
  };

  const removeFromBox = async (productId: number) => {
    if (!pkg) return;
    const itemId = inBoxMap.get(productId);
    if (!itemId) return;

    setBusyProductId(productId);
    try {
      animateLayout();
      const updated = await rmaApi.removePackageItem(pkg.id, itemId);
      setPkg(updated.items.length ? updated : null);
      await refresh();
    } catch (err) {
      Alert.alert('Koliden çıkarılamadı', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setBusyProductId(null);
    }
  };

  const closeBox = async () => {
    if (!pkg) return;
    setClosing(true);
    try {
      animateLayout();
      const updated = await rmaApi.closePackage(pkg.id);
      setPkg(updated);
      setScanMatched(false);
      Alert.alert('Koli kapatıldı', 'Barkod atandı. Etiketi yazdırıp tarayarak doğrulayabilirsiniz.');
    } catch (err) {
      Alert.alert('Koli kapatılamadı', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setClosing(false);
    }
  };

  const handlePrint = async () => {
    if (!pkg?.barcodeValue && !pkg?.qrValue) return;
    setPrinting(true);
    try {
      await printPackageLabel(pkg);
    } catch (err) {
      Alert.alert('Yazdırma başarısız', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setPrinting(false);
    }
  };

  const handleShareLabel = async () => {
    if (!pkg) return;
    try {
      await sharePackageLabelPdf(pkg);
    } catch (err) {
      Alert.alert('Etiket paylaşılamadı', err instanceof Error ? err.message : 'Bilinmeyen hata');
    }
  };

  const handleScan = (value: string) => {
    const expected = pkg?.barcodeValue || pkg?.qrValue;
    if (expected && value === expected) {
      setScanMatched(true);
      setScanOpen(false);
      Alert.alert('Barkod doğrulandı', 'Koli etiketi eşleşti. Sevkiyata hazır işlemini tamamlayabilirsiniz.');
    } else {
      Alert.alert('Barkod eşleşmedi', 'Okunan barkod bu koliye ait değil.');
    }
  };

  const markReadyToShip = async () => {
    if (!pkg?.barcodeValue && !pkg?.qrValue) return;
    setVerifying(true);
    try {
      animateLayout();
      const updated = await rmaApi.verifyPackageBarcode(pkg.barcodeValue || pkg.qrValue || '');
      setPkg(updated);
      Alert.alert('Sevkiyata hazır', 'Koli sevkiyat için hazırlandı.');
    } catch (err) {
      Alert.alert('Doğrulama başarısız', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setVerifying(false);
    }
  };

  if (loading || loadingPkg) {
    return (
      <Screen>
        <LoadingState />
      </Screen>
    );
  }

  const canEditBox = pkg ? ['hazirlaniyor', 'taslak'].includes(pkg.status) : true;
  const isClosed = pkg?.status === 'kapatildi';
  const isReady = pkg?.status === 'sevke_hazir';

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader title="Ürünleri Sevk Et" subtitle={supplierName} onBack={() => router.back()} />

      <Animated.View style={{ flex: 1, opacity: fadeAnim }}>
        <ScrollView
          contentContainerStyle={styles.content}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={reloadAll} tintColor={colors.primary} />}
        >
          <Card style={styles.statusCard}>
            <View style={styles.statusHeader}>
              <Ionicons name="cube-outline" size={22} color={colors.primaryDark} />
              <View style={styles.statusBody}>
                <Text style={styles.statusTitle}>{pkg ? pkg.packageNumber : 'Aktif koli yok'}</Text>
                <Text style={styles.statusHint}>
                  {pkg ? statusLabel(pkg.status) : 'Koliye eklediğinizde otomatik oluşturulur'}
                </Text>
              </View>
            </View>
            {pkg?.barcodeValue ? (
              <Text style={styles.barcodeValue}>{pkg.barcodeValue}</Text>
            ) : null}
          </Card>

          <Text style={styles.sectionTitle}>Tedarikçi Ürünleri</Text>
          <View style={styles.list}>
            {supplierItems.map((item) => {
              const inBox = inBoxMap.has(item.productId);
              const busy = busyProductId === item.productId;

              return (
                <View key={item.id} style={styles.rowWrap}>
                  <SupplierProductRow
                    item={item}
                    onOpen={() => router.push(`/supplier/product/${item.id}` as never)}
                    trailing={
                      canEditBox ? (
                        <Pressable
                          style={[styles.boxBtn, inBox ? styles.boxBtnRemove : styles.boxBtnAdd, busy && styles.disabled]}
                          onPress={() => (inBox ? removeFromBox(item.productId) : addToBox(item))}
                          disabled={busy}
                        >
                          <Ionicons
                            name={inBox ? 'remove-circle-outline' : 'add-circle-outline'}
                            size={18}
                            color={inBox ? colors.danger : colors.success}
                          />
                          <Text style={[styles.boxBtnText, inBox && styles.boxBtnTextRemove]}>
                            {busy ? '…' : inBox ? 'Koliden\nÇıkar' : 'Koliye\nEkle'}
                          </Text>
                        </Pressable>
                      ) : null
                    }
                  />
                </View>
              );
            })}
          </View>

          {pkg && (pkg.items?.length ?? 0) > 0 ? (
            <View style={styles.actions}>
              {canEditBox ? (
                <PrimaryAction
                  icon="lock-closed-outline"
                  label={closing ? 'Kapatılıyor…' : 'Koliyi Kapat ve Barkod Ata'}
                  onPress={closeBox}
                  disabled={closing}
                />
              ) : null}

              {isClosed || isReady ? (
                <>
                  <SecondaryAction
                    icon="print-outline"
                    label={printing ? 'Yazdırılıyor…' : 'Barkod Yazdır'}
                    onPress={handlePrint}
                    disabled={printing}
                  />
                  <SecondaryAction icon="share-outline" label="Etiket PDF Paylaş" onPress={handleShareLabel} />
                  {!isReady ? (
                    <SecondaryAction icon="scan-outline" label="Barkodu Tara" onPress={() => setScanOpen(true)} />
                  ) : null}
                </>
              ) : null}

              {scanMatched && isClosed ? (
                <PrimaryAction
                  icon="checkmark-circle-outline"
                  label={verifying ? 'Hazırlanıyor…' : 'Sevkiyata Hazır Yap'}
                  onPress={markReadyToShip}
                  disabled={verifying}
                  success
                />
              ) : null}

              {isReady ? (
                <View style={styles.readyBanner}>
                  <Ionicons name="checkmark-done-circle" size={22} color={colors.success} />
                  <Text style={styles.readyText}>Koli sevkiyata hazır</Text>
                </View>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </Animated.View>

      <BarcodeScannerModal
        visible={scanOpen}
        title="Koli Barkodunu Tara"
        expectedValue={pkg?.barcodeValue || pkg?.qrValue}
        onClose={() => setScanOpen(false)}
        onScanned={handleScan}
      />
    </Screen>
  );
}

function PrimaryAction({
  icon,
  label,
  onPress,
  disabled,
  success,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  success?: boolean;
}) {
  return (
    <Pressable
      style={[styles.primaryBtn, success && styles.primaryBtnSuccess, disabled && styles.disabled]}
      onPress={onPress}
      disabled={disabled}
    >
      <Ionicons name={icon} size={20} color={colors.surface} />
      <Text style={styles.primaryBtnText}>{label}</Text>
    </Pressable>
  );
}

function SecondaryAction({
  icon,
  label,
  onPress,
  disabled,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable style={[styles.secondaryBtn, disabled && styles.disabled]} onPress={onPress} disabled={disabled}>
      <Ionicons name={icon} size={18} color={colors.primaryDark} />
      <Text style={styles.secondaryBtnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  statusCard: { gap: spacing.sm, backgroundColor: colors.primarySoft, borderColor: colors.primary, borderWidth: 1 },
  statusHeader: { flexDirection: 'row', gap: spacing.md, alignItems: 'center' },
  statusBody: { flex: 1 },
  statusTitle: { ...typography.subtitle, color: colors.text },
  statusHint: { ...typography.caption, color: colors.textSecondary },
  barcodeValue: {
    ...typography.caption,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
    color: colors.primaryDark,
    fontWeight: '700',
  },
  sectionTitle: { ...typography.bodyMedium, color: colors.textSecondary, marginTop: spacing.sm },
  list: { gap: spacing.sm },
  rowWrap: { gap: 0 },
  boxBtn: {
    width: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: spacing.xs,
    borderLeftWidth: 1,
    borderLeftColor: colors.borderLight,
  },
  boxBtnAdd: { backgroundColor: colors.successSoft },
  boxBtnRemove: { backgroundColor: colors.dangerSoft },
  boxBtnText: {
    fontSize: 10,
    lineHeight: 12,
    fontWeight: '700',
    color: colors.success,
    textAlign: 'center',
  },
  boxBtnTextRemove: { color: colors.danger },
  actions: { gap: spacing.sm, marginTop: spacing.md },
  primaryBtn: {
    minHeight: minTouchTarget + 4,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  primaryBtnSuccess: { backgroundColor: colors.success },
  primaryBtnText: { ...typography.bodyMedium, color: colors.surface, fontWeight: '700' },
  secondaryBtn: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  secondaryBtnText: { ...typography.bodyMedium, color: colors.primaryDark, fontWeight: '700' },
  readyBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.successSoft,
  },
  readyText: { ...typography.bodyMedium, color: colors.success, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
