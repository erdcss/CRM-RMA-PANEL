# Çalışkan Dükkan Mobil — Bağlantılı Mağaza Sürümü

**26 Ekim 2026 geliştirme:** iOS/Android uygulaması artık `https://admin.ecalisgan.com/dukkan` üzerinden yönetilen mağaza hesabını güvenli bir WebView içinde açar. İlk açılışta Çalışkan Dükkan'a özel giriş sayfası sunulur. Kullanıcı adı/şifre, Çalışkan Admin'de tanımlanmış aktif kullanıcıdan doğrulanır; bu kullanıcının `dukkan_members` tablosunda mağazaya atanması şarttır. Oturum HttpOnly sunucu çereziyle korunur. Mobil cihaz işletmenin merkezi PostgreSQL ürün ve fatura kayıtlarına bağlıdır.

**Önemli geçiş:** Önceki sürümdeki React Native/SQLite çevrimdışı hesap sistemi uygulamanın kaynak kodunda korunmuştur, ancak bağlantılı sürümün açılış ekranı değildir. Mevcut mobil veya Windows yerel SQLite kayıtları sunucuya otomatik aktarılmaz; iki veri kaynağı karıştırılmaz. Önceki mobil sürümde yerel kayıtlar varsa yeni sürüme geçmeden önce yedeklenmelidir. Çevrimdışı çalışma bu bağlantılı sürümde desteklenmez.

## Tamamlanan özellikler

- Admin tarafından atanan kullanıcı adı ve şifreyle giriş; mağaza üyeliği kontrolü, rol bazlı veri izinleri
- Ürün ekleme ve yöneticinin ürün adı/kod/barkod/alış-satış fiyatlarını düzenlemesi
- Satış/alış ve iadeler için sunucu tarafında eşzamanlı çakışmaya dayanıklı **14 haneli sayısal dahili fatura numarası**
- Fatura ürün satırlarında Ürün, Miktar, Birim Fiyatı, KDV, Satır Tutarı ve Sil başlıkları
- Çalışkan Admin'deki `dukkan_logo` yüklemesi web giriş sayfasında ve uygulama üst alanında canlı görünür
- `npm run prepare:branding` Çalışkan Admin'in açık logo ayarını ve resim içeriğini doğrular; yeni native iOS/Android build için `1024×1024` PNG ikon üretir. Onaylı admin logosu bulunmazsa **ücretli EAS derlemesini başlamadan durdurur**.

## Geliştirme

`npm install` → `npm run check` → `npx expo export --platform ios`.

Yerel native ikon üretimi: `npm run prepare:branding`. Bu komut `https://admin.ecalisgan.com/api/public/branding` sayfasını ve `dukkan_logo` referansını kullanır; admin hesabı ve özel şifreleri dosyaya yazmaz.

App Store sürüm numarası yeni TestFlight derlemelerinde EAS'in uzaktan artan `buildNumber` değeriyle yönetilir; 1.0.0 Build 5 önceki gönderimdir.

**Resmî belge uyarısı:** 14 haneli dahili fatura numarası, GİB e-Fatura/e-Arşiv numarası veya resmî mali belge değildir. Resmî fatura entegrasyonu bulunmaz.

---

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

## 25 Ekim 2026 — İmzalama ve gerçek TestFlight denemeleri

- Expo robot hesabı `Caliskan-CI-Build` mevcut `EXPO_TOKEN` ile `erdcls` hesabına giriş yapabildi.
- Yeni EAS projesi `21b3de7c-763f-4c25-87aa-66e818498d6e` oluşturuldu ve `app.json` dosyasına kaydedildi.
- Apple Developer kayıtlı Bundle ID: `com.caliskan.dukkan`; Apple Team ID: `U3WGSDJCT2`.
- Kullanıcı App Store Connect'te Dükkan uygulamasını oluşturdu. ASC Apple ID `6826848065`, `eas.json` içinde `production` ve `testflight` submit profillerine kaydedildi.
- Gerçek `eas build --platform ios --profile testflight --non-interactive` denemeleri, **`Credentials are not set up. Run this command again in interactive mode.`** hatasıyla iptal edildi. `.ipa` oluşturulamadı, TestFlight'a teslim yapılmadı.
- Expo fatura döneminde dahil olan kotayı aşan derlemelerin ücretlendirildiğini bildirdi. **İmzalama tamamlanmadan yeni iOS derlemesi başlatmayın.** TestFlight workflow'u bu yüzden yalnızca manuel çalıştırılır.

### Kalan tek seferlik Apple imzalama kurulumu

`EXPO_TOKEN` Expo'ya yetki verir; Apple Developer oturumunun / uygulamaya özel App Store **provisioning profile**'ının yerine geçmez.

1. İlgili Apple Developer hesabında App Store dağıtım sertifikası ve `com.caliskan.dukkan` için **App Store** provisioning profile'ı oluşturun veya hazır profili doğrulayın. Mevcut B2B/Business sertifikalarını **iptal etmeyin**.
2. Yetkili Apple geliştirici hesabıyla `cd dukkan-mobile && npx eas-cli credentials -p ios` komutunu **etkileşimli ortamda** çalıştırın. `testflight` profilini seçin ve kullanılabilir dağıtım sertifikasını / Dükkan'a özel provisioning profile'ı EAS'e kaydedin.
3. EAS Submit için mevcut yetkili App Store Connect API anahtarını Dükkan projesine bağlayın (`eas credentials -p ios` → App Store Connect API Key). Apple özel anahtarlarını depoya, issue'ya veya sohbet metnine koymayın.
4. İmzalama ve EAS Submit anahtarı tamamlandıktan sonra `.github/workflows/dukkan-testflight-release.yml` üzerinden **Run workflow** (main) yapın. İş akışı yalnızca belirlenmiş Dükkan Apple uygulaması / Expo proje kimliklerini doğrulayıp mevcut kimlik bilgileriyle `.ipa` oluşturacak, başarılıysa TestFlight'a gönderecektir.
5. **Yalnızca** iOS build, EAS Submit ve App Store Connect TestFlight görünürlüğü başarıyla doğrulanınca süreç tamamlandı denebilir.

Kayıtlar: https://github.com/erdcss/CRM-RMA-PANEL/actions/runs/40182819821

### Üretim güvenliği

Bu sürüm tek cihaz SQLite yerel veri aktarımı kullanır; gerçek zamanlı Windows–mobil senkronizasyonu, GİB e-Fatura/e-Arşiv, kullanıcı yetkilendirmesi ve kapsamlı muhasebe güvenlik denetimi tamamlanmadı. Şirketin gerçek kayıtlarında üretim kullanımı için hazır değildir.
