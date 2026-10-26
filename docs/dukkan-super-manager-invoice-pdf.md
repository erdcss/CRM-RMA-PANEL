# Çalışkan Dükkan — yönetici hesapları, arayüz ve satış PDF çıktıları

## Yetkilendirme

- **Platform süper yöneticisi** (global `super_admin`) Çalışkan Dükkan Genel Bakış alanındaki **Süper Yönetici Oluştur** kartından yeni kullanıcı adı ve şifre belirleyebilir.
- Bu işlem, yalnızca `requireMarketplaceSuperAdmin` kontrolünden geçen aktif global `super_admin` hesabıyla yapılabilir. Mağaza müdürü/owner, kasiyer, muhasebeci veya normal panel `admin` hesabı bu işlemi yapamaz.
- Yeni kullanıcı `users.role=super_admin` ile tüm Çalışkan Admin modüllerini ve seçilen Dükkan mağazasını `owner` rolüyle kullanabilir. Özgün mağaza sahibi değişmez.
- Şifre `scrypt` + rastgele salt ile özetlenir; düz metin sunucuya kayıt edilmez veya API yanıtında gönderilmez. Yeni hesap işlemleri `dukkan_privilege_audit` tablosunda denetlenebilir.
- Kullanıcı adı 4-64 karakter, şifre en az 12 karakter ve büyük/küçük harf, rakam, özel karakter içermelidir. Mevcut kullanıcıların rolleri otomatik yükseltilmez.

## PDF satış belgesi

- Satış faturaları sayfasında her satış / satış iadesi satırı için **PDF İndir** aksiyonu vardır.
- `GET /api/dukkan/stores/:storeId/invoices/:invoiceId/pdf-data` sunucuda hesap/mağaza bazında denetlenir; satın alma belgeleri ve yetkisiz mağaza kayıtları verilmez.
- PDF, veritabanında kayıtlı fatura numarası, tarih, cari, ürünler, miktarlar, fiyat, KDV ve toplamları içerir. Çok sayfalı faturalar desteklenir.
- iOS / Android: `expo-print` ile A4 PDF oluşturulur ve `expo-sharing` ile kullanıcıya iletilir.
- **PDF dahili ön muhasebe belgesidir, GİB e-Fatura veya e-Arşiv belgesi değildir.** Her çıktıda bu açıklama bulunur.

## Görsel düzenleme

- Web: Çalışkan Dükkan markalı koyu başlık, duyarlı sol çalışma alanı menüsü, ana panel hızlı aksiyonları, KPI kartları, satın alma/satış formları ve tablolar güncellendi.
- iOS / Android: Tekil tasarım sistemi, hızlı işlem kartları, alt kısımda sık kullanılan bölümler, geliştirilmiş kayıt listesi ve PDF paylaşma eylemi.
- Yüklenen logo, Çalışkan Admin marka ayarından alınır. Mevcut SQLite yedekleri otomatik aktarılmaz.

## Doğrulama

GitHub Actions üzerinde web TypeScript/build, PostgreSQL entegrasyon, mobil TypeScript, iOS/Android JS paketleme ve markalama kontrolleri. Resmî TestFlight derlemesi yalnız başarılı kontroller sonrasında ayrı başlatılır.
