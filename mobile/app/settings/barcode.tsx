import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { FormField } from '@/components/forms/FormField';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import {
  DEFAULT_BARCODE_SETTINGS,
  loadBarcodeSettings,
  saveBarcodeSettings,
  type BarcodeSettings,
} from '@/lib/barcodeSettings';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { printPackageLabel } from '@/lib/packageLabel';
import type { RmaPackage } from '@/lib/api';

const SAMPLE_PACKAGE: RmaPackage = {
  id: 42,
  packageNumber: 'RMA-KOLI-2026-000001',
  supplierAccountCode: '111119',
  supplierName: 'Örnek Tedarikçi',
  status: 'kapatildi',
  barcodeValue: 'RMA-111119-S3-P42-DEMO1234',
  qrValue: 'RMA-111119-S3-P42-DEMO1234',
  createdAt: new Date().toISOString(),
  closedAt: new Date().toISOString(),
  items: [
    {
      id: 1,
      packageId: 42,
      productId: 101,
      quantity: 1,
      product: { id: 101, name: 'Örnek Ürün A', brand: 'Marka', category: 'iade', status: 'tedarikciye_hazir', stockCode: 'STK-001' },
    },
    {
      id: 2,
      packageId: 42,
      productId: 102,
      quantity: 2,
      product: { id: 102, name: 'Örnek Ürün B', brand: 'Marka', category: 'servis', status: 'tedarikciye_hazir', stockCode: 'STK-002' },
    },
  ],
  productCount: 2,
  totalQuantity: 3,
};

export default function BarcodeSettingsScreen() {
  const router = useRouter();
  const [draft, setDraft] = useState<BarcodeSettings>(DEFAULT_BARCODE_SETTINGS);
  const [saving, setSaving] = useState(false);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    loadBarcodeSettings().then(setDraft).catch(() => undefined);
  }, []);

  const update = (key: keyof BarcodeSettings, value: string) => {
    const num = Number(value.replace(',', '.'));
    if (!Number.isFinite(num)) return;
    setDraft((prev) => ({ ...prev, [key]: num }));
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveBarcodeSettings(draft);
      Alert.alert('Kaydedildi', 'Barkod etiket ayarları güncellendi.');
    } catch (err) {
      Alert.alert('Kaydedilemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setSaving(false);
    }
  };

  const preview = async () => {
    setPreviewing(true);
    try {
      await saveBarcodeSettings(draft);
      await printPackageLabel(SAMPLE_PACKAGE);
    } catch (err) {
      Alert.alert('Önizleme başarısız', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader title="Barkod Ayarları" subtitle="Etiket boyutu ve yazdırma" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Etiket Boyutları (mm)</Text>
          <FormField
            label="Etiket Genişliği"
            value={String(draft.labelWidthMm)}
            onChangeText={(v) => update('labelWidthMm', v)}
            keyboardType="decimal-pad"
          />
          <FormField
            label="Etiket Yüksekliği"
            value={String(draft.labelHeightMm)}
            onChangeText={(v) => update('labelHeightMm', v)}
            keyboardType="decimal-pad"
          />
          <FormField
            label="QR Kod Boyutu (mm)"
            value={String(draft.qrSizeMm)}
            onChangeText={(v) => update('qrSizeMm', v)}
            keyboardType="decimal-pad"
          />
          <FormField
            label="Barkod Yazı Boyutu (pt)"
            value={String(draft.barcodeFontPt)}
            onChangeText={(v) => update('barcodeFontPt', v)}
            keyboardType="decimal-pad"
          />
        </Card>

        <Text style={styles.hint}>
          Ayarlar koli etiketi yazdırırken uygulanır. Önizleme ile test edebilirsiniz.
        </Text>

        <Pressable style={[styles.previewBtn, previewing && styles.disabled]} onPress={preview} disabled={previewing}>
          <Ionicons name="print-outline" size={18} color={colors.primaryDark} />
          <Text style={styles.previewText}>{previewing ? 'Yazdırılıyor…' : 'Örnek Etiket Yazdır'}</Text>
        </Pressable>

        <Pressable style={[styles.saveBtn, saving && styles.disabled]} onPress={save} disabled={saving}>
          <Text style={styles.saveText}>{saving ? 'Kaydediliyor…' : 'Ayarları Kaydet'}</Text>
        </Pressable>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xxxl },
  card: { gap: spacing.md },
  cardTitle: { ...typography.subtitle, color: colors.text },
  hint: { ...typography.caption, color: colors.textMuted },
  previewBtn: {
    minHeight: minTouchTarget,
    borderWidth: 1,
    borderColor: colors.primary,
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  previewText: { ...typography.bodyMedium, color: colors.primaryDark, fontWeight: '700' },
  saveBtn: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { ...typography.bodyMedium, color: colors.surface, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
