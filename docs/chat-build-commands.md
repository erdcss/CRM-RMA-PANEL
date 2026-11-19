# Çalışkan B2B – ChatGPT ile Android ve iOS derleme komutları

GitHub deposu: `erdcss/CRM-RMA-PANEL`, branch `main`.
Android App ID / iOS Bundle ID: `com.caliskangroup.rma`.
**Expo EAS kullanılmaz.**

Bu komutlar yalnızca kullanıcının açık isteği üzerine uygulanır. Normal kod
güncellemeleri uygulama mağazalarına otomatik yükleme yapmaz.

## 1. "APK AAB al"

1. En son `main` sürümünü ve Android signing build ayarlarını kontrol et.
2. `.github/release-requests/b2b-native-android-release.txt` dosyasına
   benzersiz yeni bir istek numarası/mesajı yaz (GitHub update_file).
3. Bu değişiklik yalnızca
   `.github/workflows/b2b-native-android.yml` GitHub Actions release
   işini tetikler.
4. İmzalı APK + AAB üretilir, güvenlik kontrolleri çalışır.
   `mobile/scripts/stamp-chat-android-version.cjs` her release build'e
   GitHub Actions `GITHUB_RUN_NUMBER + 1000` şeklinde daha yüksek
   `versionCode` verir (Android manifest içinde; kaynak `app.json`
   değiştirilmez).
5. GitHub Actions işinin sonucunu ve gerçek artefakt bağlantısını paylaş.
   **Google Play'e otomatik yükleme YOKTUR.**
6. Google Play upload key'in etkinleştiğini ve fingerprint'i yeniden
   doğrulamadan AAB'yi Play'e gönderme.

## 2. "TestFlight'a gönder"

1. Güncel `main` kodu ve `codemagic.yaml` içindeki Apple Developer
   entegrasyonunu kontrol et.
2. `.github/release-requests/b2b-ios-testflight.txt` dosyasındaki
   son istek numarasını artır ve yeni mesajla güncelle.
3. Codemagic `caliskan-b2b-ios` iş akışı `main` branch'te push
   webhook'undan, `when.changeset.includes` filtresi ile başlamalıdır.
   **Codemagic → CRM-RMA-PANEL → Webhooks ekranında etkin webhook
   bulunması gerekir; ilk kurulumda Create/Update webhook yapılmalıdır.**
4. Bu iş akışı imzalı `.ipa` oluşturur ve Codemagic'de bağlı
   `Codemagic Caliskan B2B` API entegrasyonu üzerinden **App Store Connect'e
   otomatik yükler**. TestFlight iç test grupları/Apple processing App Store
   Connect'ten kontrol edilir; **herkese açık App Store yayını YOKTUR**.
5. Codemagic erişimi yoksa build durumunu asla uydurma: Codemagic
   ekranı veya Publishing logu iste. Daha önceki başarılı IPA ve App Store
   Connect yüklemesi yeni bir isteğin başarılı olduğunu kanıtlamaz.

## 3. "Build al"

Her iki akışı başlat:
- Android imzalı APK + AAB artefaktı.
- iOS imzalı IPA + App Store Connect'e TestFlight için yükleme.

Her komut ayrı bir GitHub isteği oluşturur ve farklı bir CI işini tetikler.
İlk iOS webhook tetikleme test edilince uçtan uca otomasyon doğrulanmış olur.
**Hizmet izinleri / girişler zamanla değişirse bu akış başarısız olabilir; bu
durumlar dürüstçe raporlanmalıdır.**

## Güvenlik ve işlem sınırları

- Android secrets: `B2B_ANDROID_KEYSTORE_BASE64`,
  `B2B_ANDROID_KEYSTORE_PASSWORD`, `B2B_ANDROID_KEY_ALIAS`,
  `B2B_ANDROID_KEY_PASSWORD` yalnızca GitHub Actions Secrets'ta.
- Apple .p8, .p12, provisioning .mobileprovision dosyalarını ve şifreleri
  sohbete/GitHub kaynak koduna ekleme.
- Android release: yeni upload certificate SHA256
  `9B49A12AD060804BA23692C78C153CADCB38F07B3D1959FEB1BFF0DDA2E772D0`.
- iOS signing: `caliskan_b2b_appstore_distribution` sertifikası ve
  `caliskan_b2b_appstore_2026` profili.
- Android / iOS derlemesi ücretli runner süresi kullanabilir.
- Yalnız açık isteklerle derleme; push changeset harici kod değişikliklerinde
  iOS build'inin çalışmamasını sağlar (Codemagic yaml güncellemeleri istisna).
