# Çalışkan iOS TestFlight – Yetkilendirme ve yayın kontrolü

## 16 Ekim 2026: Tespit edilen engel

İki GitHub Actions işi de **Missing EXPO_TOKEN** nedeniyle EAS build başlamadan kapandı. Bu bir React Native kod derleme hatası değildir.

## İki uygulamanın hedefi

| Uygulama | Expo proje kimliği | Bundle ID | App Store Connect app ID |
| --- | --- | --- | --- |
| Çalışkan B2B | `4b798642-00ea-462b-af15-07b2a3a54c5c` | `com.caliskangroup.rma` | `6802286663` |
| Çalışkan Business | `aa005486-76a0-41cd-92de-33c2070a73f1` | `com.caliskangroup.business` | `6818161236` |

## Zorunlu tek seferlik yetkilendirme

1. [Expo Access Tokens](https://expo.dev/settings/access-tokens) sayfasına **her iki Expo projesine erişimi olan** hesapla girin. **Create token** ile bir erişim anahtarı oluşturun.
2. [GitHub Actions Secrets](https://github.com/erdcss/CRM-RMA-PANEL/settings/secrets/actions) ekranında **New repository secret** seçin. Name: `EXPO_TOKEN`. Value: Expo üzerinden aldığınız gizli erişim anahtarı.
3. Anahtarı **koda, commit'e, issue'a, sohbete veya açık .env dosyasına yazmayın.**
4. [TestFlight Actions](https://github.com/erdcss/CRM-RMA-PANEL/actions/workflows/testflight-all-apps.yml) sayfasına gidin. **Run workflow** → branch `main` → `app: all` → **Run workflow**.
5. İki işin de `Check Expo credentials`, `Verify Expo account`, `Build signed iOS application`, `Submit iOS build to TestFlight and wait for result` adımlarını geçmesi gerekir.

## Expo kimlik doğrulamasından sonra başka engel oluşursa

- Expo erişim anahtarı iki projeye de yetkili olmalı.
- iOS Distribution certificate ve provisioning profile EAS üzerinde daha önce kurulmuş olmalı; yoksa geliştirici hesabıyla bir defa etkileşimli `eas build --platform ios --profile testflight` gerekir.
- Her uygulama için **App Store Connect API Key** EAS tarafında kurulmuş olmalı. [Expo'nun resmi iOS submit yönergesi](https://docs.expo.dev/submit/ios/) non-interactive submit'in anahtarı kendiliğinden oluşturamadığını açıklar. Eksikse `eas credentials --platform ios` üzerinden **App Store Connect: Manage your API Key** kurulumu yapın.
- Çalışkan Business sürüm kaynağı EAS üzerinde `remote` olarak değiştirildi. EAS'deki ilk build numarasının App Store Connect'teki **son build numarasından yüksek** olmasını doğrulayın. Gerekirse `eas build:version:set` ile en son gönderilmiş build numarasını temel alın.
- Gerçek TestFlight kullanımına geçmeden önce App Store Connect işleme sürecinin ve test kullanıcılarının durumunu kontrol edin.

## İş akışının güvenli davranışı

- Sürüm gönderimleri yalnızca manuel `workflow_dispatch` ile tetiklenir.
- İki uygulama birbirinden ayrı işlerdir; yalnızca biri de seçilebilir.
- Kimlik doğrulaması yoksa hiçbir iOS derleme ya da yükleme yapılmaz.
- **Gerçek gönderim başarılı sayılabilmesi için** GitHub Actions'ın iki işinde de submit adımının başarılı bitmesi, sonrasında da App Store Connect'te TestFlight buildinin görünmesi gerekir.
- Railway web build'i TestFlight iOS binary build'i değildir.
