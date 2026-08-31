export type StatusVariant =
  | 'new'
  | 'review'
  | 'service'
  | 'exchange'
  | 'return'
  | 'completed'
  | 'cancelled'
  | 'default';

export const PRODUCT_STATUSES = [
  { value: 'teslim_alindi', label: 'Teslim Alındı' },
  { value: 'rma_deposunda', label: 'RMA Deposunda' },
  { value: 'tedarikci_bekliyor', label: 'Tedarikçi Bekliyor' },
  { value: 'tedarikciye_hazir', label: 'Tedarikçiye Hazır' },
  { value: 'tedarikcide', label: 'Tedarikçide' },
  { value: 'sonuclandi', label: 'Sonuçlandı' },
  { value: 'satilabilir_stok', label: 'Satılabilir Stok' },
  { value: 'hurda', label: 'Hurda' },
  { value: 'musteriye_teslim_edildi', label: 'Müşteriye Teslim Edildi' },
  { value: 'beklemede', label: 'Beklemede (Eski)' },
  { value: 'serviste', label: 'Serviste (Eski)' },
  { value: 'teslim_edildi', label: 'Teslim Edildi (Eski)' },
  { value: 'iptal', label: 'İptal (Eski)' },
] as const;

export const FILTER_CHIPS = [
  { id: 'all', label: 'Tümü' },
  { id: 'rma_deposunda', label: 'RMA Deposu' },
  { id: 'tedarikci_bekliyor', label: 'Tedarikçi Bekliyor' },
  { id: 'tedarikcide', label: 'Tedarikçide' },
  { id: 'degisim', label: 'Değişim' },
  { id: 'iade', label: 'İade' },
  { id: 'musteriye_teslim_edildi', label: 'Tamamlandı' },
] as const;

export const CATEGORY_OPTIONS = [
  { value: 'iade' as const, label: 'İade', description: 'Ürün iade işlemi' },
  { value: 'degisim' as const, label: 'Değişim', description: 'Ürün değişim talebi' },
  { value: 'servis' as const, label: 'Servis', description: 'Teknik servis kaydı' },
];

export function getStatusVariant(status: string, category?: string): StatusVariant {
  if (['musteriye_teslim_edildi', 'sonuclandi', 'satilabilir_stok', 'teslim_edildi'].includes(status)) return 'completed';
  if (status === 'iptal' || status === 'hurda') return 'cancelled';
  if (['tedarikcide', 'serviste', 'tedarikciye_hazir', 'tedarikci_bekliyor'].includes(status)) return 'service';
  if (category === 'degisim') return 'exchange';
  if (category === 'iade') return 'return';
  if (['rma_deposunda', 'teslim_alindi', 'beklemede'].includes(status)) return 'new';
  return 'default';
}

export function getStatusLabel(status: string): string {
  return PRODUCT_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function getCategoryLabel(category: string): string {
  return CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category;
}
