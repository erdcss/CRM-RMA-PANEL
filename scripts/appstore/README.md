# Çalışkan B2B + Çalışkan Business · App Store otomatik yayın

Bu klasör iki iOS uygulamasının **önceden TestFlight'a yüklenmiş** derlemesini Apple App Review'a gönderir. Apple onayladığında App Store'da otomatik yayınlanmasını seçer. EAS/TestFlight yüklemesi ayrı iş akışlarında tamamlanmış olmalıdır.

## Hedef uygulamalar

| Uygulama | Bundle ID | App Store Connect ID | Hedef sürüm kaynağı |
| --- | --- | --- | --- |
| Çalışkan B2B | `com.caliskangroup.rma` | `6802286663` | `mobile/app.json` |
| Çalışkan Business | `com.caliskangroup.business` | `6818161236` | `business-mobile/app.json` |

## Bir defalık Apple API anahtarı kurulumu

App Store Connect → Users and Access → Integrations → App Store Connect API ekranından uygun yetkili bir **Team API Key** oluşturun (Account Holder/Admin/App Manager izinleri gerekli olabilir). Şu üç değeri GitHub **Settings → Secrets and variables → Actions → Repository secrets** kısmına ekleyin:

- `APP_STORE_CONNECT_KEY_ID` — Apple Key ID (ör. `ABC123DEF4`).
- `APP_STORE_CONNECT_ISSUER_ID` — Apple Issuer ID (UUID).
- `APP_STORE_CONNECT_PRIVATE_KEY_BASE64` — Apple'ın yalnızca bir kez indirmeye izin verdiği `AuthKey_....p8` dosyasının **BASE64 metni**. Dosyanın kendisini, parolaları veya anahtarı repoya/sohbete koymayın.

Windows PowerShell ile (yalnızca kendi bilgisayarınızda):

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("C:\\Users\\<kullanici>\\Downloads\\AuthKey_XXXX.p8"))
```

macOS/Linux:

```bash
base64 < AuthKey_XXXX.p8 | tr -d '\n'
```

## Mevcut iki TestFlight sürümünü incelemeye gönder

1. App Store Connect'te iki uygulamanın **App Store** sürüm sayfalarında gerekli açıklama, ekran görüntüsü, gizlilik/yaş derecelendirmesi, ülkeler, fiyatlandırma, telif hakkı, export compliance ve **App Review iletişim/demonstrasyon oturum bilgilerini** tamamlayın. TestFlight'taki derlemenin Apple işlemeyi bitirdiğini kontrol edin.
2. GitHub → **Actions → Çalışkan B2B ve Business - App Store İnceleme ve Otomatik Yayın → Run workflow**.
3. `apps: both`, `confirm_publication: true` seçin. Derleme numarası alanlarını boş bırakırsanız Fastlane, hazırlanmış ilgili uygulama sürümündeki en güncel işlenmiş TestFlight derlemesini seçer. Eski derlemenin kazara seçilmesini önlemek için numara biliyorsanız özellikle girin.
4. B2B ve Business işlerindeki "İncelemeye gönder" adımları başarılıysa talep Apple'a iletilmiş olur. **Apple incelemesi bu noktada henüz tamamlanmış değildir.** Apple onayından sonra `automatic_release: true` sayesinde ayrıca manuel yayınlama beklemez.

GitHub üzerinde dosya `.github/release-requests/app-store-publication-20261026.txt` değiştirilirse iki uygulama için tek seferlik benzer bir gönderim başlatılır. Genel kod push'ları App Store yayını başlatmaz. İş akışı hedef bundle/ASC ID ve sürüm eşleşmesini kontrol eder; daha önce incelemede veya canlıda olan sürümü zorla iptal edip yeniden göndermez.

## Hatalar ve korumalar

- **Eksik secret:** Preflight hangi üç anahtarın eksik olduğunu söyler; özel anahtar çıktısını göstermez. GitHub'a ekleyip `Run workflow` ile yeniden deneyin.
- **Apple metadata/review bilgileri eksik:** Fastlane'in App Store Connect hatası giderilmelidir; asla sahte şirket, onay veya inceleme hesabı bilgisi üretilmez.
- **App sürümü eşleşmiyor:** Apple'a yüklenen ikili `app.json` sürümüyle eşleşmelidir. Yeni bir sürüm varsa önce EAS TestFlight gönderimi yapın.
- **App Review'da zaten mevcut:** Duplicate/review reject için önce mevcut Apple durumunu kontrol edin; otomasyon çalışan bir incelemeyi zorla reddetmez.
- **Halka açık yayın:** `automatic_release: true` ve `phased_release: false`. Apple ülke/bölge dağıtım ayarları ve fiyatlandırma mevcut App Store Connect ayarları olarak kalır.
- **Erişim:** Fastlane yalnız Apple API anahtarıyla kimlik doğrular; GitHub `EXPO_TOKEN` burada kullanılmaz, yeniden iOS derlemesi oluşturulmaz.

`scripts/appstore/fastlane/Fastfile` uygulamaların ID'lerini JSON ve beklenen hedeflerle ayrı ayrı karşılaştırır. Bir uygulamanın inceleme gönderimi başarısız olursa diğer uygulamanın bağımsız işi bundan etkilenmez.
