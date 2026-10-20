# Çalışkan B2B — Onaylı Tedarikçi Tahsilatı

## Teknik durum

Onaylı tedarikçiler için ödeme altyapısı, `B2B_SUPPLIER_CHECKOUT_ENABLED` sunucu ayarı üzerinden kontrollü olarak açılır.
Varsayılan **kapalıdır**; böylece taraflar arası fatura/mutabakat anlaşması kurulmadan canlı tahsilat yapılamaz.

### Desteklenen akışlar

- Kart: iyzico 3DS / Checkout Form üzerinden sağlayıcı onayı sonrası sipariş `paid` (stok yetersizse `paid_stock_review`) olur.
- Havale/EFT: müşteri bildirimi tek başına tahsilat değildir. Yönetici banka hareketini, tutarı ve CLK referansını kontrol edip onaylar.
- Sunucu ödeme sırasında sadece `status='approved'` olan tedarikçileri, aktif ve onaylı canlı ürün sürümlerini ve stok/koli sınırlarını kabul eder.
- Sağlayıcıdan veya yöneticiden ödeme onayı geldikten sonra `b2b_supplier_sales_ledger` tablosuna her sipariş ve tedarikçi için **bir** brüt tahsilat kaydı eklenir; ödeme durumu ve kayıt aynı transaction içerisindedir.
- Rapor: `GET /api/admin/marketplace/supplier-payment-ledger` (yönetici) ve `GET /api/marketplace/seller/payment-ledger` (sadece hesabın kendi tedarikçisi).
- Bu tablo **tedarikçiye yapılan ödeme değildir**; yalnızca onaylı tahsilatın mutabakata alınmış brüt tutarıdır. Kısmi iadeler ve cezai/komisyon kesintileri hesaplanmış kabul edilmez.

### Canlı aktivasyon ön koşulları

1. **Kim satıcı/fatura düzenleyen?** Çalışkan B2B işletmesi ürünleri kendi adına yeniden satan taraf mı, yoksa tedarikçilerin pazaryeri aracısı mı? Belgelendir.
2. Aracı modelinde, iyzico ile pazaryeri/alt üye işyeri anlaşmasını ve ödeme bölüşümü/payout entegrasyonunu tamamla; mevcut standart Checkout Form'un platform adına para toplaması, otomatik satıcı dağıtımı anlamına gelmez.
3. Kendi adına yeniden satış modelinde, müşteriye platform adına fatura ve tedarikçiden platforma tedarik faturası/mutabakat prosedürünü oluştur.
4. IBAN hesap sahibinin sözleşmede satıcı/tahsilat yetkilisi ile uyumlu olduğundan emin ol (bireysel veya işletme banka hesabı uyumu).
5. Tedarikçi sözleşmesi, iade/iptal/ihtar süreçleri, vergi ve KVKK metinleri, destek sorumlulukları doğrulansın.
6. Test hesabıyla: onaylı/onaysız ürün, stok fazlası, aynı CLK kodu tekrar denemesi, başarısız kart, başarılı kart ve geç ödeme onayı senaryoları çalıştırılsın.
7. Yeni sunucu sürümü yayımlandıktan ve ödeme sağlayıcısı ayarları doğrulandıktan sonra yalnızca ilgili üretim ortamında `B2B_SUPPLIER_CHECKOUT_ENABLED=true` ayarla; değişikliği yeniden dağıtıp API / checkout smoke-test yap.
8. iOS uygulamasının değişen ödeme önizleme/güvenlik mesajları için yeni build oluştur, TestFlight doğrulamasından sonra App Store'a gönder.

**Önemli:** Bu özellik açılmadan önce gerçek ödeme alma testleri yapılmamalıdır. Canlıya geçiş sırasındaki ilk ödeme tutarı, banka kaydı, sipariş ve satıcı ledger verisi manuel doğrulanmalıdır.
