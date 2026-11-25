# Çalışkan B2B — Zorunlu tipografi standardı

Bu kurallar yalnızca `mobile/` içindeki Çalışkan B2B uygulamasının iOS, Android ve web ön izlemesi için geçerlidir.

- Tek yazı tipi: **Poppins Regular (400)**. Font dosyası uygulamaya dahildir; dış CDN kullanılmaz.
- Kalın yazı (500–900, bold, semibold), italik ve harf aralığı (letterSpacing) kesinlikle kullanılmaz. Harf aralığı 0'dır.
- Görsel hiyerarşi yalnızca font boyutu, satır yüksekliği, renk ve yerleşimle kurulur. Küçük metinlerde okunabilirlik korunur.
- Ürün kartları, fiyatlar, başlıklar, giriş ekranları, menüler, form alanları, uyarılar, modal ve alt navigasyon aynı kurala tabidir.
- `components/ui/AppTypography.tsx` merkezi, değiştirilemez tipografi sözleşmesidir. Babel politikası tüm birinci taraf React Native Text / TextInput / Animated.Text kullanımlarını bu bileşenlere yönlendirir ve son stil olarak kilitli tipografiyi uygular.
- Yeni UI geliştirmelerinde doğrudan bu bileşenleri kullan; yeni font ailesi, kalınlık veya letterSpacing tanımlama. Kuralı devre dışı bırakma.
- `npm run typecheck` sırasında tipografi testi zorunludur. Testleri kaldırmak veya gevşetmek yasaktır.
- İkon fontları, marka logoları, yüklenen görseller, dış ödeme sayfaları ve iOS/Android işletim sistemi arayüzleri uygulama yazısı değildir; bunlara zorla Poppins uygulama. PDF ve yazıcı çıktıları ayrı çıktı tasarımıdır.

Kullanıcının açık talebi olmadan bu standart değiştirilmez.
