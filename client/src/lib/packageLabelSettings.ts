/** Koli / paket etiketi PDF ayarları (QR + ürün listesi). NIIMBOT ürün barkod etiketinden ayrı tutulur. */

export type PackageLabelSettings = {
  labelWidthMm: number;
  labelHeightMm: number;
  qrSizeMm: number;
  barcodeFontPt: number;
};

export const DEFAULT_PACKAGE_LABEL_SETTINGS: PackageLabelSettings = {
  labelWidthMm: 100,
  labelHeightMm: 150,
  qrSizeMm: 38,
  barcodeFontPt: 14,
};

const STORAGE_KEY = "rma-barcode-settings-v1";

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function loadPackageLabelSettings(): PackageLabelSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PACKAGE_LABEL_SETTINGS;
    const parsed = JSON.parse(raw) as Partial<PackageLabelSettings>;
    return {
      labelWidthMm: clamp(parsed.labelWidthMm ?? DEFAULT_PACKAGE_LABEL_SETTINGS.labelWidthMm, 70, 120),
      labelHeightMm: clamp(parsed.labelHeightMm ?? DEFAULT_PACKAGE_LABEL_SETTINGS.labelHeightMm, 100, 200),
      qrSizeMm: clamp(parsed.qrSizeMm ?? DEFAULT_PACKAGE_LABEL_SETTINGS.qrSizeMm, 24, 60),
      barcodeFontPt: clamp(parsed.barcodeFontPt ?? DEFAULT_PACKAGE_LABEL_SETTINGS.barcodeFontPt, 10, 22),
    };
  } catch {
    return DEFAULT_PACKAGE_LABEL_SETTINGS;
  }
}

export function savePackageLabelSettings(settings: PackageLabelSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}
