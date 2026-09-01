import { useCallback, useRef, useState } from 'react';
import { Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';

import { MOBILE_SCAN_CODE128_TYPES, normalizeBarcodeScan, type BarcodeScanMode } from '@shared/barcode-scan';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { scanValuesMatchAny } from '@/lib/barcodeNormalize';

const SCAN_COOLDOWN_MS = 1500;

type BarcodeScannerModalProps = {
  visible: boolean;
  title?: string;
  hint?: string;
  expectedValue?: string | null;
  scanMode?: BarcodeScanMode;
  onClose: () => void;
  onScanned: (value: string) => void;
  onScanRejected?: (message: string) => void;
};

export function BarcodeScannerModal({
  visible,
  title = 'Barkod Tara',
  hint = 'Code 128 barkodu çerçeveye hizalayın',
  expectedValue,
  scanMode = 'lookup',
  onClose,
  onScanned,
  onScanRejected,
}: BarcodeScannerModalProps) {
  const [permission, requestPermission] = useCameraPermissions();
  const [lastValue, setLastValue] = useState<string | null>(null);
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const handleScan = useCallback(
    ({ data }: BarcodeScanningResult) => {
      const parsed = normalizeBarcodeScan(data ?? '', scanMode);
      if (!parsed.valid) {
        onScanRejected?.(parsed.error ?? 'Geçersiz barkod');
        return;
      }
      const value = parsed.value;
      if (!value) return;

      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.code === value && now - last.at < SCAN_COOLDOWN_MS) return;

      lastScanRef.current = { code: value, at: now };
      setLastValue(value);
      onScanned(value);
    },
    [onScanned, onScanRejected, scanMode],
  );

  const requestAccess = async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Linking.openSettings().catch(() => undefined);
    }
  };

  const matchesExpected = expectedValue && lastValue ? scanValuesMatchAny(lastValue, [expectedValue]) : false;

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="fullScreen" onRequestClose={onClose}>
      <View style={styles.root}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Pressable style={styles.close} onPress={onClose}>
            <Ionicons name="close" size={26} color={colors.surface} />
          </Pressable>
        </View>

        {!permission?.granted ? (
          <View style={styles.placeholder}>
            <Ionicons name="camera-outline" size={40} color={colors.textMuted} />
            <Text style={styles.placeholderText}>Kamera izni gerekli</Text>
            <Pressable style={styles.permissionBtn} onPress={() => void requestAccess()}>
              <Text style={styles.permissionBtnText}>İzin Ver</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.cameraWrap}>
            <CameraView
              style={styles.camera}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: [...MOBILE_SCAN_CODE128_TYPES] }}
              onBarcodeScanned={handleScan}
            />
            <View style={styles.overlay} pointerEvents="none">
              <View style={styles.frame} />
              <Text style={styles.hint}>{hint}</Text>
            </View>
          </View>
        )}

        {lastValue ? (
          <View style={[styles.result, matchesExpected && styles.resultOk]}>
            <Ionicons
              name={matchesExpected ? 'checkmark-circle' : 'barcode-outline'}
              size={20}
              color={matchesExpected ? colors.success : colors.text}
            />
            <Text style={styles.resultText}>{lastValue}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#000' },
  header: {
    paddingTop: spacing.xxxl,
    paddingHorizontal: spacing.lg,
    paddingBottom: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  title: { ...typography.subtitle, color: colors.surface },
  close: {
    width: minTouchTarget,
    height: minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cameraWrap: { flex: 1, position: 'relative' },
  camera: { flex: 1 },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  frame: {
    width: 240,
    height: 140,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  hint: { ...typography.caption, color: '#FFFFFF', textAlign: 'center', paddingHorizontal: spacing.xl },
  placeholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  placeholderText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  permissionBtn: {
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionBtnText: { ...typography.bodyMedium, color: colors.surface, fontWeight: '700' },
  result: {
    margin: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  resultOk: { backgroundColor: colors.successSoft },
  resultText: { ...typography.caption, color: colors.text, flex: 1, fontWeight: '600' },
});
