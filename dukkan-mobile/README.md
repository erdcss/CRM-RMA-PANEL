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