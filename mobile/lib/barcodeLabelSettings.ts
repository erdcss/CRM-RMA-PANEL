import {
  NIIMBOT_D110M_PRESET,
  clampBarcodeLabelSettings,
  estimateBarcodeFit,
  sanitizeBarcodeNumber,
  validateBarcodeNumber,
  type BarcodeLabelSettings,
} from '@/lib/shared/barcode-label';

export type { BarcodeLabelSettings } from '@/lib/shared/barcode-label';
export {
  DEFAULT_BARCODE_NUMBER,
  NIIMBOT_D110M_PRESET,
  PRINTER_PROFILES,
  validateBarcodeNumber,
  sanitizeBarcodeNumber,
  estimateBarcodeFit,
  clampBarcodeLabelSettings,
  resolveBarcodeHeightMm,
  resolveNumberFontSizePt,
} from '@/lib/shared/barcode-label';

const STORAGE_KEY = 'rma-barcode-label-settings-v2';

export async function loadBarcodeLabelSettings(): Promise<BarcodeLabelSettings> {
  try {
    const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...NIIMBOT_D110M_PRESET };
    const parsed = JSON.parse(raw) as Partial<BarcodeLabelSettings>;
    return clampBarcodeLabelSettings(parsed);
  } catch {
    return { ...NIIMBOT_D110M_PRESET };
  }
}

export async function saveBarcodeLabelSettings(settings: BarcodeLabelSettings): Promise<void> {
  const AsyncStorage = (await import('@react-native-async-storage/async-storage')).default;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(clampBarcodeLabelSettings(settings)));
}

export async function resetBarcodeLabelSettings(): Promise<BarcodeLabelSettings> {
  const defaults = { ...NIIMBOT_D110M_PRESET };
  await saveBarcodeLabelSettings(defaults);
  return defaults;
}

export function validateBarcodeForPrint(value: string, settings: BarcodeLabelSettings = NIIMBOT_D110M_PRESET) {
  const cleaned = sanitizeBarcodeNumber(value);
  const validation = validateBarcodeNumber(cleaned);
  const fit = estimateBarcodeFit(cleaned, settings.labelWidthMm, settings.marginLeftMm, settings.marginRightMm);
  if (!fit.fits) {
    return {
      cleaned,
      validation,
      fit: {
        fits: false,
        warning: 'Bu barkod 40×12 mm etikette güvenilir şekilde okunamayabilir.',
      },
    };
  }
  return { cleaned, validation, fit };
}
