export const SHIPMENT_BARCODE_LENGTH = 9;

const NINE_DIGITS = /^\d{9}$/;

/** Shipment label barcode: exactly 9 digits, stored as string (leading zeros allowed). */
export function isValidShipmentBarcodeNumber(value: string | null | undefined): value is string {
  return typeof value === "string" && NINE_DIGITS.test(value);
}

export function normalizeShipmentBarcodeNumber(value: string): string {
  return value.replace(/\s/g, "");
}
