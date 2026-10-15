# Çalışkan B2B Pazaryeri — Kurulum ve Canlıya Alma Kontrolü

Güncelleme: 16 Ekim 2026

## Kurulan ilk uygulama katmanı

- `/pazaryeri` (mevcut admin panelinde yalnızca `super_admin`): Tedarikçi başvurusu, ürün sürümü, mağaza tasarımı, Reels onayı ve geçmiş inceleme kayıtları.
- `/satici`: Mevcut B2B hesabıyla firma başvurusu; onay sonrası mağaza tasarım, görsel yükleme, ürün, Reels, müşteri mesajları ve teklif yönetimi.
- `/magazalar` ve `/magaza/:slug`: Onaylanmış tedarikçi mağazaları, onaylı ürün ve Reels, takip, uygulama içi müşteri sohbeti.
- `/mesajlarim`: Alıcının başlattığı mesajlaşma, RFQ/teklif ve teklif kararları.
- `/pazaryeri-sepetim`: Tek sepette çok tedarikçi, satıcıya göre gruplanmış sevkiyat seçenekleri, ücretsiz ve idempotent **ödenmemiş sipariş taslağı**.
- `business-mobile/`: Çalışkan Business iOS/Android uygulamasında rol tabanlı pazaryeri erişimi. Native super-admin onayları, satıcı özetleri, mesaj ve teklifler mevcut. Bazı medya/ürün düzenleme işleri şimdilik yalnızca mobil uyumlu web panelinde tam.

## Güvenlik ve veri ayrımı

- Pazaryeri tabloları `mp_*`; eski Çalışkan B2B ürün/sipariş tablolarından ayrı tutulur.
- Yönetici onayı olmadan tedarikçi, ürün, mağaza tasarımı veya Reels yayınlanmaz.
- Yeni ürün/mağaza sürümü incelenirken bir önceki onaylı sürüm yayında kalır.
- Medya dosyaları şirketin uygulama içi veritabanına kopyalanır, benzersiz ve değiştirilemez bağlantı kullanılır.
- İnceleme bekleyen medyayı yalnızca sahibi veya süper yönetici görebilir.
- Sohbeti sadece B2B müşteri başlatabilir; tedarikçi ancak var olan görüşmeye yanıt verir.
- Tedarikçi sadece kendi mağaza ve finans dışı taslak yönetim verilerini görür.
- `super_admin` onaylarına diğer yöneticiler ve tedarikçiler erişemez.

## Önceden kararlaştırılmış iş modeli

- Kendi ürünlerimiz + satıcıların ayrı mağaza katalogları.
- Müşteriden tahsilat Çalışkan B2B hesabına yapılacak.
- Tedarikçi Çalışkan B2B'ye, Çalışkan B2B müşteriye fatura düzenleyecek.
- KDV hariç sözleşmesel hesaplama temeli teyit edilerek satıcı siparişinde %3; depo kontrolünde ek %3.
- Satıcı doğrudan sevk veya Çalışkan B2B deposunda kontrol + müşteriye sevk.
- Videolu paketleme ve açılış isteğe bağlı; delil süreçleri için ayrı güvenli kayıt politikası gerekli.

## CANLI TİCARETİ ENGELLEYEN KRİTİK EKSİKLER

Bu maddeler bitmeden pazaryeri satıcı siparişi üzerinden **para tahsil etmeye veya otomatik fatura düzenlemeye başlamayın**:

1. İyzico/uygun ödeme kuruluşuyla tek müşteri tahsilatı ve çok satıcılı finans/mutabakat akışı; iade, chargeback, tekrar deneme, webhook imzaları.
2. Tedarikçi alış faturaları ile müşteri satış faturalarının e-Fatura/e-Arşiv servis ve mali müşavir doğrulaması.
3. Satıcı bazlı stok rezervasyonu ve ödemeden sonra kesin siparişe dönüşüm; iptal/kısmi iptal ve geriye alma.
4. Satıcıya ödeme planı, %3 hizmet bedeli ile ek depo kontrol bedelinin muhasebe kaydı ve hizmetin vergisel türü.
5. Kargo/ambar/çift kargo fiyatları, taşıyıcı entegrasyonu ve depoda ürün kabul-kontrol-sevk.
6. RMA/iade talepleri, iade faturası süreçleri, iadeye özgü bedel/komisyon düzeltmeleri, uyuşmazlık iş akışı.
7. Paketleme ve koli açılışı kanıt videoları için KVKK uyumlu, erişim kayıtlı, süreli saklama ile mobil kesintisiz video oturumları.
8. Çalışkan Business mobilinde web paneliyle tam işlem paritesi: mobil ürün/medya oluşturma ve tüm tema blokları.
9. Veritabanı üzerinden gerçek hesaplarla uçtan uca testler, yetkisiz erişim ve yük testleri, Android/iOS yayın paketleri.

## Doğrulama / pilot test senaryoları

- [ ] B2B kullanıcı firma başvurusu gönderir, admin inceleme kuyruğunda görünür.
- [ ] Admin reddeder; satıcı gerekçeyi görür ve güncelleyerek başvuruyu tekrar gönderir.
- [ ] Admin tedarikçiyi onaylar; satıcı mağazasını tasarlar ve onaya gönderir.
- [ ] Onaysız ürün/mağaza/video anonim kullanıcılara **gösterilmez**.
- [ ] Onaylanan ürün canlıda görünür; onaya gönderilen yeni fiyat canlı fiyatı değiştirmez.
- [ ] Satıcının medya kayıtlarını başka satıcı kullanamaz.
- [ ] Alıcı mağazayı takip eder, takipten çıkar; takipçi sayı ve liste güncellenir.
- [ ] Satıcı müşteri adına yeni sohbet oluşturamaz; müşteri açtığı görüşmeye satıcı yanıt verir.
- [ ] Teklif talebi ve satıcının teklif yanıtı alıcının panelinde görünür.
- [ ] İki satıcının ürünleri tek sepete eklenir; onaylı ürün, stok, koli ve fiyat kontrolü yapılır.
- [ ] Sipariş taslağı satıcı bazında bölünür, istek anahtarı tekrarlandığında çift kayıt oluşmaz.
- [ ] Taslak oluşturmak kesin siparişe, ödemeye, faturaya veya stok düşümüne yol açmaz.
- [ ] Süper yönetici ve satıcı Business mobil hesabıyla sadece kendi yetkili ekranlarına girer.
- [ ] Canlı satın alma açılmadan önce ödeme/fatura/iade/lojistik testleri tamamlanır.

### Önemli durum beyanı

Bu dosya uygulanan temel özelliklerle canlı yayına geçiş için gereken kapsamı ayırır. Kodun depoya gönderilmiş ve dağıtımın başarılı olması, gerçek finansal alışverişin veya yukarıdaki uçtan uca senaryoların test edildiği anlamına gelmez.
