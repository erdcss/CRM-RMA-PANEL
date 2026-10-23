# Çalışkan Dükkan — Ön muhasebe uygulaması

## Ürün tanımı
Windows masaüstü ve iOS/Android mobil uygulamalarının adı: **Çalışkan Dükkan**.

Bu depo içinde Çalışkan Admin üzerinden giriş yapılan ayrı bir /dukkan ekranı vardır. Yeni veri tabloları PostgreSQL üzerinde dukkan_ önekiyle saklanır. Eski B2B/RMA stoklarına dokunulmaz; B2B katalog ve fiziksel mağaza stokları otomatik birleştirilmez.

## Modüller ve ilk sürüm kapsamı
- Satış, satın alma, satış iadesi, alış iadesi: Çok kalemli işlem, KDV, stok ve cari hareketlerinin tek transaction içinde kaydı.
- Cari hesap: müşteri/tedarikçi kartı, borç-alacak, tahsilat ve ödeme.
- Stoklar ve hareketler: barkod, SKU, fiyat, stok; manuel düzeltme.
- Siparişler: alım ve satım sipariş kaydı. Siparişi faturaya dönüştürme henüz yok.
- Çek/senet: alınan/verilen evrak, vade ve durum. Tahsil işaretleme cari/banka kaydı oluşturmaz; ayrıca ödeme/tahsilat girilmelidir.
- Banka: hesap tanımı, para giriş/çıkışı, bakiye ve ödeme bağlantısı.
- Raporlar: alış, satış, cari, banka, stok değeri, gecikmiş evrak.

## Marka ve yetki
Çalışkan Admin > Ayarlar > Marka & Görseller > Çalışkan Dükkan alanından logo ve splash yüklenir. Uygulama içindeki görseller güncel kayıtları alır; Windows kurulum simgesi veya iOS/Android ana ekran ikonu yalnızca yeni build ile değişir.

Mağazayı admin/super_admin kullanıcı oluşturur. /api/dukkan/stores/:id/members uç noktası ile mevcut aktif sistem kullanıcıları mağazaya atanabilir. Yetkiler owner, manager, accountant, cashier, viewer. Mağaza verisi, store_id üyelik kontrolüyle korunur. Cashier için hassas finansal okuma/yazma sınırlandırılmıştır.

## Masaüstü
Klasör: dukkan-desktop
Çalıştırma: cd dukkan-desktop && npm install && npm start
Windows setup: npm run build:win
Build çıktısı: dukkan-desktop/dist içindeki .exe dosyası.
Uygulama admin.ecalisgan.com/dukkan adresine HTTPS üzerinden bağlanır. Offline kayıt desteklenmez.

## Mobil
Klasör: dukkan-mobile
Geliştirme: cd dukkan-mobile && npm install && npm start
Üretim paketleri: eas build --platform ios --profile production ve eas build --platform android --profile production.
Expo/EAS, Apple Developer ve Google Play Console hesapları, native ikon varlıkları ve uygulama mağazası onayları gereklidir.
Mobil ekran masaüstüyle aynı responsive arayüz/API üzerinde çalışır. Çalışkan Admin logo/splash ayarları mobil başlatmada okunur.

## Teknik ve operasyonel kontroller
- API: /api/dukkan/stores ve /api/dukkan/stores/:storeId uzantıları.
- Fatura numarası mağaza+tür ile benzersizdir; UUID requestKey tekrarında aynı işlem ikinci kez yazılmaz.
- Yetersiz stok fatura işlemini tamamen geri alır.
- KDV hesabı sunucuda yapılır; parasal tutarlar NUMERIC olarak saklanır.
- Banka ve cari tahsilatları aynı transaction içinde işlenir.
- PostgreSQL veritabanı ve yedekleme zorunludur. Yerel PGlite modunda Çalışkan Dükkan API'si etkin değildir.
- Çek/senet durumunun kapatılması hesap mutabakatı veya ödeme değildir.

## Üretime çıkış şartları
1. Her iki mağaza arasında veri sızıntısı olmadığını yetki testleriyle doğrulayın.
2. 2 stoklu üründen 3 adet satışın reddedildiğini, hiç fatura/cari kaydı oluşmadığını test edin.
3. Aynı fatura requestKey ile tekrarlanırsa stok ve cari tek kez güncellensin.
4. İade işlemlerinde stok ve cari yönü doğrulansın.
5. Ödeme ve banka hareketi atomik kaydedilsin.
6. Windows installer, iOS ve Android paketleri gerçek cihazda test edilsin.
7. Kasa yönetimi, çoklu depo, stok değerleme, iptal/ters kayıt, dönem kapanışı, otomatik güncelleme ve izleme sistemleri tamamlanmadan geniş ölçekli canlı kullanım yapılmasın.

**Önemli:** Bu sürümde resmî GİB e-Fatura/e-Arşiv oluşturma/gönderme entegrasyonu YOKTUR. Program içi fatura kaydı mali mevzuata uygun elektronik fatura kesme işlevi yerine geçmez. Yetkili entegratör, e-belge doğrulama ve mali müşavir kontrolü ayrı bir çalışmadır.
