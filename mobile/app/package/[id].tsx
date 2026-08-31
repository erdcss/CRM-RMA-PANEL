import { useCallback, useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { LoadingState } from '@/components/ui/LoadingState';
import { Screen } from '@/components/ui/Screen';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { rmaApi } from '@/lib/api';

const RESULT_TYPES = [
  { value: 'tamir_edildi', label: 'Tamir Edildi' },
  { value: 'degistirildi', label: 'Degistirildi' },
  { value: 'reddedildi', label: 'Reddedildi' },
  { value: 'iade_kabul', label: 'Iade Kabul' },
  { value: 'iade_red', label: 'Iade Red' },
];

export default function PackageDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const packageId = Number(id);
  const [pkg, setPkg] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [resultDrafts, setResultDrafts] = useState<Record<number, { type: string; serial: string }>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await rmaApi.getPackage(packageId);
      setPkg(data);
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Yuklenemedi');
    } finally {
      setLoading(false);
    }
  }, [packageId]);

  useEffect(() => {
    if (packageId) reload();
  }, [packageId, reload]);

  const runAction = async (label: string, fn: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await fn();
      await reload();
      Alert.alert('Basarili', label);
    } catch (err) {
      Alert.alert('Hata', err instanceof Error ? err.message : 'Islem basarisiz');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <LoadingState />;
  if (!pkg) return <Screen><Text style={styles.error}>Koli bulunamadi</Text></Screen>;

  return (
    <Screen>
      <AppHeader title={pkg.packageNumber} onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <Card>
          <Text style={styles.title}>{pkg.supplierName}</Text>
          <Text style={styles.meta}>Durum: {pkg.status}</Text>
          <Text style={styles.meta}>Urun: {pkg.productCount}</Text>
        </Card>

        {pkg.status === 'sevk_edildi' && (
          <Pressable
            style={styles.actionBtn}
            disabled={busy}
            onPress={() => runAction('Tedarikciye ulasildi', () => rmaApi.markDeliveredToSupplier(packageId))}
          >
            <Text style={styles.actionText}>Tedarikciye Ulasti</Text>
          </Pressable>
        )}

        {pkg.status === 'tedarikcide' && (
          <Pressable
            style={styles.actionBtn}
            disabled={busy}
            onPress={() => runAction('Geri dondu', () => rmaApi.markPackageReturned(packageId))}
          >
            <Text style={styles.actionText}>Geri Dondu</Text>
          </Pressable>
        )}

        {(pkg.status === 'geri_dondu' || pkg.status === 'tamamlandi') && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Tedarikci Sonuclari</Text>
            {(pkg.items ?? []).map((item: any) => {
              const draft = resultDrafts[item.productId] || { type: 'tamir_edildi', serial: '' };
              const p = item.product;
              return (
                <Card key={item.id} style={styles.itemCard}>
                  <Text style={styles.itemName}>{p?.name}</Text>
                  <Text style={styles.meta}>SN: {p?.serialNumber || '-'}</Text>
                  {item.supplierResult && (
                    <Text style={styles.meta}>Sonuc: {item.supplierResult.resultType}</Text>
                  )}
                  <View style={styles.row}>
                    {RESULT_TYPES.map((t) => (
                      <Pressable
                        key={t.value}
                        style={[styles.chip, draft.type === t.value && styles.chipActive]}
                        onPress={() =>
                          setResultDrafts((prev) => ({
                            ...prev,
                            [item.productId]: { ...draft, type: t.value },
                          }))
                        }
                      >
                        <Text style={styles.chipText}>{t.label}</Text>
                      </Pressable>
                    ))}
                  </View>
                  {draft.type === 'degistirildi' && (
                    <TextInput
                      style={styles.input}
                      placeholder="Yeni seri no"
                      value={draft.serial}
                      onChangeText={(v) =>
                        setResultDrafts((prev) => ({
                          ...prev,
                          [item.productId]: { ...draft, serial: v },
                        }))
                      }
                    />
                  )}
                  <Pressable
                    style={styles.smallBtn}
                    disabled={busy}
                    onPress={() =>
                      runAction('Sonuc kaydedildi', () =>
                        rmaApi.saveSupplierResult(item.productId, {
                          packageId,
                          resultType: draft.type,
                          newSerialNumber: draft.serial || undefined,
                        }),
                      )
                    }
                  >
                    <Text style={styles.actionText}>Sonuc Kaydet</Text>
                  </Pressable>
                  {p?.category === 'servis' && item.supplierResult?.resultType === 'tamir_edildi' && (
                    <Pressable
                      style={[styles.smallBtn, styles.secondaryBtn]}
                      disabled={busy}
                      onPress={() =>
                        runAction('Musteriye teslim', () =>
                          rmaApi.deliverToCustomer(item.productId, { receiverName: 'Musteri' }),
                        )
                      }
                    >
                      <Text style={styles.actionText}>Musteriye Teslim</Text>
                    </Pressable>
                  )}
                </Card>
              );
            })}
          </View>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxl },
  title: { ...typography.subtitle, marginBottom: spacing.xs },
  meta: { ...typography.caption, color: colors.textMuted },
  actionBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  actionText: { color: '#fff', fontWeight: '600' },
  section: { gap: spacing.sm },
  sectionTitle: { ...typography.subtitle },
  itemCard: { gap: spacing.sm },
  itemName: { fontWeight: '600' },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primary + '15' },
  chipText: { fontSize: 11 },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.sm,
  },
  smallBtn: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.sm,
    alignItems: 'center',
  },
  secondaryBtn: { backgroundColor: colors.success },
  error: { padding: spacing.lg, color: colors.danger },
});
