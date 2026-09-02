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

type PackageHistoryRow = {
  eventType?: string | null;
  metadata?: string | null;
};

export function parseLabelSequenceFromHistory(
  history?: PackageHistoryRow[] | null,
): number | null {
  if (!history?.length) return null;

  for (const row of history) {
    if (row.eventType !== "kapatildi" || !row.metadata) continue;
    try {
      const parsed = JSON.parse(row.metadata) as { labelSequence?: number };
      if (
        typeof parsed.labelSequence === "number" &&
        parsed.labelSequence >= 1 &&
        parsed.labelSequence <= MAX_PACKAGE_LABEL_SEQUENCE
      ) {
        return parsed.labelSequence;
      }
    } catch {
      // ignore invalid metadata
    }
  }

  return null;
}

export function resolvePackageLabelSequence(input: {
  labelSequence?: number | null;
  barcodeValue?: string | null;
  history?: PackageHistoryRow[] | null;
}): number | null {
  if (
    typeof input.labelSequence === "number" &&
    input.labelSequence >= 1 &&
    input.labelSequence <= MAX_PACKAGE_LABEL_SEQUENCE
  ) {
    return input.labelSequence;
  }

  return parseLabelSequenceFromHistory(input.history) ?? parsePackageLabelSequence(input.barcodeValue);
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
