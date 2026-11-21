# Çalışkan B2B — Firma onayında otomatik WhatsApp bildirimi

## Gönderim koşulları
1. Yeni B2B başvurusunda `whatsappApprovalOptIn: true` şeklinde **ayrı ve isteğe bağlı hizmet bildirimi izni** kaydedilir. Pazarlama izni bu amaçla kullanılmaz.
2. Yönetici `POST /api/admin/b2b-applications/:id/approve` ile firmayı onaylar.
3. Sunucu önce tek kullanımlık şifre e-postasını gönderir, hesabı aktive eder ve `credentials_sent_at` kaydeder.
4. Yalnızca onaylı, izinli ve geçerli numaralı firmaya **bir kez** WhatsApp Utility şablon mesajı kuyruğa alınır. Sunucu yapılandırılmışsa kuyruk hemen işlenir; worker 15 saniyede bir kontrol eder.
5. Webhook `sent`, `delivered`, `read`, `failed` durumlarını kaydeder. Belirsiz sonuçlar otomatik yeniden gönderilmez.
6. İzin vermeyen veya daha önce kayıt olup bu ayrı izni vermemiş firmalara WhatsApp gönderimi yapılmaz. E-posta onay akışı aynen çalışır.

## Meta WhatsApp Manager — onaylatılacak mesaj şablonu
Kategori: **Utility**. Teknik ad önerisi: `caliskan_b2b_firma_onayi`. Dil: `tr`.

```text
Merhaba {{1}},

Çalışkan B2B firma üyelik başvurunuz onaylanmıştır.

Hesabınıza ilk girişte kullanacağınız tek kullanımlık şifreniz kayıtlı {{2}} e-posta adresinize gönderilmiştir.

E-postanızı kontrol ederek hesabınıza giriş yapabilir ve şifrenizi oluşturabilirsiniz.

Çalışkan B2B'ye hoş geldiniz.
b2b.ecalisgan.com
```

Şablonun **gövdesinde** sırasıyla iki konumsal değişken (`{{1}}`, `{{2}}`) bulunmalı. Birincisi firma adı, ikincisi kayıtlı e-posta adresidir. Şablon gövdesi dışında zorunlu dinamik düğme veya başlık kullanmayın. Şifrenin kendisi WhatsApp'a gönderilmez.

## Sunucu ayarları (Railway → CRM-RMA-PANEL → Variables)
- `WHATSAPP_ACCESS_TOKEN` — üretim için uygun Meta system user token (gizli)
- `WHATSAPP_PHONE_NUMBER_ID` — gerçek WhatsApp Cloud API numarasının Phone Number ID değeri
- `WHATSAPP_APPROVAL_TEMPLATE_NAME` — Meta tarafından onaylanmış Utility şablonun teknik adı
- `WHATSAPP_APPROVAL_TEMPLATE_LANGUAGE` — isteğe bağlı, varsayılan `tr`
- `WHATSAPP_GRAPH_VERSION` — isteğe bağlı, varsayılan `v24.0`
- Teslimat durumu için ayrıca mevcut `WHATSAPP_APP_SECRET`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` ve `https://admin.ecalisgan.com/api/webhooks/whatsapp` üzerindeki **messages** webhook aboneliği kullanılır.

Yalnızca token ve Phone Number ID eklenmesi yeterli değildir; gerçek gönderen numara Cloud API'ye kayıtlı, uygulama yetkileri uygun ve Utility şablonu **APPROVED** olmalıdır. Var olan WhatsApp Business uygulaması numarasını kullanacaksanız Meta Coexistence koşullarını doğrulayın.

## İzleme
- Yönetici: Firma detayı → **Otomatik WhatsApp Onay Bildirimi** alanı.
- Durum API: `GET /api/admin/b2b-approval-whatsapp/:id` (yalnızca yönetici erişir).
- Postgres tabloları: `b2b_wa_approval_consent`, `b2b_wa_approval_deliveries`.
- Aynı `user_id + approved_at` için tek kayıt: yeniden isteme veya sayfa yenilemede çift mesaj gönderilmez.
- 24 saati geçen bekleyen bildirimler gönderilmez. Ağa gönderimin kesinleşmediği durumlar otomatik tekrar denenmez.
- Telefonu  `+90 5xx xxx xx xx` formatında doğrulayın.

## Test
1. Meta üzerinden Utility şablonunu onaylatın ve Railway değişkenlerini kaydedin.
2. Ayrı WhatsApp bildirim izni işaretlenmiş **test firması** ile başvurun.
3. Yönetici panelinden onaylayın. E-posta gönderimi başarılı olmalı.
4. Gönderim durumunun önce `pending` → `accepted`, ardından webhook ile `sent`/`delivered` ilerlediğini doğrulayın.
5. Bildirim izni işaretlenmemiş başvuruda WhatsApp çağrısı olmamalı.
6. E-posta başarısız onayda hesap beklemede kalmalı ve WhatsApp'a ileti kuyruğu oluşmamalı.
