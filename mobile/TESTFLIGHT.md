# TestFlight Dağıtım Rehberi

## Önkoşullar

1. [Apple Developer Program](https://developer.apple.com/programs/) üyeliği
2. [App Store Connect](https://appstoreconnect.apple.com/) içinde uygulama kaydı
3. [Expo EAS](https://expo.dev/) hesabı
4. Supabase Auth içinde en az bir kullanıcı (e-posta + şifre)

## 1. EAS ve Apple bağlantısı

```bash
cd mobile
npm install -g eas-cli
eas login
eas init
```

`eas.json` içindeki şu alanları doldurun:

- `submit.production.ios.appleTeamId`
- `submit.production.ios.ascAppId`

## 2. iOS production build

```bash
npm run build:ios
```

İlk build sırasında EAS, Apple sertifikası ve provisioning profile oluşturmayı sorar.

## 3. TestFlight'a gönderme

```bash
npm run submit:ios
```

Alternatif:

```bash
eas submit --platform ios --profile production --latest
```

## 4. Supabase kullanıcı oluşturma

Supabase Dashboard → Authentication → Users → Add user

Mobil uygulamada `login` ekranından e-posta/şifre ile giriş yapılır.

## Notlar

- Expo Go ile auth test edilebilir; TestFlight build'i production profili kullanır.
- `mobile/.env` değerleri EAS Secrets üzerinden tanımlanmalıdır:

```bash
eas secret:create --name EXPO_PUBLIC_API_URL --value http://192.168.1.109:5000
eas secret:create --name EXPO_PUBLIC_SUPABASE_URL --value ...
eas secret:create --name EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY --value ...
```

Production API için kalıcı bir HTTPS URL kullanın.
