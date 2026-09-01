import { useCallback, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

import { AppHeader } from '@/components/ui/AppHeader';
import { Screen } from '@/components/ui/Screen';
import { colors, minTouchTarget, radius, spacing, typography } from '@/constants/theme';
import { rmaApi } from '@/lib/api';
import { normalizeScannedBarcode } from '@/lib/barcodeNormalize';
import { playScanError, playScanSuccess } from '@/lib/scanFeedback';

const BARCODE_TYPES = [
  'qr',
  'code128',
  'code39',
  'code93',
  'ean13',
  'ean8',
  'upc_a',
  'upc_e',
  'pdf417',
  'datamatrix',
] as const;

const SCAN_COOLDOWN_MS = 2500;

export default function PackageScanScreen() {
  const router = useRouter();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [permission, requestPermission] = useCameraPermissions();
  const lastScanRef = useRef<{ code: string; at: number } | null>(null);

  const lookup = useCallback(
    async (value?: string) => {
      const q = (value ?? code).trim();
      if (!q || loading) return;

      setLoading(true);
      setCameraEnabled(false);
      try {
        const pkg = await rmaApi.lookupPackage(q);
        playScanSuccess();
        router.push(`/package/${pkg.id}`);
      } catch (err) {
        playScanError();
        Alert.alert('Koli bulunamadi', err instanceof Error ? err.message : 'Bilinmeyen hata');
        setCameraEnabled(true);
      } finally {
        setLoading(false);
      }
    },
    [code, loading, router],
  );

  const handleBarcodeScanned = useCallback(
    ({ data }: BarcodeScanningResult) => {
      const value = normalizeScannedBarcode(data ?? '');
      if (!value || loading || !cameraEnabled) return;

      const now = Date.now();
      const last = lastScanRef.current;
      if (last && last.code === value && now - last.at < SCAN_COOLDOWN_MS) return;

      lastScanRef.current = { code: value, at: now };
      setCode(value);
      void lookup(value);
    },
    [cameraEnabled, loading, lookup],
  );

  const handlePermission = async () => {
    const result = await requestPermission();
    if (!result.granted) {
      Alert.alert(
        'Kamera izni gerekli',
        'Barkod taramak için kamera erişimine izin verin.',
        [
          { text: 'Vazgeç', style: 'cancel' },
          { text: 'Ayarlar', onPress: () => void Linking.openSettings() },
        ],
      );
    }
  };

  const renderCamera = () => {
    if (!permission) {
      return (
        <View style={styles.cameraPlaceholder}>
          <Text style={styles.cameraPlaceholderText}>Kamera hazırlanıyor…</Text>
        </View>
      );
    }

    if (!permission.granted) {
      return (
        <View style={styles.cameraPlaceholder}>
          <Ionicons name="camera-outline" size={36} color={colors.textMuted} />
          <Text style={styles.cameraPlaceholderText}>Barkod taramak için kamera izni gerekli.</Text>
          <Pressable style={styles.permissionButton} onPress={() => void handlePermission()}>
            <Text style={styles.permissionButtonText}>Kamera İzni Ver</Text>
          </Pressable>
        </View>
      );
    }

    return (
      <View style={styles.cameraWrap}>
        <CameraView
          style={styles.camera}
          facing="back"
          barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
          onBarcodeScanned={cameraEnabled && !loading ? handleBarcodeScanned : undefined}
        />
        <View style={styles.cameraOverlay} pointerEvents="none">
          <View style={styles.overlayTop} />
          <View style={styles.overlayMiddle}>
            <View style={styles.overlaySide} />
            <View style={styles.scanFrame}>
              <View style={[styles.corner, styles.cornerTopLeft]} />
              <View style={[styles.corner, styles.cornerTopRight]} />
              <View style={[styles.corner, styles.cornerBottomLeft]} />
              <View style={[styles.corner, styles.cornerBottomRight]} />
            </View>
            <View style={styles.overlaySide} />
          </View>
          <View style={styles.overlayBottom}>
            <Text style={styles.scanHint}>
              {loading ? 'Koli aranıyor…' : 'Barkodu veya QR kodu çerçeveye hizalayın'}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  return (
    <Screen>
      <AppHeader title="Koli Tara" onBack={() => router.back()} />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        {renderCamera()}

        <View style={styles.manualSection}>
          <Text style={styles.sectionTitle}>Manuel Giriş</Text>
          <Text style={styles.hint}>Koli numarası, barkod veya QR kodu elle de girebilirsiniz.</Text>
          <TextInput
            style={styles.input}
            value={code}
            onChangeText={setCode}
            placeholder="Barkod / koli no"
            autoCapitalize="characters"
            autoCorrect={false}
            onSubmitEditing={() => lookup()}
            editable={!loading}
          />
          <Pressable
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={() => lookup()}
            disabled={loading}
          >
            <Text style={styles.buttonText}>{loading ? 'Aranıyor…' : 'Koli Bul'}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  scroll: {
    paddingBottom: spacing.xxxl,
    gap: spacing.lg,
  },
  cameraWrap: {
    height: 320,
    backgroundColor: '#000',
    overflow: 'hidden',
  },
  camera: {
    flex: 1,
  },
  cameraOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  overlayTop: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  overlayMiddle: {
    flexDirection: 'row',
    height: 180,
  },
  overlaySide: {
    flex: 1,
    backgroundColor: colors.overlay,
  },
  scanFrame: {
    width: 220,
    height: 180,
    position: 'relative',
  },
  corner: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderColor: '#FFFFFF',
  },
  cornerTopLeft: {
    top: 0,
    left: 0,
    borderTopWidth: 3,
    borderLeftWidth: 3,
  },
  cornerTopRight: {
    top: 0,
    right: 0,
    borderTopWidth: 3,
    borderRightWidth: 3,
  },
  cornerBottomLeft: {
    bottom: 0,
    left: 0,
    borderBottomWidth: 3,
    borderLeftWidth: 3,
  },
  cornerBottomRight: {
    bottom: 0,
    right: 0,
    borderBottomWidth: 3,
    borderRightWidth: 3,
  },
  overlayBottom: {
    flex: 1,
    backgroundColor: colors.overlay,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  scanHint: {
    ...typography.caption,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  cameraPlaceholder: {
    height: 320,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.md,
    padding: spacing.lg,
  },
  cameraPlaceholderText: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  permissionButton: {
    minHeight: minTouchTarget,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  permissionButtonText: {
    ...typography.bodyMedium,
    color: '#FFFFFF',
  },
  manualSection: {
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  sectionTitle: {
    ...typography.subtitle,
    color: colors.text,
  },
  hint: {
    ...typography.body,
    color: colors.textMuted,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    padding: spacing.md,
    fontSize: 16,
    minHeight: minTouchTarget,
    backgroundColor: colors.surface,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.md,
    padding: spacing.md,
    alignItems: 'center',
    minHeight: minTouchTarget,
    justifyContent: 'center',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
