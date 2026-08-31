import AsyncStorage from '@react-native-async-storage/async-storage';

const STORAGE_KEY = 'rma-barcode-settings-v1';

export type BarcodeSettings = {
  labelWidthMm: number;
  labelHeightMm: number;
  qrSizeMm: number;
  barcodeFontPt: number;
};

export const DEFAULT_BARCODE_SETTINGS: BarcodeSettings = {
  labelWidthMm: 100,
  labelHeightMm: 150,
  qrSizeMm: 38,
  barcodeFontPt: 14,
};

export async function loadBarcodeSettings(): Promise<BarcodeSettings> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_BARCODE_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<BarcodeSettings>;
    return {
      labelWidthMm: clamp(parsed.labelWidthMm ?? DEFAULT_BARCODE_SETTINGS.labelWidthMm, 70, 120),
      labelHeightMm: clamp(parsed.labelHeightMm ?? DEFAULT_BARCODE_SETTINGS.labelHeightMm, 100, 200),
      qrSizeMm: clamp(parsed.qrSizeMm ?? DEFAULT_BARCODE_SETTINGS.qrSizeMm, 24, 60),
      barcodeFontPt: clamp(parsed.barcodeFontPt ?? DEFAULT_BARCODE_SETTINGS.barcodeFontPt, 10, 22),
    };
  } catch {
    return DEFAULT_BARCODE_SETTINGS;
  }
}

export async function saveBarcodeSettings(settings: BarcodeSettings) {
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
