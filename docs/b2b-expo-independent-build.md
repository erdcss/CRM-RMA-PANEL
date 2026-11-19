# Çalışkan B2B — Expo hesabından bağımsız derleme

Bu geçiş **React Native + Expo SDK 54** ile devam eder, ancak Android APK/AAB derlemek için
`expo.dev`, `eas build`, `EXPO_TOKEN` veya yeni bir Expo projesi gerektirmez.

> Kapsam: Şimdilik yalnız **Çalışkan B2B**. `com.caliskangroup.rma` kimliği, API URL'si,
> yönetici panelinden logo/splash senkronizasyonu ve iOS bundle ID korunur.
> KOD / GİZLİ ANAHTARLARI yeni Expo hesabına otomatik taşımayın.

## Android: GitHub Actions

İş akışı: [Caliskan B2B - Expo hesap gerektirmeyen Android](../.github/workflows/b2b-native-android.yml).

- **smoke**: gerçek Expo native Android `prebuild` ve Gradle `assembleDebug` derlemesi.
  Çıktısı sadece **geliştirme APK'sı**; dağıtılabilir Play sürümü değildir.
- **release**: Aynı kaynaklardan, **mevcut Google Play upload key** ile imzalı,
  telefona kurulabilir `.apk` ve Play'e yüklenebilir `.aab` üretir. Expo hesabı gerekmez.
- Android manifestinde konum ve reklam kimliği izinleri olmaması denetlenir.
- `versionCode: 27` ilk bağımsız test sürümüdür; her yeni Play yüklemesinde artırılmalı.
- Derleme sadece manuel başlatılır (`Actions → Run workflow → build_kind`).
  Hiçbir dosya mağazaya otomatik yüklenmez.

**Release imzası zorunludur.** Eski 1.3.12 APK/AAB üzerinde tespit edilen
upload sertifikası SHA-256 (genel bilgi; özel anahtar değil):

`B4:39:A9:45:78:10:72:88:AC:6D:8A:BB:A6:53:96:4B:71:D4:76:1C:9F:8B:B3:79:33:5C:21:E6:21:0C:B0:A3`

