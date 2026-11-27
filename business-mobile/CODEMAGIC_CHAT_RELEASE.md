# Çalışkan Business — Codemagic sohbet derleme komutları

Tek GitHub deposu: erdcss/CRM-RMA-PANEL, main. Tek mevcut Codemagic uygulaması; kaynak business-mobile/.

| Komut | Yalnız bu talep dosyasını güncelle | Codemagic workflow |
| --- | --- | --- |
| Business TestFlight al | .github/release-requests/business-codemagic-direct-testflight.txt | caliskan-business-ios-testflight |
| Business APK al | .github/release-requests/business-codemagic-apk.txt | caliskan-business-android-apk |
| Business AAB al | .github/release-requests/business-codemagic-aab.txt | caliskan-business-android-aab |

iOS TestFlight: GitHub Actions .github/workflows/business-codemagic-direct-testflight.yml, Codemagic REST API; normal push/webhook otomatik iOS build başlatmaz. Önce aktif Business iOS build kontrol et. Her açık kullanıcı talebinde yalnız ilgili marker'ı farklı içerikle güncelle. Aynı commit içinde kod/config değiştirme. GitHub Actions Secrets CODEMAGIC_API_TOKEN (mevcut ortak token) gerekir; CODEMAGIC_BUSINESS_APP_ID veya CODEMAGIC_APP_ID yalnız otomatik app keşfi belirsizse gerekli. Eski business-codemagic-testflight.txt iOS tetikleyicisi artık kullanılmaz. Android webhook akışları değişmedi.

## Apple signing — ilk gerçek build öncesi Codemagic'te doğrula
- App Store Connect integration: Codemagic Caliskan B2B
- Team ID U3WGSDJCT2; Apple app ID 6818161236; bundle com.caliskangroup.business
- Certificate reference: caliskan_b2b_appstore_distribution
- Provisioning profile reference: caliskan_business_appstore_2027. App Store Connect profili Business bundle için oluşturulmalı, yukarıdaki distribution certificate ile eşleşmeli (Codemagic Certificate yeşil), push notification capability mevcut uygulamayla uyumlu olmalı. Bu profil Codemagic'te doğrulanmadan derleme başlatma.
- Apple son build numarası sorgulanarak artırılır. Pazarlama sürümü app.json'dan gelir; kapanmış Apple version train varsa sürüm güncellemesi ayrı değerlendirilir.
- CRM logo/splash senkronizasyonu, TypeScript, native prebuild, pod install, signed IPA kimlik kontrolü, TestFlight only. Expo EAS kullanılmaz; halka açık App Store review başlatılmaz.
- Build ID ve API sonucunu GitHub Actions loglarından kontrol et. Apple TestFlight işleme durumu ayrıca doğrulanmalı.
- Android APK/AAB için mevcut caliskan_business_android_release keystore; değiştirme.
