# Çalışkan B2B — ChatGPT üzerinden Codemagic TestFlight

## Bir kez yapılacak bağlantı

1. [Codemagic Applications](https://codemagic.io/apps) > **CRM-RMA-PANEL** uygulamasını açıp doğru kaynak GitHub deposunun `erdcss/CRM-RMA-PANEL` olduğundan emin olun.
2. Codemagic **Account Settings / Teams → API tokens** bölümünden erişim token'ı oluşturun.
3. GitHub > `erdcss/CRM-RMA-PANEL` > **Settings → Secrets and variables → Actions → New repository secret** alanına `CODEMAGIC_API_TOKEN` adıyla kaydedin. Token'ı kaynak koda, GitHub Issue'larına ya da ChatGPT mesajına yapıştırmayın.
4. İsteğe bağlı: Codemagic uygulamasının URL'sindeki 24 karakterlik ID'yi GitHub **Actions Variables** bölümüne `CODEMAGIC_APP_ID` olarak ekleyin. Eklenmezse API ile `CRM-RMA-PANEL` adına göre otomatik aranır.

## ChatGPT komutları

- **"Çalışkan B2B Codemagic bağlantısını doğrula":** ChatGPT GitHub'daki `.github/release-requests/b2b-codemagic-api.txt` içeriğine `Operation: verify` ekler. GitHub Actions, kimlik doğrulamasını ve uygulama erişimini kontrol eder. **Ücretli iOS derlemesi başlatılmaz.**
- **"Çalışkan B2B TestFlight al":** Aynı dosyaya `Operation: testflight` yazılır. GitHub Actions sürüm ve uygulama kimliğini doğrular, sonra Codemagic API `POST /builds` aracılığıyla `caliskan-b2b-testflight` akışını başlatır. GitHub Actions özetinde Codemagic derleme ID'si ve bağlantısı görünür.
- Alternatif olarak GitHub Actions > **Çalışkan B2B TestFlight - Codemagic Doğrudan API** > **Run workflow** menüsünden `verify` veya `testflight` çalıştırılabilir.

## Güvenlik kontrolleri

- **Kaynak:** `main`, doğru repo ve `com.caliskangroup.rma`.
- **Sürüm:** Apple'ın kapattığı `1.3.13` kanalından daha yüksek (mevcut `1.3.14`).
- **Hedef:** `caliskan-b2b-testflight`, yalnız TestFlight. `caliskan-b2b-ios` herkese açık App Store yayımlama akışıdır, kullanılmamalıdır.
- **Doğrulama:** Başlatma isteğinin API tarafından kabul edilmesi, IPA'nın veya Apple TestFlight yüklemesinin tamamlandığı anlamına gelmez; her iki sonuç ayrı kontrol edilir.
- **Şifreleme:** API anahtarı yalnızca GitHub Repository Secret olarak saklanır. CI günlüklerinde token asla yazdırılmaz.

## Hata kontrolü

- `CODEMAGIC_API_TOKEN missing`: GitHub Repository Secret ekleyin.
- `CODEMAGIC_APP_ID ...`: Değişken yanlış veya birden fazla uygulama eşleşiyor; Codemagic URL ID'sini ekleyin.
- `Apple 90062/90186`: Pazarlama sürümü mevcut onaylı sürümden büyük değil; `expo.version` yükseltilmeli.
- `Publishing failed`: Codemagic Publishing'in tam logunu kontrol edin. `90725` (Nisan 2027 SDK gereksinimi) bugünkü ana hata olmak zorunda değildir.

### Kontrol bağlantıları

- [GitHub Actions](https://github.com/erdcss/CRM-RMA-PANEL/actions)
- [GitHub Actions Secrets](https://github.com/erdcss/CRM-RMA-PANEL/settings/secrets/actions)
- [Codemagic uygulamaları](https://codemagic.io/apps)
- [Apple TestFlight](https://appstoreconnect.apple.com)
