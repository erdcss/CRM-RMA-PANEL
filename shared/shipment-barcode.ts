export const SHIPMENT_BARCODE_LENGTH = 9;
export const SHIPMENT_EAN13_PREFIX = "869";

const NINE_DIGITS = /^\d{9}$/;

/** Shipment label barcode: exactly 9 digits, stored as string (leading zeros allowed). */
export function isValidShipmentBarcodeNumber(value: string | null | undefined): value is string {
  return typeof value === "string" && NINE_DIGITS.test(value);
}

export function normalizeShipmentBarcodeNumber(value: string): string {
  return value.replace(/\s/g, "");
}

function ean13CheckDigit(twelveDigits: string): string {
  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const digit = Number(twelveDigits[i] ?? 0);
    sum += i % 2 === 0 ? digit : digit * 3;
  }
  return String((10 - (sum % 10)) % 10);
}

/** Encode 9-digit shipment barcode as scannable EAN-13 (869 prefix + check digit). */
export function toShipmentEan13(nineDigitBarcode: string): string {
  const cleaned = normalizeShipmentBarcodeNumber(nineDigitBarcode);
  if (!isValidShipmentBarcodeNumber(cleaned)) {
    throw new Error("Ürün barkodu 9 haneli olmalıdır.");
  }
  const body = `${SHIPMENT_EAN13_PREFIX}${cleaned}`;
  return `${body}${ean13CheckDigit(body)}`;
}

/** Resolve scanned value to internal 9-digit shipment barcode when possible. */
export function parseShipmentBarcodeFromScan(raw: string): string | null {
  const cleaned = raw.replace(/\s/g, "").replace(/^\][A-Za-z0-9]{1,3}/, "");
  if (!cleaned) return null;

  if (NINE_DIGITS.test(cleaned)) {
    return cleaned;
  }

  if (/^\d{1,8}$/.test(cleaned)) {
    return cleaned.padStart(SHIPMENT_BARCODE_LENGTH, "0");
  }

  if (/^869\d{10}$/.test(cleaned)) {
    const nine = cleaned.slice(3, 12);
    return NINE_DIGITS.test(nine) ? nine : null;
  }

  return null;
}
