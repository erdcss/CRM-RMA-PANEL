import { useCallback, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';

import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { printBarcodeDirect, shouldUseNiimbotDirectPrint } from '@/lib/niimbot/printBarcodeDirect';
import { NiimbotPrinterError } from '@/lib/niimbot/types';

type ShipmentProductBarcodeProps = {
  barcodeNumber?: string | null;
  loading?: boolean;
  error?: string | null;
  printing?: boolean;
  disabled?: boolean;
  onPrint?: () => void;
};

export function ShipmentProductBarcode({
  barcodeNumber,
  loading,
  error,
  printing,
  disabled,
  onPrint,
}: ShipmentProductBarcodeProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    if (!barcodeNumber) return;
    try {
      await Clipboard.setStringAsync(barcodeNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      Alert.alert('Kopyalanamadı', 'Barkod numarası kopyalanamadı.');
    }
  }, [barcodeNumber]);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>Barkod No</Text>
      <View style={styles.row}>
        {loading ? (
          <Text style={styles.loading}>Oluşturuluyor…</Text>
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : barcodeNumber ? (
          <Text style={styles.value} selectable>
            {barcodeNumber}
          </Text>
        ) : (
          <Text style={styles.placeholder}>—</Text>
        )}

        <Pressable
          style={[styles.copyBtn, (!barcodeNumber || loading) && styles.disabled]}
          onPress={handleCopy}
          disabled={!barcodeNumber || loading}
          accessibilityLabel="Barkod numarasını kopyala"
        >
          <Ionicons name="copy-outline" size={14} color={colors.primaryDark} />
          <Text style={styles.copyText}>Kopyala</Text>
        </Pressable>
      </View>

      {copied ? <Text style={styles.toast}>Barkod numarası kopyalandı.</Text> : null}

      {barcodeNumber && shouldUseNiimbotDirectPrint() && onPrint ? (
        <Pressable
          style={[styles.printBtn, (printing || disabled) && styles.disabled]}
          onPress={onPrint}
          disabled={printing || disabled}
        >
          <Ionicons name="print-outline" size={14} color={colors.primaryDark} />
          <Text style={styles.printText}>{printing ? 'Yazdırılıyor…' : 'Barkod Yazdır'}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const mono = Platform.OS === 'ios' ? 'Courier' : 'monospace';

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: spacing.md,
    marginBottom: spacing.sm,
    padding: spacing.sm,
    borderRadius: radius.sm,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.borderLight,
    gap: spacing.xs,
  },
  label: { ...typography.caption, color: colors.textMuted, fontWeight: '600' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  value: {
    flex: 1,
    fontFamily: mono,
    fontSize: 16,
    lineHeight: 20,
    fontWeight: '700',
    letterSpacing: 0.5,
    color: colors.text,
  },
  placeholder: { flex: 1, ...typography.body, color: colors.textMuted },
  loading: { flex: 1, ...typography.caption, color: colors.textSecondary },
  error: { flex: 1, ...typography.caption, color: colors.danger },
  copyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    minHeight: 32,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  copyText: { ...typography.caption, color: colors.primaryDark, fontWeight: '700' },
  toast: { ...typography.caption, color: colors.success, fontWeight: '600' },
  printBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    minHeight: minTouchTarget - 8,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: colors.primary,
    backgroundColor: colors.primarySoft,
    marginTop: spacing.xs,
  },
  printText: { ...typography.caption, color: colors.primaryDark, fontWeight: '700' },
  disabled: { opacity: 0.5 },
});
