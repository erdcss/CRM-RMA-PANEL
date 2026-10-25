# Çalışkan Dükkan Mobil — React Native

Bu uygulama Expo 54 üzerinde iOS/Android için doğrudan React Native ekranları kullanır; WebView veya Çalışkan Admin paneli içermez.

## Modüller
Genel bakış, alış/satış/iade faturaları, ürün/stok, stok hareketleri, cari hesap ve cari hareketler, siparişler, bankalar, kasa, ödeme/tahsilat, çek/senet, rapor ve işletme ayarları. Tüm tutarlar SQLite INTEGER kuruş alanlarında saklanır. Çok satırlı faturalarda tüm hareketler SQLite işlemiyle atomik kaydedilir.

## Veri taşınabilirliği
Mobil ve Windows `caliskan-dukkan-offline` aynı tablo adlarını kullanır. Mobil 'Yedeği içe aktar' Windows yedeğiyle mevcut mobil veriyi bütünüyle değiştirir; 'Yedeği paylaş' Windows'a tek dosya .sqlite aktarır. Değişiklikler aynı anda iki cihazda birleştirilmez. **Gerçek zamanlı PC-mobil senkronizasyonu bu sürümde yoktur**.

## iOS ve TestFlight
iOS için Expo/Apple hesaplarının kurulmuş olması ve Apple Developer + App Store Connect API anahtarı gerekir. GitHub Actions `Çalışkan Dükkan Yerel Mobil iOS Android` workflow'unda `native-check` TypeScript ve iOS/Android JS paketlerini kontrol eder. `testflight` işi yalnızca `workflow_dispatch` ile çalışır ve GitHub `testflight` environment içindeki `EXPO_TOKEN` secret'ını kullanır. Ayrıca Expo EAS projesi, imzalama sertifikası, uygulamanın doğru Apple hesabına bağlanması ve App Store Connect API anahtarı ayarlanmalıdır.

Çalıştırma: `cd dukkan-mobile && npm install && npm run check && npx expo start`.
Yükleme: Expo giriş ve Apple imzalama tamamlandıktan sonra `npx eas-cli build --platform ios --profile production --auto-submit --non-interactive`.

**Yasal uyarı:** Elektronik fatura/e-Arşiv GİB entegrasyonu bulunmaz, dahili fatura kaydı resmî vergi belgesi yerine geçmez. Ticari verilerin şifreli depolanması, yetki sistemi ve gerçek çok cihazlı senkronizasyon tamamlanmadan üretim şirket verileriyle kullanmayın.
## 25 Ekim 2026 gerçek TestFlight denemesi

- Expo hesabının GitHub `EXPO_TOKEN` erişimi doğrulandı (`erdcls` üzerinde Caliskan-CI-Build robot).
- Dükkan için **ayrı** EAS projesi oluşturuldu ve `app.json` içine kalıcı olarak bağlandı: `21b3de7c-763f-4c25-87aa-66e818498d6e`.
- `com.caliskan.dukkan` bundle ID doğrulandı, iOS `eas build --profile testflight --non-interactive` başlatıldı.
- **Bloke:** Expo EAS, yeni Dükkan uygulaması için Apple signing credentials/provisioning profile bulunmadığını bildirdi: `Credentials are not set up. Run this command again in interactive mode.`. `ipa` ve TestFlight gönderimi oluşturulamadı.
- Apple Developer takımı diğer uygulamalar ile aynıdır, fakat her benzersiz bundle ID için ayrı iOS App Store provisioning profile gerekir. Eski uygulamaların profilleri Dükkan için kullanılamaz.
- Bu uygulama için bir defalık Apple Developer signing kurulumu: `cd dukkan-mobile && npx eas-cli credentials -p ios` (mevcut Apple takımını seçip uygun App Store dağıtım sertifikası/provisioning profile oluşturarak EAS'a kaydet). Gizli Apple anahtarlarını GitHub'a commit etmeyin.
- App Store Connect'te `com.caliskan.dukkan` için **yeni uygulama kaydı** ve buna ait yeni `ascAppId` gereklidir. Eski iki uygulamanın `ascAppId` değerlerini asla kopyalamayın. Yeni kayıt hazır olduğunda `eas.json` `submit.testflight.ios.ascAppId` alanını güncelleyin ve Dükkan için EAS Submit Apple API anahtarı erişimini doğrulayın.
- Sonra `.github/workflows/dukkan-testflight-release.yml` iş akışını manuel başlatın veya kontrollü bir sürüm tetikleyicisi kullanın. Repo ortak `EXPO_TOKEN` bilgisini halihazırda kullanabilir.
- Deneme kaydı: https://github.com/erdcss/CRM-RMA-PANEL/actions/runs/40182819821
