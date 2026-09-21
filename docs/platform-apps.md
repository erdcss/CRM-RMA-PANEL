# Çalışkan platform uygulama sınırları

Bu dosya mevcut RMA/B2B içeriğine dokunmadan yeni uygulama sınırlarını sabitler.

## Uygulamalar
- **Çalışkan B2B**: Mevcut Çalışkan RMA deneyiminin yeni adı. Mevcut ekranlar ve RMA işlevleri korunur.
- **Çalışkan Business**: Yönetici/personel mobil uygulaması. Hesapları web admin panelinden atanır. Özellikleri ayrıca geliştirilecektir.
- **Web Admin**: Merkezi yönetim, kullanıcı/yetki atama ve ileride iki mobil uygulamanın operasyon yönetimi.

## Kimlik ve erişim
Kullanıcı modelinde rol, uygulama erişimi ve aktif/pasif durumu bulunur.
Çalışkan Business için atanacak hesapların `appAccess=business` olması beklenir.
Müşteri uygulaması için ayrı müşteri kimlik modeli daha sonraki ürün komutlarıyla eklenecektir.

## Koruma ilkesi
Mevcut RMA akışları değiştirilmez; yeni altyapı eklemeli ve geriye uyumlu ilerler.
