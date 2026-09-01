import {
  clampBarcodeLabelSettings,
  NIIMBOT_D110M_PRESET,
  type BarcodeLabelSettings,
} from "@shared/barcode-label";

export type { BarcodeLabelSettings } from "@shared/barcode-label";
export {
  DEFAULT_BARCODE_NUMBER,
  NIIMBOT_D110M_PRESET,
  PRINTER_PROFILES,
  validateBarcodeNumber,
  validateProductBarcodeNumber,
  sanitizeBarcodeNumber,
  estimateBarcodeFit,
  clampBarcodeLabelSettings,
  resolveBarcodeHeightMm,
  resolveNumberFontSizePt,
} from "@shared/barcode-label";

const STORAGE_KEY = "rma-barcode-label-settings-v2";

export function loadBarcodeLabelSettings(): BarcodeLabelSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...NIIMBOT_D110M_PRESET };
    const parsed = JSON.parse(raw) as Partial<BarcodeLabelSettings>;
    return clampBarcodeLabelSettings(parsed);
  } catch {
    return { ...NIIMBOT_D110M_PRESET };
  }
}

export function saveBarcodeLabelSettings(settings: BarcodeLabelSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(clampBarcodeLabelSettings(settings)));
}

export function resetBarcodeLabelSettings(): BarcodeLabelSettings {
  const defaults = { ...NIIMBOT_D110M_PRESET };
  saveBarcodeLabelSettings(defaults);
  return defaults;
}

/** @deprecated Koli etiketi PDF ayarları — packageLabelSettings kullanın */
export { loadPackageLabelSettings as loadBarcodeSettings, savePackageLabelSettings as saveBarcodeSettings } from "./packageLabelSettings";
export { DEFAULT_PACKAGE_LABEL_SETTINGS as DEFAULT_BARCODE_SETTINGS } from "./packageLabelSettings";
export type { PackageLabelSettings as BarcodeSettings } from "./packageLabelSettings";
