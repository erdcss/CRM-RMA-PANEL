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

Script bu sertifikaya uymayan keystore ile sürüm oluşturmayı **reddeder**.
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

## iOS: Codemagic

Kök dizindeki [codemagic.yaml](../codemagic.yaml) içinde
`caliskan-b2b-ios` iş akışı hazır.

1. Codemagic'te GitHub `erdcss/CRM-RMA-PANEL` deposunu bağlayın.
2. Apple Developer ve App Store Connect hesabına **kendi yetkinizle** bağlanın.
3. Codemagic → Code signing identities: `com.caliskangroup.rma` için
   **App Store Distribution** sertifikası ve provisioning profile sağlayın.
4. `caliskan-b2b-ios` iş akışını **manuel** çalıştırın.
5. IPA çıktı dosyasını kontrol edin. Otomatik TestFlight yüklemesi şimdilik **kapalı**.
   API anahtarları/sertifikalar doğrulandıktan sonra ayrı izinle etkinleştirilebilir.

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
