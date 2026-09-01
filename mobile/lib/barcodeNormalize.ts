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

export function barcodesMatch(a: string, b: string): boolean {
  return normalizeScannedBarcode(a) === normalizeScannedBarcode(b);
}
