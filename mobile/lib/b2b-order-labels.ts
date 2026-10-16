/** Müşteri ekranlarında API'nin teknik durum kodlarını asla göstermeyin. */
const orderStatus: Record<string, string> = {
  pending: 'İşlem bekliyor',
  payment_pending: 'Ödeme bekleniyor',
  awaiting_bank_transfer: 'Havale bekleniyor',
  awaiting_bank_confirmation: 'Havale kontrol ediliyor',
  paid: 'Ödeme onaylandı',
  paid_stock_review: 'Ödeme alındı · stok kontrolü',
  processing: 'Hazırlanıyor',
  preparing: 'Hazırlanıyor',
  shipped: 'Kargoya verildi',
  delivered: 'Teslim edildi',
  completed: 'Tamamlandı',
  cancelled: 'İptal edildi',
  canceled: 'İptal edildi',
  cancel_requested: 'İptal talebiniz alındı',
  payment_failed: 'Ödeme başarısız',
  failed: 'İşlem başarısız',
};
const paymentStatus: Record<string, string> = {
  pending: 'Ödeme bekleniyor',
  customer_reported_paid: 'Havale bildirildi · banka kontrolü bekleniyor',
  bank_confirmed: 'Havale onaylandı',
  SUCCESS: 'Ödeme alındı',
  success: 'Ödeme alındı',
  FAILURE: 'Ödeme başarısız',
  failure: 'Ödeme başarısız',
  initialize_failed: 'Ödeme başlatılamadı',
  paid: 'Ödeme onaylandı',
};

export function orderStatusTR(value: unknown): string {
  const key = String(value ?? '').trim();
  return orderStatus[key] || 'Sipariş işleme alındı';
}
export function paymentStatusTR(value: unknown): string {
  const key = String(value ?? '').trim();
  return paymentStatus[key] || 'Ödeme durumu kontrol ediliyor';
}
