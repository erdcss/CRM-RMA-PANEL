# Çalışkan B2B — Google Play yayın dosyası (22.10.2026)

## Kaynak ve kesinleşen uygulama bilgileri

- GitHub: `erdcss/CRM-RMA-PANEL`, dizin: `mobile/`.
- Mobil uygulama adı: **Çalışkan B2B**.
- Android package/applicationId: `com.caliskangroup.rma`.
- EAS sahibi: `erdcls`, proje kimliği: `4b798642-00ea-462b-af15-07b2a3a54c5c`.
- Expo SDK: 54 (resmî dokümantasyonda Android targetSdkVersion 36).
- Uygulama sürümü: `1.0.1`; build numarası EAS remote kaynaklı.
- Üretim API adresi: `https://b2b.ecalisgan.com`.
- AAB profili: `android-aab`; APK cihaz testi profili: `android-apk`.
- **Play Console hesabı, uygulama kaydı, Android imzalama anahtarı ve son AAB başarı durumu henüz doğrulanmadı.**
- Railway üretim API'sini ve gerçek müşteri verilerini bu dosya kapsamında değiştirmeyin.

## Google Play mağaza metinleri — Türkçe

**Uygulama adı:** Çalışkan B2B

**Kısa açıklama (80 karakter sınırı):**
Çalışkan B2B ile ürünleri keşfedin, sipariş ve hesaplarınızı takip edin.

**Tam açıklama:**
Çalışkan B2B, işletmelerin ürün ve sipariş süreçlerini mobil cihazlarından takip edebilmeleri için geliştirilen B2B ticaret uygulamasıdır.

• Ürün kataloğunu ve kategorileri inceleyin.
• Ürünleri isim, stok kodu veya barkodla arayın.
• Ürün detaylarını ve mevcut ürün bilgilerini görüntüleyin.
• İşletme hesap bilgilerinize ve kayıtlı adreslerinize erişin.
• Sipariş, iade ve fatura kayıtlarınızı hesabınız üzerinden takip edin.
• Destek talepleri oluşturun ve taleplerinizin durumunu görüntüleyin.
• Bildirimlerinizi uygulama içerisinden takip edin.

Çalışkan B2B, iş süreçlerinizi tek noktadan yönetmenizi kolaylaştırmayı hedefler. Bazı özellikler hesap yetkinize ve hizmet kapsamına göre değişebilir.

**Mağaza iletişim URL'leri (yayına çıkmadan gerçek erişim doğrulanacak):**
- Web: https://b2b.ecalisgan.com
- Gizlilik politikası: https://b2b.ecalisgan.com/privacy
- Destek: https://b2b.ecalisgan.com/support
- Hesap silme web URL'si: **tespit edilecek/oluşturulacak — mevcut olmayan URL'yi Play Console'a girmeyin.**

## Yayın kontrol listesi

- [x] Android paket kimliği ve AAB profilinin kaynak kodda tanımlı olduğunu kontrol et.
- [x] Expo SDK 54 Android API 36 hedefinin resmî Expo dokümanında desteklendiğini kontrol et.
- [ ] Google Play Console geliştirici hesabının mevcut olduğunu, hesap türünü ve doğrulama durumunu doğrula.
- [ ] Play Console'da **Çalışkan B2B** uygulaması oluştur (dil Türkçe, kategori İş).
- [ ] `com.caliskangroup.rma` kimliğinin hesabımızda kullanılabilir olduğunu doğrula; ilk AAB yüklemesinden önce kalıcı adlandırma kararını onayla.
- [ ] Mobil yönetim panelinde PNG logo + PNG splash + tercihen ayrı Android ikonu bulunduğunu doğrula. `sync-mobile-branding.cjs` bunlar eksikse derlemeyi iptal eder.
- [ ] Canlı API erişimi, oturum açma, ürünler, barkod tarama, sepet, sipariş, iade, fatura, destek, bildirim, hesap silme akışlarını gerçek Android cihazda test et.
- [ ] Kullanılan tüm izinleri nihai AAB manifestinden incele (kamera, galeri, Bluetooth, bildirim vb.); gerekçe ve veri güvenliği beyanlarını gerçek uygulama davranışına göre doldur.
- [ ] Hesap silme işlevinin Android build'de ve sunucu tarafında çalıştığını doğrula; yasal saklama istisnalarını açıkla.
- [ ] Herkese açık, çalışan hesap silme talep bağlantısını sun; `/privacy` gizlilik metnini de doğrula.
- [ ] Google Play inceleme ekibine sürekliliği olan, şifre yenilemeye/OTP'ye bağımlı olmayan **test hesabı** ve İngilizce erişim talimatı sağla. Parolaları GitHub'a commit etme.
- [ ] Veri Güvenliği, içerik derecelendirme, hedef kitle, reklam, uygulama erişimi ve gerekiyorsa mali özellik beyanlarını gerçek uygulamaya göre tamamla.
- [ ] Mağaza görselleri: yüksek çözünürlüklü 512×512 ikon, 1024×500 özellik görseli, en az iki gerçek Android telefon ekran görüntüsü.
- [ ] Gerçek cihaz testinden geçen imzalı `.aab` üret; Android sürüm kodunun artmasını kontrol et.
- [ ] İlk `.aab` dosyasını Play Console **Dahili Test** kanalına yükle; imza/Play App Signing ayarlarını kontrol et.
- [ ] Hesap 13.11.2023 sonrası açılmış kişisel hesapsa en az **12 test kullanıcısı, kesintisiz 14 günlük kapalı test** şartını tamamla; sonra üretim erişimine başvur.
- [ ] İnceleme onayı sonrası aşamalı üretim yayını yap ve kilit ekranlarını/ANR-çökmeleri takip et.

## Android derleme (mobile/ içinde)

```bash
cd mobile
npm ci
npm run typecheck
npm run build:android:apk   # cihazda işlev testi — Play üretim dosyası DEĞİL
npm run build:android:aab   # Play Console'a yüklemek için imzalı AAB
```

Komutlar EAS kimlik doğrulaması ve Android keystore gerektirebilir. Mevcut `prepare-native-release.cjs` `main` ile `origin/main` commit'inin eşitliğini zorunlu kılar; dolayısıyla bu hazırlık dalından doğrudan build başlatılmamalı. Doğrulanan değişiklikler `main` üzerinde kullanılmadan üretim build'i alınmamalı. Kaynak ağaçtaki en güncel değişikliklerin Android üretiminde yer aldığından emin ol.

## Doğrulanmış kaynaklar

- Google Play hedef API 36: https://support.google.com/googleplay/android-developer/answer/11926878
- Expo SDK 54 / targetSdkVersion 36: https://docs.expo.dev/versions/latest/
- Google Play kayıt ve ücret: https://support.google.com/googleplay/android-developer/answer/6112435
- Yeni kişisel hesaplarda kapalı test: https://support.google.com/googleplay/android-developer/answer/14151465
- İnceleme giriş bilgileri: https://support.google.com/googleplay/android-developer/answer/15748846
- Gizlilik / silme: https://support.google.com/googleplay/android-developer/answer/10144311
- Android AAB / EAS: https://docs.expo.dev/build-reference/android-builds/
- Google Play medya gereksinimleri: https://support.google.com/googleplay/android-developer/answer/9866151
