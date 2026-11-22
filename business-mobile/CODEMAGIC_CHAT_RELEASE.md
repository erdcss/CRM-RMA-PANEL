# Çalışkan Business — Codemagic sohbet derleme komutları

Çalışkan B2B ve Çalışkan Business **aynı GitHub deposundadır:** `erdcss/CRM-RMA-PANEL`. Mevcut **tek Codemagic uygulaması** bu deponun kökündeki `codemagic.yaml` dosyasından hem B2B (`mobile/`) hem Business (`business-mobile/`) iş akışlarını yürütür. İkinci Codemagic uygulaması, ek Codemagic app ID'si veya API token **gerekmiyor**.

## Sohbet komutları

| Komut | Sadece bu dosyayı main dalında güncelle | Codemagic iş akışı |
| --- | --- | --- |
| `Business TestFlight al` | `.github/release-requests/business-codemagic-testflight.txt` | `caliskan-business-ios-testflight` |
| `Business APK al` | `.github/release-requests/business-codemagic-apk.txt` | `caliskan-business-android-apk` |
| `Business AAB al` | `.github/release-requests/business-codemagic-aab.txt` | `caliskan-business-android-aab` |

ChatGPT bağlı GitHub aracılığıyla **yalnız talep edilen dosyada yeni bir commit** oluşturur. Commit içeriği her istekte farklı olmalı; yalnızca `main` dalına push yapılır. Codemagic'in mevcut GitHub push webhook'u `codemagic.yaml > triggering > when.changeset` koşuluna göre ilgili iş akışını seçer. Diğer uygulama ve platformların release dosyaları değişmediği için onların build'leri başlatılmaz. Üstelik iş akışlarının ilk adımı, `HEAD` commit'inin ilgili release dosyasını değiştirdiğini doğrular.

**Önemli:** `codemagic.yaml` dosyası değişiklikleri, Codemagic'in changeset mekanizmasında özel bir durumdur; ilk konfigürasyon güncellemesinde otomatik bir iş akışı denemesi görülebilir. İlk adımdaki commit koruması, talep dosyası olmadan pahalı derleme ve yayınlama aşamalarına geçişi engeller.

## Codemagic üzerinde hazır olması gerekenler

1. **Tek proje:** Codemagic'te `CRM-RMA-PANEL` deposu ve GitHub **push webhook'u** etkin olmalı.
2. **iOS Business:** Mevcut Apple Developer/App Store Connect entegrasyonu `com.caliskangroup.business` uygulamasına erişmeli. `codemagic.yaml` içerisinde entegrasyonun ismi `Codemagic Caliskan B2B`; Business bundle'ı için geçerli App Store dağıtım sertifikası ve provisioning profile gerekli. App Store Connect App ID: `6818161236`.
3. **Android Business:** Codemagic Code Signing Identities altında `caliskan_business_android_release` adıyla **mevcut** Business release/upload keystore'u kayıtlı olmalı. Daha önce Play'de yayımlandıysa yeni keystore üretmeyin.

`CODEMAGIC_API_TOKEN`, `CODEMAGIC_BUSINESS_APP_ID` ve ikinci bir Codemagic uygulaması gerekli değildir. Önceki GitHub Actions → Codemagic API tetikleyicisi kaldırılmıştır.

## Derleme ve yayınlama

- Business iOS bundle ve Android package: `com.caliskangroup.business`, Expo version `1.0.1`.
- `EXPO_PUBLIC_API_URL=https://admin.ecalisgan.com`.
- İş akışları önce Business logo ve splash dosyalarını CRM'den alır, sonra native Expo prebuild çalıştırır. Expo EAS Build kullanılmaz.
- **TestFlight**: IPA Codemagic'te üretilip yalnız TestFlight'a gönderilir; halka açık App Store yayını yapılmaz.
- **APK**: Codemagic Artifacts içinden indirilebilir kurulum paketi.
- **AAB**: Codemagic Artifacts içinden indirilebilir Play upload paketi; Google Play'e otomatik yükleme yapılmaz.
- Gerçek sonuç ve dosya bağlantısı, mevcut Codemagic projesinin build ekranından kontrol edilir. GitHub push'unun başarılı olması derlemenin tamamlandığı anlamına gelmez.
- Apple imzalama ve Android keystore gerçek bir native build yapılmadan tamamen doğrulanamaz.
