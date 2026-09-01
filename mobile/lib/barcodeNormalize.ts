import {
  cleanRawScanValue,
  expandScanLookupValues,
  parseShipmentBarcodeFromScan,
} from '@shared/shipment-barcode';

export { expandScanLookupValues, parseShipmentBarcodeFromScan };

/** GS1 / Code128 prefix and common scanner noise cleanup. */
export function normalizeScannedBarcode(raw: string): string {
  return cleanRawScanValue(raw);
}

/** Normalize product shipment scans (9-digit / EAN-13 / leading-zero loss). */
export function normalizeProductBarcodeScan(raw: string): string {
  const cleaned = normalizeScannedBarcode(raw);
  return parseShipmentBarcodeFromScan(cleaned) ?? cleaned;
}

/** Best single value for package/product lookup after a scan. */
export function normalizeLookupScan(raw: string): string {
  const candidates = expandScanLookupValues(raw);
  return candidates[0] ?? normalizeScannedBarcode(raw);
}

export function barcodesMatch(a: string, b: string): boolean {
  const leftValues = new Set(expandScanLookupValues(a));
  const rightValues = expandScanLookupValues(b);
  if (rightValues.some((value) => leftValues.has(value))) return true;
  return normalizeScannedBarcode(a) === normalizeScannedBarcode(b);
}

export function scanValuesMatchAny(scanned: string, expectedValues: Array<string | null | undefined>): boolean {
  const scannedSet = new Set(expandScanLookupValues(scanned));
  for (const expected of expectedValues) {
    if (!expected) continue;
    for (const candidate of expandScanLookupValues(expected)) {
      if (scannedSet.has(candidate)) return true;
    }
  }
  return false;
}