**21 Kasım 2026 11:45 itibarıyla etkinleşmesi planlanan yeni upload sertifikası** (19 Kasım'da yerel olarak oluşturulan PEM):

`9B:49:A1:2A:D0:60:80:4B:A2:36:92:C7:8C:15:3C:AD:CB:38:F0:7B:3D:19:59:FE:B1:BF:F0:DD:A2:E7:72:D0`

Script artık bu **yeni** sertifikaya uymayan keystore ile sürüm oluşturmayı **reddeder**. Google Play Console üzerinden sıfırlama etkinleştikten sonra, **Anahtarı yükleyin** bölümündeki SHA-256 sertifika parmak izinin yeni değerle aynı olduğunu ayrıca doğrulayın. Yükleme anahtarı başvurusu henüz etkin değilken Play'e yeni AAB göndermeyin.
Google Play Console → Kurulum → Uygulama bütünlüğü → Uygulama imzalama
altındaki **yükleme anahtarı sertifikasıyla** karşılaştırın.

### GitHub Actions secrets

GitHub repo → Settings → Secrets and variables → Actions altında bu **Repository secret** adlarını oluşturun:

| Secret | İçeriği |
| --- | --- |
| `B2B_ANDROID_KEYSTORE_BASE64` | Mevcut upload-key `.jks` dosyasının **tek satırlık Base64** içeriği |
| `B2B_ANDROID_KEYSTORE_PASSWORD` | Keystore şifresi |
| `B2B_ANDROID_KEY_ALIAS` | Keystore içindeki doğru key alias |
| `B2B_ANDROID_KEY_PASSWORD` | Özel anahtarın şifresi |

Keystore dosyasını **asla GitHub kaynak koduna veya sohbete yüklemeyin**. Yalnız
GitHub encrypted secrets üzerinden kullanın.

Eski Expo hesabındaki anahtara erişilebiliyorsa Expo'nun
`eas credentials -p android` aracıyla anahtarı dışa aktarın. Erişim tamamen
engelliyse eski Google Play imza sertifikasını kaybetmiş saymayın:
Google Play App Signing kapsamında Play Console üzerinden **upload key reset**
isteyebilirsiniz. Bu onaylanırsa bu projedeki sertifika kontrolü yeni **resmî**
sertifikaya göre güncellenmelidir. Rastgele yeni keystore ile mağaza güncellemesi
oluşturulmaz.

**Windows PowerShell** ile JKS'yi tek satırlık Base64'e çevirmek için:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\secure\b2b-upload.jks")) | Set-Clipboard
```

Panodaki metni yalnız GitHub'ın yukarıdaki *Secret* alanına yapıştırın.
Secret erişimini ve panoyu daha sonra temizleyin.

### İlk deneme

GitHub Actions iş akışında `build_kind: smoke` ile native derlemeyi test edin.
Başarılıysa **orijinal upload keystore** secrets girildikten sonra `build_kind: release`
çalıştırın. Artifacts sekmesindeki `Caliskan-B2B-Native-Signed-APK-AAB`
arşivinde APK ve AAB bulunacaktır.

## iOS: Codemagic (Expo hesabı olmadan)

Kök dizindeki [codemagic.yaml](../codemagic.yaml) iş akışı: `caliskan-b2b-ios`.
GitHub ana dalı `erdcss/CRM-RMA-PANEL`, iOS bundle ID `com.caliskangroup.rma`;
önceden açılmış App Store Connect Apple ID: **6802286663**.
Uygulama ve bundle ID yeniden oluşturulmaz.

### İlk Codemagic bağlantısı (kullanıcı hesabından)

1. [Codemagic](https://codemagic.io/) sitesinde GitHub ile oturum açın;
   `erdcss/CRM-RMA-PANEL` deposunu ekleyin ve **codemagic.yaml** yapılandırmasını seçin.
2. App Store Connect → **Users and Access → Integrations → App Store Connect API**
   bölümünde uygun yetkili (App Manager) API anahtarı oluşturun. `.p8` dosyasını
   **yalnız Codemagic Team Settings → Developer Portal integration** alanına girin.
   Issuer ID ve Key ID de buraya eklenir; sohbete veya GitHub kaynak koduna girilmez.
3. Codemagic → **Code signing identities** bölümünde **App Store distribution**
   sertifikası ve `com.caliskangroup.rma` için provisioning profile oluşturun veya
   Apple Developer hesabından güvenli şekilde içeri alın.
   `ios_signing.distribution_type: app_store` bu kayıtları seçecektir.
4. Codemagic uygulama ekranında **Start new build → branch main →
   caliskan-b2b-ios** seçin. İş akışı otomatiktir, ancak TestFlight'a yükleme
   bu ilk doğrulama derlemesinde **kapalıdır**.
5. Derleme başarıyla tamamlanırsa **Artifacts** kısmında imzalı `.ipa`
   oluşturulur. Önce çıktının `com.caliskangroup.rma` bundle ID'sini,
   sertifikasını, sürüm numarasını ve Apple Developer takımını doğrulayın;
   sonra TestFlight yayımlama adımını etkinleştirin.

### CI güvenlik ve uyumluluk

- `mobile/scripts/prepare-native-release.cjs`, Codemagic'in `main` dalındaki
  sabit `CM_COMMIT` bilgisini doğrular; ayrıca detached HEAD checkout'a izin verir.
  Eski veya farklı dalın yanlışlıkla dağıtımına izin verilmez.
- Her Codemagic derlemesinde `mobile/scripts/codemagic-ios-prebuild.cjs`,
  `YYMMDDNNN` biçiminde benzersiz `ios.buildNumber` oluşturur;
  `NNN` Codemagic `PROJECT_BUILD_NUMBER` değeridir. 999 build sınırına
  yaklaşırsa tarih şeması yeniden tasarlanmalı. App Store'daki mevcut en
  son TestFlight build numarasından **yüksek olduğunu doğrulamak zorunludur**.
- Yönetici panelinden yeni logo, splash ve bildirim sesi alınmadan build devam etmez.
  Admin'de logo/splash kaydının canlı çalışan uygulamaya yansıması ayrı davranıştır;
  native uygulama ikonunu değiştirmek için her zaman yeni binary gerekir.
- Özel NIIMBOT iOS SDK statik kütüphaneleri (ticari lisans) public GitHub'da
  bulunmadığından, `EXPO_SKIP_NIIMBOT=1` altında sadece ilk Codemagic
  TestFlight derlemesinde `niimbot-printer` iOS native modülü autolink
  listesinden çıkarılır. **NIIMBOT Bluetooth etiket yazdırma işlevi bu IPA'da
  kullanılamaz.** SDK lisanslı dosyaları özel depoya/secret artifact'e alınca
  test edilip yeniden etkinleştirilecektir.
- Kod derleme yolu `expo prebuild` + CocoaPods + Xcode kullanır,
  `eas build` veya `EXPO_TOKEN` gerektirmez.
- TestFlight'a **otomatik** gönderim şu anda kapalıdır; Apple bağlantısı ve imzalı
  ilk IPA doğrulandıktan sonra yayınlama ayrı aşamada yapılır.
- Push bildirimleri için Expo projesinden bağımsız APNs yoluna geçiş hâlâ
  ayrıca doğrulanmalıdır. IPA derleme başarısı bildirimlerin geldiğini ispatlamaz.

## Mevcut Expo hizmetlerine kalan bağımlılıklar

- **Expo SDK**, yerel modüller ve `expo prebuild` devam eder (ücretsiz açık kaynak araçlar).
- Mevcut uygulama bildirim tokenları `expo-notifications` ve eski Expo
  `projectId` ile ilişkili olabilir. **Push sistemi henüz bağımsızlaşmadı**.
  Sonraki aşamada FCM + APNs ve mevcut bildirim kayıtları dikkatle taşınmalıdır.
- Mevcut `eas.json` ve eski Expo project ID bu aşamada silinmez; iOS/TestFlight
  ve geri dönüş uyumluluğu korunur.

## Sınırlamalar

- Gizli JKS/Apple sertifikaları olmadan yeni mağaza sürümünü imzalamak mümkün değildir.
- GitHub smoke derlemesi sadece native derleme zincirini doğrular; gerçek cihazda
  tüm davranışların test edildiği anlamına gelmez.
- Admin logo/splash senkronizasyonu üretim API'sine erişim gerektirir;
  bu API erişilemiyorsa önlem olarak derleme durur.
