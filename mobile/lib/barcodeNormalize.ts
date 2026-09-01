import { parseShipmentBarcodeFromScan } from '@shared/shipment-barcode';

/** GS1 / Code128 prefix and common scanner noise cleanup. */
export function normalizeScannedBarcode(raw: string): string {
  let value = raw.trim();
  if (!value) return value;

  // GS1 symbology identifier (e.g. ]C1, ]Q3)
  value = value.replace(/^\][A-Za-z0-9]{1,3}/, '');

  // FNC1 separator (ASCII 29) sometimes embedded in scans
  value = value.replace(/\u001d/g, '');

  return value.trim();
}

/** Normalize product shipment scans (9-digit / EAN-13 / leading-zero loss). */
export function normalizeProductBarcodeScan(raw: string): string {
  const cleaned = normalizeScannedBarcode(raw);
  const shipment = parseShipmentBarcodeFromScan(cleaned);
  return shipment ?? cleaned;
}

export function barcodesMatch(a: string, b: string): boolean {
  const left = normalizeProductBarcodeScan(a);
  const right = normalizeProductBarcodeScan(b);
  if (left === right) return true;
  return normalizeScannedBarcode(a) === normalizeScannedBarcode(b);
}
