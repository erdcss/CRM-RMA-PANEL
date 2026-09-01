import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { NiimbotPrinterSection } from '@/components/niimbot/NiimbotPrinterSection';
import { FormField } from '@/components/forms/FormField';
import { AppHeader } from '@/components/ui/AppHeader';
import { Card } from '@/components/ui/Card';
import { Screen } from '@/components/ui/Screen';
import {
  DEFAULT_BARCODE_NUMBER,
  loadBarcodeLabelSettings,
  resetBarcodeLabelSettings,
  saveBarcodeLabelSettings,
  validateBarcodeForPrint,
  type BarcodeLabelSettings,
} from '@/lib/barcodeLabelSettings';
import { printProductBarcodeDirect, shouldUseNiimbotDirectPrint } from '@/lib/niimbot/printBarcodeDirect';
import { NiimbotPrinterError } from '@/lib/niimbot/types';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';

export default function BarcodeSettingsScreen() {
  const router = useRouter();
  const [settings, setSettings] = useState<BarcodeLabelSettings | null>(null);
  const [barcodeNumber, setBarcodeNumber] = useState(DEFAULT_BARCODE_NUMBER);
  const [saving, setSaving] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    loadBarcodeLabelSettings()
      .then(setSettings)
      .catch(() => undefined);
  }, []);

  if (!settings) {
    return (
      <Screen edges={['top', 'bottom']}>
        <AppHeader title="Barkod Ayarları" onBack={() => router.back()} />
      </Screen>
    );
  }

  const { validation, fit } = validateBarcodeForPrint(barcodeNumber, settings);

  const updateQuantity = (raw: string) => {
    const num = Number(raw.replace(',', '.'));
    if (!Number.isFinite(num)) return;
    setSettings((prev: BarcodeLabelSettings | null) => (prev ? { ...prev, quantity: num } : prev));
  };

  const save = async () => {
    setSaving(true);
    try {
      await saveBarcodeLabelSettings(settings);
      Alert.alert('Kaydedildi', 'Barkod etiket ayarları güncellendi.');
    } catch (err) {
      Alert.alert('Kaydedilemedi', err instanceof Error ? err.message : 'Bilinmeyen hata');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    const defaults = await resetBarcodeLabelSettings();
    setSettings(defaults);
    setBarcodeNumber(DEFAULT_BARCODE_NUMBER);
    Alert.alert('Varsayılana dönüldü');
  };

  const handlePrint = async () => {
    if (printing) return;
    if (!validation.valid) {
      Alert.alert('Geçersiz barkod', validation.error ?? 'Barkod numarası gerekli');
      return;
    }

    if (!shouldUseNiimbotDirectPrint()) {
      Alert.alert('iOS gerekli', 'NIIMBOT doğrudan yazdırma bu fazda yalnızca iOS içindir.');
      return;
    }

    setPrinting(true);
    try {
      await saveBarcodeLabelSettings(settings);
      const result = await printProductBarcodeDirect(barcodeNumber, { copies: settings.quantity });
      if (result.fitWarning) {
        Alert.alert('Uyarı', result.fitWarning);
      }
      Alert.alert('Başarılı', 'Barkod etiketi yazdırıldı.');
    } catch (err) {
      Alert.alert(
        'Yazdırma başarısız',
        err instanceof NiimbotPrinterError ? err.message : err instanceof Error ? err.message : 'Barkod yazdırılamadı.',
      );
    } finally {
      setPrinting(false);
    }
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <AppHeader title="Barkod Ayarları" subtitle="NIIMBOT D110-M · 40×12 mm" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.content}>
        <NiimbotPrinterSection />

        <Card style={styles.card}>
          <Text style={styles.cardTitle}>Etiket (NIIMBOT D110-M)</Text>
          <Text style={styles.preset}>40 × 12 mm · Code 128 · Yalnızca rakam</Text>

          <FormField
            label="Barkod Numarası"
            value={barcodeNumber}
            onChangeText={(v) => setBarcodeNumber(v.replace(/[^\d]/g, ''))}
            keyboardType="number-pad"
          />

          <FormField
            label="Baskı Adedi (1-100)"
            value={String(settings.quantity)}
            onChangeText={updateQuantity}
            keyboardType="number-pad"
          />

          {!validation.valid && validation.error ? (
            <Text style={styles.warn}>{validation.error}</Text>
          ) : null}
          {!fit.fits && fit.warning ? <Text style={styles.warn}>{fit.warning}</Text> : null}
        </Card>

        {Platform.OS === 'ios' ? (
          <Text style={styles.hint}>
            iOS AirPrint kullanılmaz. Barkod NIIMBOT JCAPI ile doğrudan D110-M yazıcıya gönderilir. Önce yazıcıyı Barkod Ayarlarından eşleştirin.
          </Text>
        ) : (
          <Text style={styles.hint}>Android NIIMBOT entegrasyonu bu fazda yapılmadı.</Text>
        )}

        <Pressable style={[styles.printBtn, printing && styles.disabled]} onPress={handlePrint} disabled={printing}>
          <Ionicons name="print-outline" size={18} color={colors.surface} />
          <Text style={styles.printText}>{printing ? 'Yazdırılıyor…' : 'Barkod Yazdır'}</Text>
        </Pressable>

        <Pressable style={styles.secondaryBtn} onPress={handleReset}>
          <Text style={styles.secondaryText}>Varsayılana Dön</Text>
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
  preset: { ...typography.caption, color: colors.textMuted },
  warn: { ...typography.caption, color: colors.warning },
  hint: { ...typography.caption, color: colors.textMuted },
  printBtn: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  printText: { ...typography.bodyMedium, color: colors.surface, fontWeight: '700' },
  secondaryBtn: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
  },
  secondaryText: { ...typography.bodyMedium, color: colors.text },
  saveBtn: {
    minHeight: minTouchTarget,
    borderRadius: radius.md,
    backgroundColor: colors.text,
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveText: { ...typography.bodyMedium, color: colors.surface, fontWeight: '700' },
  disabled: { opacity: 0.6 },
});
