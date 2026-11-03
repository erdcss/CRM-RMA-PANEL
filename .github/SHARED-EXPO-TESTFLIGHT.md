# Ortak Expo ile GitHub/ChatGPT üzerinden TestFlight

## Güvenlik modeli

Bu GitHub deposu Çalışkan B2B'nin mevcut, aktif `EXPO_TOKEN` GitHub Actions Secret bilgisini kullanır. Tokenın değeri hiçbir zaman okunmaz, yeni depoya kopyalanmaz, commit'e ya da sohbete yazılmaz.

Kullanılan `@erdcls` Expo hesap erişiminin M.A.Y.K gibi her uygulamaya da yetkili olması gerekir. **Tek token, tek uygulama demek değildir**; Expo robot hesabının yetkili olduğu projelerde kullanılabilir.

## Uygulamalar

| GitHub deposu | Proje yolu | Uygulama | EAS build/submit profili |
|---|---|---|---|
| `erdcss/CRM-RMA-PANEL` | `mobile` | Çalışkan B2B | `testflight` |
| `erdcss/CRM-RMA-PANEL` | `business-mobile` | Çalışkan Business | `testflight` |
| `erdcss/CRM-RMA-PANEL` | `dukkan-mobile` | Çalışkan Dükkan | `testflight` |
| `erdcss/AI-PROGRES` (public) | `mayk-ios` | M.A.Y.K | `production` |

M.A.Y.K kaynak deposu bu workflow tarafından GitHub Actions esnasında **salt-okunur** checkout edilir. Bu yöntemle aynı robot tokenı kullanan CRM-RMA-PANEL üzerinden EAS erişimi sağlanır; M.A.Y.K GitHub deposuna ayrıca gizli token kopyalamak gerekmez.

`erdcss/turmarkt_mobill` **private** depodur. Bu merkezi akışın `GITHUB_TOKEN` yetkisi özel depoyu okumaya yeterli değildir. Turmarkt ve T Business'ın kendi GitHub Actions workflow'ları vardır; aynı Expo robot tokenını **ayrıca o depoya GitHub Actions Secret `EXPO_TOKEN` olarak kaydetmek** veya GitHub App/deploy tokenı üzerinden güvenli private checkout erişimi oluşturmak gerekir. Mevcut private depoya bu merkezi workflow üzerinden erişim varmış gibi davranılmaz.

## Kullanım (GitHub Actions)

1. [Ortak Expo TestFlight Merkezi](https://github.com/erdcss/CRM-RMA-PANEL/actions/workflows/shared-expo-testflight-hub.yml) → **Run workflow**
2. `app`: `b2b`, `business`, `dukkan` veya `mayk`
3. `operation = verify` ilk kullanımda **kod/Expo proje erişimi kontrolü** yapar; iOS derlemesi başlatmaz.
4. Uygun imzalama ve App Store Connect API key hazırsa `operation = testflight` iOS build ve otomatik TestFlight gönderimini çalıştırır.
5. M.A.Y.K için `mayk_asc_app_id`: App Store Connect'te M.A.Y.K uygulamasının App Information sayfasındaki **sayısal Apple ID**. Apple Developer Team ID veya Expo Project ID ile karıştırma.

M.A.Y.K canlı logo kaynağı `https://progres.turmarkt.com/api/mayk/branding/icon.png` zorunlu tutulur; logo indirilemezse yayınlama durdurulur. Gerçek iOS ikonunun oluşturulması ve Apple'ın TestFlight işlemeyi tamamlaması farklı aşamalardır.

## ChatGPT/Codex üzerinden aynı merkezi bağlantıyla yayınlama

Bu workflow yalnızca manuel seçimle veya **açıkça oluşturulmuş bir sürüm isteği** ile tetiklenir. Bu istekleri oluşturarak mevcut robot tokenını kullanmak mümkün olur:

`.github/release-requests/central-ios/<benzersiz-ad>.json`

Örnek M.A.Y.K ön kontrol (yeni bir dosya; aynı dosyayı düzenleme):

```json
{
  "app": "mayk",
  "operation": "verify"
}
```

M.A.Y.K TestFlight (Apple uygulaması ve imzalama hazırlandıktan sonra):

```json
{
  "app": "mayk",
  "operation": "testflight",
  "maykAscAppId": "APPLE_CONNECT_SAYISAL_ID"
}
```

Bu dosya **doğrudan `main` dalına** yeni commit ile eklendiğinde yalnızca bu merkezi workflow başlar. Sürüm isteği gözden geçirilmeden testflight seçilmemelidir. Apple API Key Expo EAS'te uygulamaya bağlanmış olmalıdır; tek `EXPO_TOKEN` Apple sertifikalarının yerini alamaz.

## Apple imzalama / diğer sınırlamalar

- M.A.Y.K ilk iOS TestFlight için `eas credentials --platform ios` → `production` profili altında doğru **App Store distribution** sertifikası, provisioning profile ve App Store Connect API Key bağlantısı hazır olmalıdır.
- B2B, Business, Dükkan var olan Apple/EAS kimliklerini kullanır; başka uygulamaların sertifikaları silinmez veya değiştirilmez.
- Bu sistem yalnızca uygulama sahibinin açık isteğiyle build/submit çalıştırır. App Store'a kamuya açık yayın başlatmaz.
- TestFlight yüklemesi tamamlandıktan sonra Apple'ın işlemesi ve test gruplarına dağıtımı ayrıca kontrol edilmelidir.
