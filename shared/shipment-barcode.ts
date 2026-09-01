export const SHIPMENT_BARCODE_LENGTH = 9;
/** Yazdırılan ürün etiketi: Code 128 içeriği = tam 9 haneli benzersiz rakam (EAN/QR değil). */
export const SHIPMENT_BARCODE_FORMAT = "CODE128" as const;

const NINE_DIGITS = /^\d{9}$/;

export const SHIPMENT_EAN13_PREFIX = "869";

/** Shipment label barcode: exactly 9 digits, stored as string (leading zeros allowed). */
export function isValidShipmentBarcodeNumber(value: string | null | undefined): value is string {
  return typeof value === "string" && NINE_DIGITS.test(value);
}

export function normalizeShipmentBarcodeNumber(value: string): string {
  return value.replace(/\s/g, "");
}

export function cleanRawScanValue(raw: string): string {
  return raw
    .trim()
    .replace(/^\][A-Za-z0-9]{1,3}/, "")
    .replace(/\u001d/g, "")
    .replace(/\s/g, "");
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
  const cleaned = cleanRawScanValue(raw);
  if (!cleaned) return null;

  if (NINE_DIGITS.test(cleaned)) {
    return cleaned;
  }

  if (/^\d{1,8}$/.test(cleaned)) {
    return cleaned.padStart(SHIPMENT_BARCODE_LENGTH, "0");
  }

  // EAN-13 body without check digit: 869 + 9 digits
  if (/^869\d{9}$/.test(cleaned)) {
    const nine = cleaned.slice(3);
    return NINE_DIGITS.test(nine) ? nine : null;
  }

  // Full EAN-13 with check digit
  if (/^869\d{10}$/.test(cleaned)) {
    const nine = cleaned.slice(3, 12);
    return NINE_DIGITS.test(nine) ? nine : null;
  }

  return null;
}

/** All lookup variants to try after a camera / scanner read. */
export function expandScanLookupValues(raw: string): string[] {
  const cleaned = cleanRawScanValue(raw);
  if (!cleaned) return [];

  const values = new Set<string>([cleaned]);

  const shipment = parseShipmentBarcodeFromScan(cleaned);
  if (shipment) {
    values.add(shipment);
    values.add(`${SHIPMENT_EAN13_PREFIX}${shipment}`);
    try {
      values.add(toShipmentEan13(shipment));
    } catch {
      // ignore invalid conversion
    }
  }

  if (/^\d{1,8}$/.test(cleaned)) {
    values.add(cleaned.padStart(SHIPMENT_BARCODE_LENGTH, "0"));
  }

  return [...values];
}
