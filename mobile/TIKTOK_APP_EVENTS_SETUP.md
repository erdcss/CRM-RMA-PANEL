# Çalışkan B2B · TikTok App Events iOS SDK (hazır, varsayılan kapalı)

**Platform:** iOS, bundle `com.caliskangroup.rma` (Expo 54 / React Native).

- Apple App Store Connect uygulama ID'si: `6802286663`.
- TikTok Events Manager uygulama kimliği: `7706102756574396437`.
- Resmi TikTok Business iOS SDK: `1.7.2`; CocoaPods üzerinden yerel Expo modülüne bağlanır.
- Web TikTok Pixel ID'si `DBOP5BRC77UASCMHAQ7G` bu SDK kimliği değildir.

## EAS ile etkinleştirme

1. TikTok Ads Manager → Events Manager → Çalışkan B2B uygulaması → SDK entegrasyon ayarlarında **App Secret** değerini bulun. Bu değeri GitHub'a, uygulama kaynaklarına veya ChatGPT'ye yazmayın.
2. Expo / EAS proje kimliği `4b798642-00ea-462b-af15-07b2a3a54c5c` için **production** ortamında `TIKTOK_APP_EVENTS_SECRET` isimli hassas ortam değişkenini kaydedin. `EXPO_PUBLIC_` öneki kullanmayın.
3. Yeni iOS *yerel* TestFlight IPA derlemesi alın; sadece OTA/JS güncellemesi yeterli değildir. SDK'nın CocoaPods kurulumu yeniden derleme gerektirir.
4. iOS uygulamasında Ayarlar → **TikTok Uygulama Ölçümü** ekranında izin verin. Bu izin Meta izninden bağımsızdır. İzin yoksa SDK başlatılmaz.
5. İsterseniz Ayarlar → Apple takip iznini yönet üzerinden ATT isteyin. Apple'ın izni, uygulama içi TikTok izninden ayrıdır.
6. Ayarlar → TikTok bağlantısını test et seçin; ardından TikTok Events Manager → Test Events üzerinde `LaunchAPP` olayını ve uygulama kimliğini doğrulayın. Native SDK'nın bir isteği kabul etmesi, TikTok'un aldığı anlamına gelmez.

## Güvenlik ve kapsam

- App Secret kaynak koduna **eklenmez**, Expo JavaScript `extra` alanına **konmaz**; EAS derlemesi sırasında Info.plist'e verilir.
- **Dikkat:** Mobil uygulama içine gömülmüş herhangi bir SDK anahtarı nihai IPA'dan çıkarılabilir. EAS ortam değişkeni yalnızca kaynak deposu/CI günlüğüne sızmayı önler; gerçek bir sunucu sırrı değildir.
- SDK otomatik install, launch, retention, payment ve enhanced data postback izlemesi başta kapalıdır. Yalnızca izin verildikten sonra açıkça gönderilen `LaunchAPP` olayını izlemeye başlar.
- Ad, telefon, e-posta, vergi numarası, sipariş tutarı, finansal bilgiler ve kullanıcı kimlikleri olaylara eklenmez.
- İzin kaldırılırsa SDK'nın takip yeteneği kapatılır. Ayrı Apple ATT istemi otomatik açılmaz.
- Apple App Store Connect App Privacy bildirimleri ve uygulama gizlilik politikası TikTok SDK'nın verilerine göre gözden geçirilmelidir.
- Henüz gerçek iOS IPA derlemesi, TikTok Events Manager olay alımı veya TestFlight doğrulaması yapılmamıştır. Bu adımlar için EAS App Secret gereklidir.
