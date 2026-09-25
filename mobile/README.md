# Çalışkan RMA Mobile

Expo / React Native tabanlı iOS uygulama katmanı.

## Hedef

- Mevcut Express RMA API'sini iPhone üzerinden kullanmak
- RMA kayıtlarını listelemek ve detayını açmak
- RMA fişini cihazda PDF üretmek
- iOS paylaşım menüsü ile PDF göndermek
- Supabase Auth / Postgres / Storage ile merkezi veri ve belge depolamak

## Kurulum

```bash
cd mobile
npm install
npx expo install --fix
cp .env.example .env
npm run start
```

Fiziksel iPhone ile testte `EXPO_PUBLIC_API_URL` için `localhost` kullanmayın. Bilgisayarın aynı Wi-Fi ağındaki LAN IP adresini veya canlı HTTPS API adresini kullanın.

## Supabase

`.env`:

```env
EXPO_PUBLIC_API_URL=https://YOUR_API_HOST
EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

Service-role key mobil uygulamaya eklenmemelidir.

Supabase SQL Editor'da `../supabase/migrations/20260817_001_rma_storage.sql` dosyasını çalıştırın. Bu migration mevcut RMA tablolarını oluşturur/korur ve iki private bucket hazırlar:

- `rma-attachments`
- `rma-pdfs`

Backend tarafında root `.env` içindeki `DATABASE_URL`, Supabase PostgreSQL connection string olmalıdır. Mevcut `server/db.ts` bu değişkeni zaten kullanır.

## PDF

`lib/pdf.ts` Expo Print ile PDF üretir, Expo Sharing ile native iOS share sheet'i açar. `lib/storage.ts` oluşan PDF'yi private `rma-pdfs` bucket'ına arşivlemek için hazırlanmıştır.

## Sonraki güvenlik adımı

Storage RLS politikaları authenticated kullanıcı bekler. Production'a çıkmadan önce Supabase Auth giriş ekranı ve Express API üzerinde Supabase JWT doğrulaması eklenmelidir. Mevcut `users` tablosundaki düz metin parola yaklaşımı production için kullanılmamalıdır.
