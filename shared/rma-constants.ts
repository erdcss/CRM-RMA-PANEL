export const RMA_OPERATION_TYPES = [
  { value: "degisim", label: "Degisim" },
  { value: "iade", label: "Iade" },
  { value: "servis", label: "Servis" },
] as const;

export type RmaOperationType = (typeof RMA_OPERATION_TYPES)[number]["value"];

export const RMA_PRODUCT_STATUSES = [
  { value: "teslim_alindi", label: "Teslim Alindi" },
  { value: "rma_deposunda", label: "RMA Deposunda" },
  { value: "tedarikci_bekliyor", label: "Tedarikci Bekliyor" },
  { value: "tedarikciye_hazir", label: "Tedarikciye Hazir" },
  { value: "tedarikcide", label: "Tedarikcide" },
  { value: "sonuclandi", label: "Sonuclandi" },
  { value: "satilabilir_stok", label: "Satilabilir Stok" },
  { value: "hurda", label: "Hurda" },
  { value: "musteriye_teslim_edildi", label: "Musteriye Teslim Edildi" },
  { value: "sonuc_bekliyor", label: "Tedarikci Sonucu Bekliyor" },
] as const;

export type RmaProductStatus = (typeof RMA_PRODUCT_STATUSES)[number]["value"];

export const LEGACY_PRODUCT_STATUSES = [
  { value: "beklemede", label: "Beklemede (Eski)" },
  { value: "serviste", label: "Serviste (Eski)" },
  { value: "teslim_edildi", label: "Teslim Edildi (Eski)" },
  { value: "iptal", label: "Iptal (Eski)" },
] as const;

export type LegacyProductStatus = (typeof LEGACY_PRODUCT_STATUSES)[number]["value"];

export const ALL_PRODUCT_STATUS_VALUES = [
  ...RMA_PRODUCT_STATUSES.map((s) => s.value),
  ...LEGACY_PRODUCT_STATUSES.map((s) => s.value),
] as const;

export type AnyProductStatus = (typeof ALL_PRODUCT_STATUS_VALUES)[number];

export const WAREHOUSE_LOCATIONS = [
  { value: "rma_deposu", label: "RMA Deposu" },
  { value: "satilabilir_stok", label: "Satilabilir Stok" },
  { value: "hurda", label: "Hurda" },
] as const;

export type WarehouseLocation = (typeof WAREHOUSE_LOCATIONS)[number]["value"];

export const SUPPLIER_STATUSES = [
  { value: "bekliyor", label: "Bekliyor" },
  { value: "hazir", label: "Gonderime Hazir" },
  { value: "gonderildi", label: "Gonderildi" },
  { value: "tamamlandi", label: "Tamamlandi" },
] as const;

export type SupplierStatus = (typeof SUPPLIER_STATUSES)[number]["value"];

export const RMA_DEFAULT_PRODUCT_STATUS: RmaProductStatus = "rma_deposunda";
export const RMA_DEFAULT_WAREHOUSE_LOCATION: WarehouseLocation = "rma_deposu";
export const RMA_DEFAULT_OPERATION_TYPE: RmaOperationType = "servis";

export const RMA_CLOSED_STATUSES: readonly string[] = [
  "sonuclandi",
  "satilabilir_stok",
  "hurda",
  "musteriye_teslim_edildi",
  "teslim_edildi",
  "iptal",
];

export const RMA_SUPPLIER_WAITING_STATUSES: readonly string[] = [
  "tedarikci_bekliyor",
  "tedarikciye_hazir",
  "tedarikcide",
  "serviste",
  "tedarikciye_gonderildi",
];

export const LEGACY_STATUS_MAP: Record<string, RmaProductStatus> = {
  beklemede: "rma_deposunda",
  serviste: "tedarikcide",
  teslim_edildi: "musteriye_teslim_edildi",
};

const STATUS_LABELS: Record<string, string> = {
  ...Object.fromEntries(RMA_PRODUCT_STATUSES.map((s) => [s.value, s.label])),
  ...Object.fromEntries(LEGACY_PRODUCT_STATUSES.map((s) => [s.value, s.label])),
  tedarikciye_gonderildi: "Tedarikciye Gonderildi",
  tamir_tamamlandi: "Tamir Tamamlandi",
  degisim_onaylandi: "Degisim Onaylandi",
  iade_onaylandi: "Iade Onaylandi",
};

const OPERATION_LABELS: Record<string, string> = Object.fromEntries(
  RMA_OPERATION_TYPES.map((t) => [t.value, t.label]),
);

export function getRmaStatusLabel(status: string): string {
  return STATUS_LABELS[status] ?? status;
}

export function getRmaOperationLabel(operationType: string): string {
  return OPERATION_LABELS[operationType] ?? operationType;
}

export function getWarehouseLabel(location?: string | null): string {
  if (!location) return "-";
  return WAREHOUSE_LOCATIONS.find((w) => w.value === location)?.label ?? location;
}

export function getSupplierStatusLabel(status?: string | null): string {
  if (!status) return "-";
  return SUPPLIER_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function isOpenRmaStatus(status: string): boolean {
  return !RMA_CLOSED_STATUSES.includes(status);
}

export function normalizeLegacyStatus(status: string): string {
  return LEGACY_STATUS_MAP[status] ?? status;
}
