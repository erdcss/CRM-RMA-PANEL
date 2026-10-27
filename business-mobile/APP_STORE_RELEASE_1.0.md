# Çalışkan Business — App Store 1.0 yayın dosyası

Kaynak uygulama: `business-mobile/` · Bundle ID: `com.caliskangroup.business` · ASC Apple ID: `6818161236` · Expo proje ID: `aa005486-76a0-41cd-92de-33c2070a73f1`

## 1. Türkçe App Store metinleri

- **App adı:** Çalışkan Business
- **Alt başlık:** İşletme ve Sipariş Yönetimi
- **Ana kategori (öneri):** Business / İş
- **İkincil kategori (öneri):** Productivity / Verimlilik
- **Anahtar kelimeler:** işletme,sipariş,stok,ürün,müşteri,yönetim,toptan,tedarikçi,pazaryeri,operasyon
- **Promotional Text:** Çalışkan Business ile sipariş, ürün, müşteri ve destek süreçlerinizi mobil cihazınızdan takip edin.

### Description (TR)

Çalışkan Business, Çalışkan B2B yönetimi ve yetkilendirilmiş işletme kullanıcıları için geliştirilmiş mobil operasyon uygulamasıdır.

İş akışlarınızı tek merkezden takip edin:
- Gösterge panelinde siparişleri, düşük stok bilgilerini ve operasyon özetini görüntüleyin.
- Siparişleri arayın, durumlarını ve detaylarını takip edin.
- Ürünleri yönetin; erişiminize açıksa yapay zekâ destekli ürün ekleme araçlarını kullanın.
- Müşteri kayıtlarını, firma başvurularını ve destek taleplerini yönetin.
- Yetkinize göre pazaryeri, tedarikçi ve mağaza süreçlerine erişin.

Çalışkan Business, işletme tarafından yetkilendirilen hesaplarla çalışır. Sunulan özellikler kullanıcı rolüne göre değişiklik gösterebilir.

## 2. English (U.S.) App Store text

- **Name:** Çalışkan Business
- **Subtitle:** Business & Order Management
- **Keywords:** orders,inventory,products,customers,wholesale,suppliers,operations,business
- **Promotional Text:** Manage orders, products, customers, and business operations from your phone.

### Description (EN)

Çalışkan Business is a mobile operations app for authorized Çalışkan B2B administrators and business users.

With role-based access, you can:
- View an operational dashboard with orders and stock insights.
- Track orders, statuses, and details.
- Manage products, including AI-assisted product entry where enabled.
- Review customer records, business applications, and support requests.
- Access marketplace and supplier workflows according to your permissions.

An authorized business account is required. Features vary by role and permissions.

## 3. Gerçek uygulama ekran görüntüleri

Sadece çalışan uygulama/test hesabından alınmış gerçek ekranları kullanın; sentetik veri veya var olmayan ekranlar göstermeyin. Her görsel cihaz görüntüsü ağırlıklı olmalıdır.

Önerilen sıralama:
1. **İşletmeniz tek ekranda** — DashboardScreen (sipariş, stok ve operasyon özeti)
2. **Siparişlerinizi yönetin** — OrdersScreen
3. **Ürünlerinize her yerden erişin** — ProductsScreen
4. **AI ile ürün ekleyin** — AiProductStudioScreen (yalnızca özellik canlıda çalışıyorsa)
5. **Müşterilerinizi takip edin** — CustomersScreen
6. **Pazaryeri operasyonlarını yönetin** — MarketplaceScreen (yalnızca doğru yetki ve canlı işlemler varsa)

Apple'ın iPhone with Dynamic Island (medium display) kabul ettiği dikey çözünürlükler arasında 1179×2556 ve 1206×2622 bulunur. 1–10 görsel eklenebilir. PNG/JPG; saydamlık yok. iPad desteği Expo `supportsTablet:false` olduğundan iPad sürümü hedeflenmiyor (App Store Connect cihaz desteği ayrıca doğrulanmalı).

## 4. App Review notu (English — taslak)

Çalışkan Business is a role-based management application for administrators and authorized business users of the Çalışkan B2B platform. It is not intended for general public account registration. Please sign in using the active review account provided in the App Review sign-in fields. The accessible features depend on the role; the supplied reviewer account should have enough permissions to inspect dashboard, orders, products, and customer workflows. The production backend must be online for review.

**Hesap bilgilerini GitHub'a yazmayın.** Apple App Review Information alanına etkin inceleme kullanıcı adı ve şifresini ayrıca güvenli şekilde girin.

## 5. Yayın öncesi zorunlu doğrulamalar

- [ ] Çalışkan Business App Store Connect sürümü `1.0` ile EAS binary sürümü `1.0.0` uyumlu
- [ ] Üretim iOS build'i oluşturuldu ve App Store Connect > TestFlight > Builds içinde görünüyor
- [ ] İncelemeye gönderilecek build, iOS App 1.0 ekranındaki Build alanından seçildi
- [ ] App Store 1.0 için gerçek iPhone ekran görüntüleri yüklendi
- [ ] Giriş, oturum, sipariş, ürün, müşteri, AI ürün ve bildirim işlevleri gerçek cihazda test edildi
- [ ] Yetkili/çalışır demo hesap Apple'ın App Review Information alanına girildi
- [ ] Yayındaki gizlilik politikası URL'si kontrol edildi; politika Çalışkan Business'ı ve gerçek veri sorumlusu bilgilerini kapsıyor
- [ ] Uygulama içinde erişilebilir gizlilik bağlantısı ve gerekli hesap/veri silme süreçleri kontrol edildi
- [ ] Support URL erişilebilir; App Privacy soruları kullanılan gerçek veri/SDK ile uyumlu şekilde yanıtlandı
- [ ] Telif hakkı, fiyat (ücretsiz/ücretli), ülke erişimi, yaş derecelendirmesi ve ihracat uygunluğu tamamlandı
- [ ] App Review notları ve gereken özel izinler doğrulandı
- [ ] Sağ üstten Add for Review; sonra Draft Submissions > Submit for Review

## 6. EAS build / submit

Kaynak: [.github/workflows/testflight-all-apps.yml](../.github/workflows/testflight-all-apps.yml)

[GitHub Actions — TestFlight](https://github.com/erdcss/CRM-RMA-PANEL/actions/workflows/testflight-all-apps.yml) bölümünden **Run workflow → main → app: business**. Akış EAS iOS build ve TestFlight submit işlemini içerir, Apple mağaza incelemesine otomatik göndermez.

**Önemli:** [16 Ekim yayın notuna](../TESTFLIGHT_SETUP_20261016.md) göre önceki denemede `EXPO_TOKEN` eksikti. Mevcut Secrets ve en son Actions sonucu yeniden doğrulanmadan yeni build başarılı sayılamaz. Anahtarlar hiçbir zaman sohbet, koda veya issue'ya yazılmaz.

Resmî kaynaklar:
- https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/
- https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app/
- https://developer.apple.com/app-store/review/guidelines/
