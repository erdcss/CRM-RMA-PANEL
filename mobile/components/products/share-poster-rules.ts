/** Çalışkan B2B — standart müşteri paylaşım posteri sözleşmesi.
 * Rendered natively; AI services may enhance the product photo in the future,
 * but may NEVER invent facts, alter the physical product or expose pricing.
 */
export const SHARE_POSTER_RULES = {
  output:{width:1080,height:1920,format:'png'},
  palette:{yellow:'#FFCB05',black:'#181818',background:'#F5F5F3',card:'#FFFFFF'},
  allowedFields:['name','brand','sku','category','units_per_box','min_order_qty'] as const,
  forbiddenFields:['price','purchase_price','cost','margin','discount','supplier','stock'] as const,
  aiInstructions:`1080x1920 dikey Reels/Story formatı. Saf beyaz ürün alanı ve
kırık beyaz sayfa, Çalışkan B2B sarı-siyah marka kimliği. Orijinal ürün
fotoğrafını, marka/logoyu ve model kodunu koru; yeni marka veya teknik özellik
uydurma. Ürün görselini net, kırpılmadan ve ortalı göster. Ürün adı altında
model/kod, kategori, koli içi, minimum alımı iki sütunda dört kompakt bilgi
kutusunda göster. Eksik bilgi kutusunu gizle. Fiyat, KDV, indirim, alış fiyatı,
kâr, stok, iç not veya tedarikçi bilgisini asla yayınlama. Son alanda uygulama
indirme çağrısı ve Ayarlar'dan okunan App Store/Google Play görsellerini
birbirine değmeyen, bağımsız beyaz kartlarda göster. Uygulama logosu Ayarlar
kaynağından gelsin. 9:16 güvenli kenar boşluğu, net tipografi, taşma yok.`,
} as const;
