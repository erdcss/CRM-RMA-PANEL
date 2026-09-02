import {
  cleanRawScanValue,
  isValidShipmentBarcodeNumber,
  parseShipmentBarcodeFromScan,
} from "./shipment-barcode";

/** Kamera yalnızca Code 128 okur — QR/EAN desteklenmez. */
export const MOBILE_SCAN_CODE128_TYPES = ["code128"] as const;

/** Web BarcodeDetector — yalnızca Code 128. */
export const WEB_SCAN_CODE128_FORMATS = ["code_128"] as const;

export type BarcodeScanMode = "product" | "package" | "lookup";

export function normalizeBarcodeScan(
  raw: string,
  mode: BarcodeScanMode,
): { value: string; valid: boolean; error?: string } {
  const cleaned = cleanRawScanValue(raw);
  if (!cleaned) {
    return { value: "", valid: false, error: "Boş barkod okundu." };
  }

  if (mode === "product") {
    const nine = parseShipmentBarcodeFromScan(cleaned);
    if (!nine || !isValidShipmentBarcodeNumber(nine)) {
      return {
        value: cleaned,
        valid: false,
        error: "Ürün barkodu Code 128 formatında tam 9 haneli rakam olmalıdır.",
      };
    }
    return { value: nine, valid: true };
  }

  if (mode === "package") {
    const nine = parseShipmentBarcodeFromScan(cleaned);
    if (nine && isValidShipmentBarcodeNumber(nine)) {
      return { value: nine, valid: true };
    }
    if (cleaned.length < 8 || cleaned.length > 64 || !/^[A-Za-z0-9\-_]+$/.test(cleaned)) {
      return {
        value: cleaned,
        valid: false,
        error: "Geçersiz koli barkodu (Code 128).",
      };
    }
    return { value: cleaned, valid: true };
  }

  return { value: cleaned, valid: true };
}
