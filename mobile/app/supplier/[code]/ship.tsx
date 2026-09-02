import { useCallback, useEffect, useMemo, useState } from 'react';
import { Animated,
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
import { appAlert } from '@/lib/appAlert';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { BarcodeScannerModal } from '@/components/packages/BarcodeScannerModal';
import { ShipmentProductBarcode } from '@/components/suppliers/ShipmentProductBarcode';
import { SupplierProductRow } from '@/components/suppliers/SupplierProductRow';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { playScanError, playScanSuccess } from '@/lib/scanFeedback';
import { normalizeLookupScan, normalizeScannedBarcode, scanValuesMatchAny } from '@/lib/barcodeNormalize';
import { isValidShipmentBarcodeNumber, requireShipmentBarcodeNumber } from '@shared/shipment-barcode';
import { useSupplierItems } from '@/hooks/useRmaData';
import { rmaApi, type RmaPackage, type SupplierItem } from '@/lib/api';
import { printPackageLabel, sharePackageLabelPdf } from '@/lib/packageLabel';
import { printPackageBarcodeDirect, printProductBarcodeDirect, shouldUseNiimbotDirectPrint } from '@/lib/niimbot/printBarcodeDirect';
import { NiimbotPrinterError } from '@/lib/niimbot/types';
import { parsePackageLabelSequence } from '@/lib/packageLabelUtils';

const EDITABLE_PKG_STATUSES = new Set(['hazirlaniyor', 'taslak']);

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
  const [activePkg, setActivePkg] = useState<RmaPackage | null>(null);
  const [closedPkg, setClosedPkg] = useState<RmaPackage | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(true);
  const [busyProductId, setBusyProductId] = useState<number | null>(null);
  const [closing, setClosing] = useState(false);
  const [printing, setPrinting] = useState(false);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMatched, setScanMatched] = useState(false);
  const [lastScannedValue, setLastScannedValue] = useState<string | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [barcodesByProductId, setBarcodesByProductId] = useState<Record<number, string>>({});
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [barcodeErrors, setBarcodeErrors] = useState<Record<number, string>>({});
  const [printingProductId, setPrintingProductId] = useState<number | null>(null);
  const fadeAnim = useState(() => new Animated.Value(0))[0];

  const supplierItems = useMemo(
    () => items.filter((item) => item.supplierAccountCode === supplierCode),
    [items, supplierCode],
  );

  const inBoxMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of activePkg?.items ?? []) {
      map.set(row.productId, row.id);
    }
    return map;
  }, [activePkg]);

  const loadPackage = useCallback(async () => {
    setLoadingPkg(true);
    try {
      const all = await rmaApi.listPackages({ supplier: supplierCode });
      const sorted = [...all].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );

      const open = sorted.find((row) => EDITABLE_PKG_STATUSES.has(row.status));
      const finishedCandidates = sorted
        .filter((row) => ['kapatildi', 'sevke_hazir'].includes(row.status))
        .sort((a, b) => {
          const aTime = new Date(a.closedAt || a.verifiedAt || a.createdAt).getTime();
          const bTime = new Date(b.closedAt || b.verifiedAt || b.createdAt).getTime();
          return bTime - aTime;
        });

      const finished =
        finishedCandidates.find((row) => row.status === 'kapatildi') ?? finishedCandidates[0];

      if (open?.id) {
        setActivePkg(await rmaApi.getPackage(open.id));
      } else {
        setActivePkg(null);
      }

      if (finished?.id) {
        const detail = await rmaApi.getPackage(finished.id);
        setClosedPkg(detail);
        setScanMatched(Boolean(detail.verifiedAt) || detail.status === 'sevke_hazir');
      } else {
        setClosedPkg(null);
        setScanMatched(false);
      }
    } catch {
      setActivePkg(null);
      setClosedPkg(null);
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

  useEffect(() => {
    if (!supplierItems.length) return;

    setBarcodesByProductId((prev) => {
      const next = { ...prev };
      for (const item of supplierItems) {
        if (isValidShipmentBarcodeNumber(item.product.barcodeNumber)) {
          next[item.productId] = item.product.barcodeNumber;
        }
      }
      return next;
    });

    const missingIds = supplierItems
      .filter((item) => !isValidShipmentBarcodeNumber(item.product.barcodeNumber))
      .map((item) => item.productId);

    if (!missingIds.length) return;

    let cancelled = false;
    setBarcodeLoading(true);
    setBarcodeErrors({});

    rmaApi
      .ensureShipmentBarcodes(missingIds)
      .then(({ barcodes }) => {
        if (cancelled) return;
        setBarcodesByProductId((prev) => ({ ...prev, ...barcodes }));
      })
      .catch((err) => {
        if (cancelled) return;
        const message = err instanceof Error ? err.message : 'Barkod numarası oluşturulamadı.';
        setBarcodeErrors((prev) => {
          const next = { ...prev };
          for (const productId of missingIds) {
            next[productId] = message;
          }
          return next;
        });
      })
      .finally(() => {
        if (!cancelled) setBarcodeLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [supplierItems]);

  const reloadAll = async () => {
    await Promise.all([refresh(), loadPackage()]);
  };

  const addToBox = async (item: SupplierItem) => {
    setBusyProductId(item.productId);
    try {
      animateLayout();
      if (!activePkg) {
        const created = await rmaApi.createPackage({
          supplierAccountCode: supplierCode,
          supplierName: item.supplierName,
          productIds: [item.productId],
        });
        setActivePkg(created);
      } else {
        const updated = await rmaApi.addPackageItems(activePkg.id, [item.productId]);
        setActivePkg(updated);
      }
      await refresh();
    } catch (err) {
      appAlert('Koliye eklenemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setBusyProductId(null);
    }
  };

  const removeFromBox = async (productId: number) => {
    if (!activePkg) return;
    const itemId = inBoxMap.get(productId);
    if (!itemId) return;

    setBusyProductId(productId);
    try {
      animateLayout();
      const updated = await rmaApi.removePackageItem(activePkg.id, itemId);
      setActivePkg(updated.items.length ? updated : null);
      await refresh();
    } catch (err) {
      appAlert('Koliden çıkarılamadı', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setBusyProductId(null);
    }
  };

  const closeBox = async () => {
    if (!activePkg) return;
    setClosing(true);
    try {
      animateLayout();
      const updated = await rmaApi.closePackage(activePkg.id);
      setClosedPkg(updated);
      setActivePkg(null);
      setScanMatched(false);
      setLastScannedValue(null);
      appAlert('Koli kapatıldı', 'Barkod atandı. Etiketi yazdırıp tarayarak doğrulayabilirsiniz.');
    } catch (err) {
      appAlert('Koli kapatılamadı', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setClosing(false);
    }
  };

  const handlePrintProductBarcode = async (productId: number, barcodeNumber: string) => {
    if (printingProductId === productId || printing) return;
    setPrintingProductId(productId);
    try {
      const normalized = requireShipmentBarcodeNumber(barcodeNumber);
      const result = await printProductBarcodeDirect(normalized);
      if (result.fitWarning) {
        appAlert('Bilgi', result.fitWarning);
      }
      appAlert('Başarılı', 'Barkod etiketi yazdırıldı.');
    } catch (err) {
      appAlert(
        'Yazdırma başarısız',
        err instanceof NiimbotPrinterError ? err.message : err instanceof Error ? err.message : 'Bilinmeyen hata',
      );
    } finally {
      setPrintingProductId(null);
    }
  };

  const handlePrint = async () => {
    if (printing || printingProductId !== null) return;
    const labelPkg = closedPkg ?? activePkg;
    const scanValue = labelPkg?.barcodeValue || labelPkg?.qrValue;
    if (!scanValue) return;
    setPrinting(true);
    try {
      if (shouldUseNiimbotDirectPrint()) {
        const result = await printPackageBarcodeDirect(scanValue);
        if (result.fitWarning) {
          appAlert('Bilgi', result.fitWarning);
        }
        appAlert('Başarılı', 'Koli barkod etiketi yazdırıldı.');
      } else {
        await printPackageLabel(labelPkg);
      }
    } catch (err) {
      appAlert(
        'Yazdırma başarısız',
        err instanceof NiimbotPrinterError ? err.message : err instanceof Error ? err.message : 'Bilinmeyen hata',
      );
    } finally {
      setPrinting(false);
    }
  };

  const handleShareLabel = async () => {
    const labelPkg = closedPkg ?? activePkg;
    if (!labelPkg) return;
    try {
      await sharePackageLabelPdf(labelPkg);
    } catch (err) {
      appAlert('Etiket paylaşılamadı', err instanceof Error ? err.message : 'Bilinmeyen hata');
    }
  };

  const handleScan = async (rawValue: string) => {
    if (!closedPkg) {
      playScanError();
      appAlert('Koli yok', 'Doğrulanacak kapalı koli bulunamadı.');
      return;
    }

    const expectedToken = closedPkg.barcodeValue || closedPkg.qrValue;
    if (expectedToken && scanValuesMatchAny(rawValue, [expectedToken])) {
      playScanSuccess();
      setScanMatched(true);
      setLastScannedValue(expectedToken);
      setScanOpen(false);
      appAlert('Barkod doğrulandı', 'Koli etiketi eşleşti. Sevkiyata hazır işlemini tamamlayabilirsiniz.');
      return;
    }

    try {
      const found = await rmaApi.lookupPackage(normalizeLookupScan(rawValue));
      if (found.id !== closedPkg.id) {
        playScanError();
        appAlert('Barkod eşleşmedi', 'Okunan barkod bu koliye ait değil.');
        return;
      }

      playScanSuccess();
      setScanMatched(true);
      setLastScannedValue(found.barcodeValue || found.qrValue || normalizeScannedBarcode(rawValue));
      setScanOpen(false);
      setClosedPkg(found);
      appAlert('Barkod doğrulandı', 'Koli etiketi eşleşti. Sevkiyata hazır işlemini tamamlayabilirsiniz.');
    } catch {
      playScanError();
      appAlert('Barkod eşleşmedi', 'Okunan barkod bu koliye ait değil.');
    }
  };

  const markReadyToShip = async () => {
    const scanValue =
      lastScannedValue || closedPkg?.barcodeValue || closedPkg?.qrValue;
    if (!scanValue) return;
    setVerifying(true);
    try {
      animateLayout();
      const updated = await rmaApi.verifyPackageBarcode(scanValue);
      setClosedPkg(updated);
      setLastScannedValue(null);
      appAlert('Sevkiyata hazır', 'Koli sevkiyat için hazırlandı.');
    } catch (err) {
      appAlert('Doğrulama başarısız', err instanceof Error ? err.message : 'Bilinmeyen hata');
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

  const isClosed = closedPkg?.status === 'kapatildi';
  const isReady = closedPkg?.status === 'sevke_hazir';
  const boxCount = activePkg?.items?.length ?? 0;
  const labelSequence = parsePackageLabelSequence(closedPkg?.barcodeValue || activePkg?.barcodeValue);

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
                <Text style={styles.statusTitle}>
                  {activePkg ? activePkg.packageNumber : closedPkg ? closedPkg.packageNumber : 'Aktif koli yok'}
                </Text>
                <Text style={styles.statusHint}>
                  {activePkg
                    ? `${statusLabel(activePkg.status)} · ${boxCount} ürün kolide`
                    : closedPkg
                      ? statusLabel(closedPkg.status)
                      : 'Koliye eklediğinizde otomatik oluşturulur'}
                </Text>
              </View>
            </View>
            {(closedPkg?.barcodeValue || activePkg?.barcodeValue) ? (
              <>
                {labelSequence ? (
                  <Text style={styles.sequenceBadge}>Koli sıra no: {labelSequence}/9</Text>
                ) : null}
                <Text style={styles.barcodeValue}>{closedPkg?.barcodeValue || activePkg?.barcodeValue}</Text>
              </>
            ) : null}
          </Card>

          <Text style={styles.sectionTitle}>Tedarikçi Ürünleri</Text>
          <View style={styles.list}>
            {supplierItems.map((item) => {
              const inBox = inBoxMap.has(item.productId);
              const busy = busyProductId === item.productId;
              const rawBarcode = barcodesByProductId[item.productId] ?? item.product.barcodeNumber ?? null;
              const barcodeNumber = isValidShipmentBarcodeNumber(rawBarcode) ? rawBarcode : null;

              return (
                <View key={item.id} style={styles.rowWrap}>
                  <SupplierProductRow
                    item={item}
                    onOpen={() => router.push(`/supplier/product/${item.id}` as never)}
                    trailing={
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
                    }
                  />
                  <ShipmentProductBarcode
                    barcodeNumber={barcodeNumber}
                    loading={barcodeLoading && !barcodeNumber}
                    error={barcodeErrors[item.productId]}
                    printing={printingProductId === item.productId}
                    disabled={printing || (printingProductId !== null && printingProductId !== item.productId)}
                    onPrint={
                      barcodeNumber
                        ? () => handlePrintProductBarcode(item.productId, barcodeNumber)
                        : undefined
                    }
                  />
                </View>
              );
            })}
          </View>

          {activePkg && boxCount > 0 ? (
            <View style={styles.actions}>
              <PrimaryAction
                icon="lock-closed-outline"
                label={closing ? 'Kapatılıyor…' : 'Koliyi Kapat ve Barkod Ata'}
                onPress={closeBox}
                disabled={closing}
              />
            </View>
          ) : null}

          {closedPkg && (closedPkg.barcodeValue || closedPkg.qrValue) ? (
            <View style={styles.actions}>
              <SecondaryAction
                icon="print-outline"
                label={printing ? 'Yazdırılıyor…' : 'Koli Barkodu Yazdır'}
                onPress={handlePrint}
                disabled={printing || printingProductId !== null}
              />
              <SecondaryAction icon="share-outline" label="Etiket PDF Paylaş" onPress={handleShareLabel} />
              {!isReady ? (
                <SecondaryAction icon="scan-outline" label="Barkodu Tara" onPress={() => setScanOpen(true)} />
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
        scanMode="package"
        expectedValue={closedPkg?.barcodeValue || closedPkg?.qrValue}
        onClose={() => setScanOpen(false)}
        onScanned={(value) => void handleScan(value)}
        onScanRejected={(msg) => appAlert('Geçersiz barkod', msg)}
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
  sequenceBadge: {
    ...typography.caption,
    color: colors.primaryDark,
    fontWeight: '800',
    alignSelf: 'flex-start',
    backgroundColor: colors.primarySoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  sectionTitle: { ...typography.bodyMedium, color: colors.textSecondary, marginTop: spacing.sm },
  list: { gap: spacing.sm },
  rowWrap: { gap: 0, marginBottom: spacing.sm },
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
