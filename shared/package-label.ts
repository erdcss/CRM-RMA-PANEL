export const MAX_PACKAGE_LABEL_SEQUENCE = 9;
export const MAX_PACKAGE_LABEL_ITEMS = 9;

const SEQ_PATTERN = /-S([1-9])-/;

export function parsePackageLabelSequence(barcodeValue?: string | null): number | null {
  if (!barcodeValue) return null;
  const match = barcodeValue.match(SEQ_PATTERN);
  if (!match) return null;
  const value = Number(match[1]);
  return value >= 1 && value <= MAX_PACKAGE_LABEL_SEQUENCE ? value : null;
}

export function buildPackageScanToken(
  supplierAccountCode: string,
  sequence: number,
  packageId: number,
  suffix: string,
): string {
  const code = supplierAccountCode.replace(/[^a-zA-Z0-9]/g, "");
  return `RMA-${code}-S${sequence}-P${packageId}-${suffix}`;
}

export type LabelProductRow = {
  slot: number;
  name: string;
  stockCode: string;
  quantity: number;
  receiptNumber?: string;
};

type LabelItemInput = {
  quantity?: number | null;
  product?: {
    name?: string | null;
    stockCode?: string | null;
    ticket?: { receiptNumber?: string | null };
  } | null;
};

export function buildLabelProductRows(items: LabelItemInput[]): LabelProductRow[] {
  return items.slice(0, MAX_PACKAGE_LABEL_ITEMS).map((item, index) => ({
    slot: index + 1,
    name: item.product?.name?.trim() || "Ürün",
    stockCode: item.product?.stockCode?.trim() || "—",
    quantity: item.quantity ?? 1,
    receiptNumber: item.product?.ticket?.receiptNumber?.trim() || undefined,
  }));
}
