export const SUPPLIER_RESULT_TYPES = [
  { value: "sonuc_bekliyor", label: "Sonuc Bekliyor" },
  { value: "degistirildi", label: "Degistirildi" },
  { value: "tamir_edildi", label: "Tamir Edildi" },
  { value: "reddedildi", label: "Reddedildi" },
  { value: "iade_kabul", label: "Iade Kabul" },
  { value: "iade_red", label: "Iade Red" },
  { value: "urun_yenilendi", label: "Urun Yenilendi" },
  { value: "parca_degisti", label: "Parca Degisti" },
] as const;

export type SupplierResultType = (typeof SUPPLIER_RESULT_TYPES)[number]["value"];

export const SUPPLIER_RESULT_TYPE_VALUES = SUPPLIER_RESULT_TYPES.map((t) => t.value);

export const FINAL_PRODUCT_STATUSES = [
  "satilabilir_stok",
  "hurda",
  "musteriye_teslim_edildi",
  "teslim_edildi",
] as const;

export type FinalProductStatus = (typeof FINAL_PRODUCT_STATUSES)[number];

export const TICKET_RMA_STATUSES = ["open", "closed"] as const;

export function getSupplierResultLabel(type: string): string {
  return SUPPLIER_RESULT_TYPES.find((t) => t.value === type)?.label ?? type;
}

export function isFinalProductStatus(status: string): boolean {
  return FINAL_PRODUCT_STATUSES.includes(status as FinalProductStatus);
}

export function requiresNewSerial(resultType: string): boolean {
  return ["degistirildi", "urun_yenilendi", "parca_degisti"].includes(resultType);
}
