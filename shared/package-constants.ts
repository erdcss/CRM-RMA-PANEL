export const PACKAGE_STATUSES = [
  { value: "taslak", label: "Taslak" },
  { value: "hazirlaniyor", label: "Hazirlaniyor" },
  { value: "kapatildi", label: "Kapatildi" },
  { value: "dogrulandi", label: "Dogrulandi" },
  { value: "sevke_hazir", label: "Sevke Hazir" },
  { value: "sevk_edildi", label: "Sevk Edildi" },
  { value: "tedarikcide", label: "Tedarikcide" },
  { value: "geri_dondu", label: "Geri Dondu" },
  { value: "tamamlandi", label: "Tamamlandi" },
  { value: "iptal", label: "Iptal" },
] as const;

export type PackageStatus = (typeof PACKAGE_STATUSES)[number]["value"];

export const PACKAGE_STATUS_VALUES = PACKAGE_STATUSES.map((s) => s.value);

export const EDITABLE_PACKAGE_STATUSES: readonly PackageStatus[] = ["taslak", "hazirlaniyor"];

export const SHIPMENT_STATUSES = [
  { value: "hazir", label: "Hazir" },
  { value: "sevk_edildi", label: "Sevk Edildi" },
  { value: "teslim_edildi", label: "Teslim Edildi" },
  { value: "iptal", label: "Iptal" },
] as const;

export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number]["value"];

export const MOVEMENT_TYPES = [
  { value: "teslim_alma", label: "Teslim Alma" },
  { value: "rma_deposuna_giris", label: "RMA Deposuna Giris" },
  { value: "koliye_eklendi", label: "Koliye Eklendi" },
  { value: "koliden_cikarildi", label: "Koliden Cikarildi" },
  { value: "tedarikciye_sevk", label: "Tedarikciye Sevk" },
  { value: "tedarikciye_ulasti", label: "Tedarikciye Ulasti" },
  { value: "geri_geldi", label: "Geri Geldi" },
] as const;

export type MovementType = (typeof MOVEMENT_TYPES)[number]["value"];

export const PACKAGE_HISTORY_EVENTS = [
  { value: "olusturuldu", label: "Olusturuldu" },
  { value: "urun_eklendi", label: "Urun Eklendi" },
  { value: "urun_cikarildi", label: "Urun Cikarildi" },
  { value: "kapatildi", label: "Kapatildi" },
  { value: "barkod_dogrulandi", label: "Barkod Dogrulandi" },
  { value: "sevke_hazirlandi", label: "Sevke Hazirlandi" },
  { value: "sevk_edildi", label: "Sevk Edildi" },
  { value: "tedarikciye_ulasti", label: "Tedarikciye Ulasti" },
] as const;

export type PackageHistoryEvent = (typeof PACKAGE_HISTORY_EVENTS)[number]["value"];

export function getPackageStatusLabel(status: string): string {
  return PACKAGE_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function getMovementTypeLabel(type: string): string {
  return MOVEMENT_TYPES.find((m) => m.value === type)?.label ?? type;
}
