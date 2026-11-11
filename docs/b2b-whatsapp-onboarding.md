# Çalışkan B2B · WhatsApp üyelik onayı ve destek

## Mevcut davranış

- B2B web ve mobil başvuruda ayrı, isteğe bağlı WhatsApp **üyelik/destek mesajı izni** sorulur; varsayılan kapalıdır.
- İzin seçimi kullanıcı ID'si ile veritabanında kaydedilir. Yeniden başvuruda izin yeniden alınır.
- Başvuru **onaylandıktan** ve e-posta şifresi başarıyla gönderildikten sonra, yalnızca izinli hesap için tek seferlik karşılama mesajı kuyruğu oluşur.
- WhatsApp mesajı **kullanıcı şifresi veya vergi numarası içermez**. Meta tarafından onaylanmış mesaj şablonu kullanılır.
- Yanıtlarda webhook imzası doğrulanır, mesajlar yönetici panelindeki B2B müşteri dashboard'unda gösterilir. Son müşteri mesajından sonraki **24 saat** içinde yönetici serbest metin yanıtı gönderebilir.
- Destek izni ile pazarlama izni birbirine karıştırılmaz. Gelen `DUR`, `STOP` ve `IPTAL` komutları WhatsApp bildirim iznini kapatır.
- API bilgileri tanımlı değilse **hiçbir WhatsApp mesajı gönderilmez**. Bekleyen işler en fazla 7 gün saklanır; süresi dolanlara gecikmiş karşılama yapılmaz.
- Aynı üyelik için idempotent tek karşılama kaydı vardır. Meta tarafından kabul edilen mesaj, tekrar otomatik gönderilmez.
- API'nin kabul yanıtı, telefonuna teslim edildiği anlamına gelmez. Teslim ve okunma webhook durumları ayrı izlenir.

## Meta kurulum adımları

1. Meta Business Manager'da Çalışkan B2B'nin kurumsal WhatsApp Business Account (WABA) hesabını ve müşterinin yanıtlayacağı **işletme telefon numarasını** ekleyin. Cloud API için geçerli `phone_number_id` alın.
2. Meta WhatsApp Manager > Message Templates alanında aşağıdaki **Utility** şablonunu oluşturup onaylatın. Kesin kategori Meta tarafından belirlenir.
3. Railway > CRM-RMA-PANEL > production Variables alanına sırları yalnızca Railway üzerinden ekleyin. GitHub'a, Expo'ya veya `EXPO_PUBLIC_` değişkenlerine sır eklemeyin.
4. Webhook callback: `https://admin.ecalisgan.com/api/webhooks/whatsapp`. WhatsApp uygulamasında `messages` olayına abone olun.
5. Meta webhook doğrulama token'ı ve app secret değerlerini Railway değişkenleriyle eşleştirin. WhatsApp Business Platform izinlerini ve erişim token'ının yetkilerini doğrulayın.
6. Test için **kendi kontrolünüzdeki, açıkça WhatsApp izni verilmiş yeni bir test hesabını** onaylayın. Gönderim `accepted`, `sent`, `delivered` ve `read` durumlarını müşteri dashboard'unda doğrulayın.
7. Müşteriden aynı sohbete bir mesaj gönderin. Müşteri dashboard'unda yanıtın göründüğünü ve 24 saatlik pencerede admin yanıtının kabul edildiğini doğrulayın.

## Railway ortam değişkenleri

| Değişken | Açıklama |
| --- | --- |
| `WHATSAPP_ACCESS_TOKEN` | Yalnızca sunucu tarafında kullanılan WhatsApp Cloud API kalıcı erişim token'ı |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp API işletme numarasının sayısal Meta ID'si |
| `WHATSAPP_WELCOME_TEMPLATE` | Meta tarafından onaylanan şablon adı: ör. `caliskan_b2b_welcome_support` |
| `WHATSAPP_WEBHOOK_VERIFY_TOKEN` | Meta webhook ayarlarında kullanılan güçlü rastgele doğrulama token'ı |
| `WHATSAPP_APP_SECRET` | Meta uygulamasının App Secret değeri; webhook HMAC imzasını doğrular |
| `WHATSAPP_GRAPH_VERSION` | İsteğe bağlı, varsayılan `v24.0`; Meta'da desteklenen güncel sürümle eşleştirin |

**Bunlardan biri eksikse** ilgili özellik yapılandırılmış kabul edilmez. Müşterilere gerçek mesaj gönderimi Meta bağlantısı ve şablon onayı tamamlanmadan açılamaz.

## Onaya gönderilecek şablon

**Ad:** `caliskan_b2b_welcome_support`

**Dil:** Türkçe `tr`

**Önerilen metin:**

Merhaba {{1}},

{{2}} firmasının Çalışkan B2B üyelik başvurusu onaylandı. Giriş bilgileriniz kayıtlı e-posta adresinize gönderildi.

Hesabınız veya siparişlerinizle ilgili sorularınız için bu WhatsApp sohbetine doğrudan yanıt verebilirsiniz.

Çalışkan B2B

Şablon gövdesinde **tam iki parametre** bulunmalıdır: `{{1}}` yetkili adı, `{{2}}` firma adı.

## Sınırlamalar

WhatsApp'ta müşteriye işletmenin başlattığı mesajlar, geçerli opt-in ve Meta onaylı şablon gerektirir. Müşteri serbest biçimde mesaj yazabilir; işletmenin serbest biçimli yanıtları yalnızca müşterinin son mesajından sonraki 24 saat içinde mümkündür. Otomatik yanıtlar için insan desteğine geçiş yolu korunmalıdır. Meta'nın güncel Business Policy hükümlerine uyun.

Doğrudan mesajlaşma **ücretsiz olduğuna dair bir garanti yoktur**; Meta ülke ve mesaj kategorisine göre ücret uygulayabilir.
