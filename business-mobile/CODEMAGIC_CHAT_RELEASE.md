# Çalışkan Business · Codemagic sohbet sürüm komutları

Bu proje Çalışkan Business uygulamasının native iOS / Android derlemelerini Expo EAS Build'e ihtiyaç duymadan Codemagic'te oluşturur. Çalışkan B2B'nin farklı bundle kimliğine sahip mevcut Codemagic iş akışları değiştirilmez.

## Sohbette kullanılacak komutlar

- **Business TestFlight al** → `caliskan-business-ios-testflight`; imzalı IPA oluşturup App Store Connect / TestFlight'a yükler. **Halka açık App Store'a yayınlamaz.**
- **Business APK al** → `caliskan-business-android-apk`; imzalı APK oluşturur.
- **Business AAB al** → `caliskan-business-android-aab`; Play Console'a hazır imzalı AAB oluşturur. **Google Play'e otomatik yüklemez.**
- **Business Codemagic bağlantısını kontrol et** → yalnız API erişimini kontrol eder, ücretli derleme başlatmaz.

ChatGPT GitHub bağlantısı üzerinden **yalnız** ilgili dosyayı oluşturmalı/güncellemelidir (yeni benzersiz istek metni ve değişiklik zamanı ile bir commit):

| Komut | GitHub release request dosyası |
| --- | --- |
| Ön kontrol | `.github/release-requests/business-codemagic-check.txt` |
| TestFlight | `.github/release-requests/business-codemagic-testflight.txt` |
| APK | `.github/release-requests/business-codemagic-apk.txt` |
| AAB | `.github/release-requests/business-codemagic-aab.txt` |

Push yalnız `main` dalında yapılır. GitHub Actions `.github/workflows/business-codemagic-chat-build.yml` yalnız değişen release-request yolunu inceler, Codemagic API'sine tam ilgili workflow ID'sini gönderir ve Codemagic build URL'sini GitHub Actions özetine yazar. Aynı commit'e birden çok marker eklenmemelidir. Manuel alternatif: GitHub Actions / Çalışkan Business - Codemagic Sohbet Derleme Komutları / Run workflow / artifact seçimi.

**Kuyruğa alınan build, tamamlanmış ve başarılı build değildir.** Codemagic'in ilgili build sayfasında sonucu doğrulayın; APK ve AAB dosyaları Artifacts altında olur. TestFlight yüklemesinde Apple işlem süresi ayrıca takip edilmelidir.

## Tek seferlik dış platform kurulumu

1. Codemagic'te `erdcss/CRM-RMA-PANEL` GitHub reposu tanımlı ve root `codemagic.yaml` etkin olmalı. Önceden kullanılan B2B Codemagic uygulaması aynı repo/workflow'ları içeriyorsa onu yeniden kullanabilirsiniz.
2. GitHub repo > Settings > Secrets and variables > Actions > **Secrets**: `CODEMAGIC_API_TOKEN`. Codemagic > Account Settings > API token üzerinden alın. Anahtarı sohbet veya kaynak koda yazmayın.
3. GitHub repo > Settings > Secrets and variables > Actions > **Variables**: `CODEMAGIC_BUSINESS_APP_ID` (Codemagic uygulaması URL'sinin 24 haneli ID'si). Mevcut `CODEMAGIC_APP_ID` de desteklenir. API'de aynı repository ile eşleşen tek Codemagic app varsa otomatik bulunabilir.
4. Codemagic Team integrations / Developer Portal: `Codemagic Caliskan B2B` adlı **mevcut** Apple API entegrasyonunun Business app'e de eriştiğini doğrulayın. Business App Store Connect Apple ID: `6818161236`, bundle: `com.caliskangroup.business`. Codemagic Code signing identities altında app_store distribution certificate ve Business bundle için geçerli provisioning profile olmalı. Eğer entegrasyon adı farklıysa `codemagic.yaml` içindeki Business iOS `integrations.app_store_connect` değerini mevcut gerçek adla güncelleyin.
5. Android AAB/APK için Codemagic Code signing identities > Android keystores bölümüne mevcut **Business release/upload keystore**'unu `caliskan_business_android_release` referans adıyla yükleyin. Google Play'de önceki anahtar ile yayın varsa yeni keystore üretmeyin; mevcut upload anahtarını güvenli biçimde yeniden kullanın. Keystore yedeğini ayrı saklayın.
6. `Business Codemagic bağlantısını kontrol et` komutuyla API erişimini sınayın. Sertifika ve keystore yalnız **gerçek imzalı build** sırasında doğrulanır.

## Teknik notlar

- Uygulama kimliği: iOS/Android `com.caliskangroup.business`; Expo app sürümü `1.0.1`.
- `EXPO_PUBLIC_API_URL=https://admin.ecalisgan.com` kullanılır.
- Native Expo prebuild, Codemagic üzerinde yapılır. EAS Build/Submit kullanılmaz. Eski EAS yapılandırması geri dönüş için silinmez.
- Logo/splash her native derleme öncesinde CRM API üzerinden senkronize edilir.
- `business-mobile/scripts/codemagic-build-version.cjs` Codemagic build sırasını tarih ile birleştirerek native build numarasını üretir. İlk Play AAB yüklemesinde Console'daki en yüksek versionCode ile karşılaştırın.
- `business-mobile/scripts/codemagic-android-signing.cjs` yalnız derleme makinesinde oluşturulan Gradle release signing ayarını değiştirir; özel anahtar içermez.
- İOS üretim App Store yayını bu iş akışları tarafından **kapalıdır**. Android AAB yalnız artefakt üretir, Play'e yüklemez.
