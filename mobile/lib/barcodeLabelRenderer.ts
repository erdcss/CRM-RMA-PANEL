import {
  NIIMBOT_D110M_PRESET,
  resolveBarcodeHeightMm,
  resolveNumberFontSizePt,
  sanitizeBarcodeNumber,
  type BarcodeLabelSettings,
} from '@/lib/shared/barcode-label';

/**
 * Label render plan for NIIMBOT SDK bitmap printing.
 * Pixel dimensions are resolved at print time once SDK/device DPI is known (native side).
 */
export type BarcodeLabelRenderPlan = {
  value: string;
  settings: BarcodeLabelSettings;
  widthMm: number;
  heightMm: number;
  barcodeHeightMm: number;
  numberFontPt: number;
  /** Populated by native SDK using device print resolution — not guessed in JS. */
  widthPx: number | null;
  heightPx: number | null;
  dpi: number | null;
  /** PNG base64 without data URI prefix — filled when renderer is implemented. */
  imageBase64: string | null;
};

export function buildBarcodeLabelRenderPlan(
  value: string,
  settings: BarcodeLabelSettings = NIIMBOT_D110M_PRESET,
): BarcodeLabelRenderPlan {
  const cleaned = sanitizeBarcodeNumber(value);
  return {
    value: cleaned,
    settings,
    widthMm: settings.labelWidthMm,
    heightMm: settings.labelHeightMm,
    barcodeHeightMm: resolveBarcodeHeightMm(settings),
    numberFontPt: resolveNumberFontSizePt(settings, cleaned.length),
    widthPx: null,
    heightPx: null,
    dpi: null,
    imageBase64: null,
  };
}

/**
 * Native NIIMBOT JCAPI (`drawLableBarCode`) renders Code 128 + digits on iOS.
 * JS bitmap renderer is unused when native module prints directly.
 */
export async function renderBarcodeLabelBitmap(
  value: string,
  settings: BarcodeLabelSettings = NIIMBOT_D110M_PRESET,
): Promise<BarcodeLabelRenderPlan> {
  const plan = buildBarcodeLabelRenderPlan(value, settings);
  // Native NIIMBOT SDK may accept raw value + dimensions instead of bitmap.
  // When SDK requires bitmap, implement renderer here or delegate to native Code128 API.
  return plan;
}
