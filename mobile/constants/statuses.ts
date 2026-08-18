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
  { value: 'beklemede', label: 'Beklemede' },
  { value: 'tedarikciye_gonderildi', label: 'Tedarikçiye Gönderildi' },
  { value: 'serviste', label: 'Serviste' },
  { value: 'tamir_tamamlandi', label: 'Tamir Tamamlandı' },
  { value: 'degisim_onaylandi', label: 'Değişim Onaylandı' },
  { value: 'iade_onaylandi', label: 'İade Onaylandı' },
  { value: 'teslim_alindi', label: 'Tedarikçiden Teslim Alındı' },
  { value: 'teslim_edildi', label: 'Müşteriye Teslim Edildi' },
  { value: 'iptal', label: 'İptal' },
] as const;

export const FILTER_CHIPS = [
  { id: 'all', label: 'Tümü' },
  { id: 'beklemede', label: 'Yeni' },
  { id: 'serviste', label: 'Serviste' },
  { id: 'tamir_tamamlandi', label: 'Tamir Tamamlandı' },
  { id: 'degisim', label: 'Değişim' },
  { id: 'iade', label: 'İade' },
  { id: 'teslim_edildi', label: 'Tamamlandı' },
] as const;

export const CATEGORY_OPTIONS = [
  { value: 'iade' as const, label: 'İade', description: 'Ürün iade işlemi' },
  { value: 'degisim' as const, label: 'Değişim', description: 'Ürün değişim talebi' },
  { value: 'servis' as const, label: 'Servis', description: 'Teknik servis kaydı' },
];

export function getStatusVariant(status: string, category?: string): StatusVariant {
  if (status === 'teslim_edildi' || status === 'teslim_alindi' || status === 'tamir_tamamlandi') return 'completed';
  if (status === 'iptal') return 'cancelled';
  if (status === 'serviste' || status === 'tedarikciye_gonderildi') return 'service';
  if (status === 'degisim_onaylandi' || category === 'degisim') return 'exchange';
  if (status === 'iade_onaylandi' || category === 'iade') return 'return';
  if (status === 'beklemede') return 'new';
  return 'default';
}

export function getStatusLabel(status: string): string {
  return PRODUCT_STATUSES.find((s) => s.value === status)?.label ?? status;
}

export function getCategoryLabel(category: string): string {
  return CATEGORY_OPTIONS.find((c) => c.value === category)?.label ?? category;
}
