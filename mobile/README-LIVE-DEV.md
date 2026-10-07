# Çalışkan B2B — Expo Live Development

Bu profil, ChatGPT/GitHub üzerinden yapılan React Native değişikliklerini fiziksel iPhone'da Expo Fast Refresh ile hızlıca görmek için hazırlanmıştır.

## Mimari

- Uygulama: **Çalışkan B2B Dev**
- iOS bundle: `com.caliskangroup.rma.dev`
- EAS profile: `development-ui`
- API: `https://admin.ecalisgan.com`
- Production/TestFlight uygulaması ayrı kalır.
- UI development build sırasında `niimbot-printer` iOS autolinking dışına alınır. Böylece NIIMBOT native SDK/linker problemi arayüz geliştirmesini bloklamaz.
- Production ve normal native build profillerinde NIIMBOT ayarlarına dokunulmaz.

## İlk kurulum

Repo kökünde güncel `main` branch'e geçin, ardından:

```bash
cd mobile
npm install
npm run device:register
npm run build:dev:ios
```

`device:register` iPhone'u EAS ad-hoc provisioning profiline kaydeder. Build tamamlanınca EAS'in verdiği kurulum bağlantısını iPhone'da açıp **Çalışkan B2B Dev** uygulamasını yükleyin.

iOS 16+ için cihazda **Ayarlar > Gizlilik ve Güvenlik > Geliştirici Modu** açık olmalıdır.

## Günlük canlı geliştirme

Telefon ve bilgisayar aynı Wi-Fi'daysa:

```bash
cd mobile
npm run dev:live
```

Farklı ağdaysanız:

```bash
cd mobile
npm run dev:live:tunnel
```

`dev:live` iki işi birlikte yapar:

1. Expo Dev Client / Metro'yu başlatır.
2. Repo temiz olduğu sürece `origin/main` değişikliklerini yaklaşık 4 saniyede bir güvenli şekilde `--ff-only` senkronize eder.

Böylece ChatGPT GitHub'a kod commit ettiğinde bilgisayar otomatik çeker ve Expo Fast Refresh değişikliği telefona gönderir.

## Güvenlik davranışı

Auto-sync hiçbir zaman:

- local değişiklikleri silmez,
- `git reset --hard` çalıştırmaz,
- branch geçmişini force etmez.

Local çalışma ağacı kirliyse otomatik senkronizasyon durur ve terminalde uyarı verir.

## Ne zaman yeni development build gerekir?

Aşağıdakiler Fast Refresh ile uygulanır ve yeniden build gerektirmez:

- ekran tasarımı,
- butonlar,
- metinler,
- React Native stilleri,
- API çağrıları,
- state/business logic,
- çoğu TypeScript/TSX değişikliği.

Aşağıdakiler native development build'in yeniden alınmasını gerektirir:

- yeni native package,
- iOS permission / Info.plist değişikliği,
- config plugin değişikliği,
- bundle identifier/scheme değişikliği,
- NIIMBOT native SDK entegrasyonu,
- Podfile/native iOS değişiklikleri.

## NIIMBOT

`development-ui` profilinde NIIMBOT native modülü bilinçli olarak build dışıdır. Bu profil arayüz ve uygulama akışı geliştirmek içindir. NIIMBOT testleri ayrı native build hattında yapılır.
