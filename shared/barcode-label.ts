export type BarcodeType = "CODE128";
export type LabelOrientation = "landscape";
export type PrinterProfileId = "niimbot-d110m";

export type BarcodeLabelSettings = {
  printerProfile: PrinterProfileId;
  barcodeType: BarcodeType;
  labelWidthMm: number;
  labelHeightMm: number;
  orientation: LabelOrientation;
  showHumanReadable: boolean;
  quantity: number;
  marginLeftMm: number;
  marginRightMm: number;
  marginTopMm: number;
  marginBottomMm: number;
  /** 0 = auto */
  barcodeHeightMm: number;
  /** 0 = auto (pt) */
  numberFontSizePt: number;
  barcodeNumberGapMm: number;
  offsetXmm: number;
  offsetYmm: number;
};

export const DEFAULT_BARCODE_NUMBER = "123456789";

export const NIIMBOT_D110M_PRESET: BarcodeLabelSettings = {
  printerProfile: "niimbot-d110m",
  barcodeType: "CODE128",
  labelWidthMm: 40,
  labelHeightMm: 12,
  orientation: "landscape",
  showHumanReadable: true,
  quantity: 1,
  marginLeftMm: 1.5,
  marginRightMm: 1.5,
  marginTopMm: 0.6,
  marginBottomMm: 0.5,
  barcodeHeightMm: 0,
  numberFontSizePt: 0,
  barcodeNumberGapMm: 0.3,
  offsetXmm: 0,
  offsetYmm: 0,
};

export const PRINTER_PROFILES: Record<
  PrinterProfileId,
  { label: string; description: string; settings: BarcodeLabelSettings }
> = {
  "niimbot-d110m": {
    label: "NIIMBOT D110-M",
    description: "40 × 12 mm yatay termal etiket",
    settings: NIIMBOT_D110M_PRESET,
  },
};

export function sanitizeBarcodeNumber(raw: string): string {
  return raw.replace(/\s/g, "");
}

export function validateBarcodeNumber(value: string): { valid: boolean; error?: string } {
  return validateProductBarcodeNumber(value);
}

export function validateProductBarcodeNumber(value: string): { valid: boolean; error?: string } {
  const cleaned = sanitizeBarcodeNumber(value);
  if (/^RMA-/i.test(cleaned)) {
    return { valid: false, error: "Ürün barkodu RMA/koli formatında olamaz; 9 haneli rakam olmalıdır." };
  }
  if (!/^\d{9}$/.test(cleaned)) {
    return { valid: false, error: "Ürün barkodu tam 9 haneli rakam olmalıdır." };
  }
  return { valid: true };
}

export function validatePackageBarcodeValue(value: string): { valid: boolean; error?: string } {
  const cleaned = sanitizeBarcodeNumber(value);
  if (!cleaned) {
    return { valid: false, error: "Koli barkodu gerekli." };
  }
  if (/^RMA-/i.test(cleaned) || /[A-Za-z]/.test(cleaned)) {
    return { valid: false, error: "Koli barkodu yalnızca 9 haneli rakam olmalıdır; harf içeremez." };
  }
  if (!/^\d{9}$/.test(cleaned)) {
    return { valid: false, error: "Koli barkodu tam 9 haneli rakam olmalıdır." };
  }
  return { valid: true };
}

/** Rough Code 128 module estimate for fit warnings on narrow labels. */
export function estimateBarcodeFit(
  value: string,
  labelWidthMm: number,
  marginLeftMm: number,
  marginRightMm: number,
): { fits: boolean; warning?: string } {
  const cleaned = sanitizeBarcodeNumber(value);
  if (!cleaned) return { fits: true };

  const contentWidth = labelWidthMm - marginLeftMm - marginRightMm - 3;
  const estimatedModules = 35 + cleaned.length * 11;
  const minModuleWidthMm = 0.19;
  const estimatedWidthMm = estimatedModules * minModuleWidthMm;

  if (estimatedWidthMm > contentWidth) {
    return {
      fits: false,
      warning: `${cleaned.length} haneli barkod ${labelWidthMm} mm etikete sıkışık olabilir. Daha kısa numara deneyin veya gelişmiş ayarlardan boşlukları azaltın.`,
    };
  }
  return { fits: true };
}

export function estimatePackageBarcodeFit(
  value: string,
  labelWidthMm: number = NIIMBOT_D110M_PRESET.labelWidthMm,
  marginLeftMm: number = NIIMBOT_D110M_PRESET.marginLeftMm,
  marginRightMm: number = NIIMBOT_D110M_PRESET.marginRightMm,
): { fits: boolean; warning?: string } {
  return estimateBarcodeFit(value, labelWidthMm, marginLeftMm, marginRightMm);
}

export function clampBarcodeLabelSettings(input: Partial<BarcodeLabelSettings>): BarcodeLabelSettings {
  const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));
  const base = { ...NIIMBOT_D110M_PRESET, ...input };

  return {
    printerProfile: base.printerProfile === "niimbot-d110m" ? "niimbot-d110m" : "niimbot-d110m",
    barcodeType: "CODE128",
    labelWidthMm: clamp(base.labelWidthMm, 10, 100),
    labelHeightMm: clamp(base.labelHeightMm, 8, 100),
    orientation: "landscape",
    showHumanReadable: Boolean(base.showHumanReadable),
    quantity: clamp(Math.round(base.quantity), 1, 100),
    marginLeftMm: clamp(base.marginLeftMm, 0, 10),
    marginRightMm: clamp(base.marginRightMm, 0, 10),
    marginTopMm: clamp(base.marginTopMm, 0, 10),
    marginBottomMm: clamp(base.marginBottomMm, 0, 10),
    barcodeHeightMm: clamp(base.barcodeHeightMm, 0, 50),
    numberFontSizePt: clamp(base.numberFontSizePt, 0, 24),
    barcodeNumberGapMm: clamp(base.barcodeNumberGapMm, 0, 5),
    offsetXmm: clamp(base.offsetXmm, -5, 5),
    offsetYmm: clamp(base.offsetYmm, -5, 5),
  };
}

export function resolveBarcodeHeightMm(settings: BarcodeLabelSettings): number {
  if (settings.barcodeHeightMm > 0) return settings.barcodeHeightMm;
  const numberArea = settings.showHumanReadable ? 2.4 : 0;
  const gap = settings.showHumanReadable ? settings.barcodeNumberGapMm : 0;
  const available =
    settings.labelHeightMm - settings.marginTopMm - settings.marginBottomMm - numberArea - gap;
  return Math.max(4, Math.min(8.5, available));
}

export function resolveNumberFontSizePt(settings: BarcodeLabelSettings, digitCount: number): number {
  if (settings.numberFontSizePt > 0) return settings.numberFontSizePt;
  const contentWidth = settings.labelWidthMm - settings.marginLeftMm - settings.marginRightMm;
  const auto = 7.5 - Math.max(0, digitCount - 10) * 0.25;
  const maxByWidth = (contentWidth / Math.max(digitCount, 1)) * 2.2;
  return Math.max(5, Math.min(8, auto, maxByWidth));
}
