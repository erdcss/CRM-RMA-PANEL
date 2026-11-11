# Çalışkan B2B — WhatsApp Tanıtım ve Kampanyalar

## Yeni sistem
- Eski destek sohbeti ve e-posta bağlantısı kaldırılmıştır.
- Web/mobil başvuruda isteğe bağlı, ayrı WhatsApp pazarlama izni (whatsappMarketingOptIn) toplanır.
- Eski hizmet/destek izinleri pazarlama izni olarak devralınmaz.
- Başvuru kaydından hemen sonra izinli firmaya, gerçek Meta Cloud API ve onaylı Marketing şablonu varsa bir kez otomatik tanıtım mesajı planlanır. Başvuru onayı beklenmez.
- Bağlantı yoksa tanıtım kuyruğu 72 saatte sona erer, rastgele gecikmiş otomatik gönderim yapılmaz.
- Yönetici sayfası: /whatsapp-kampanyalar; firma durumu bazında hedef kitle, taslak, onaylı şablon adı, başlat, durdur, rapor.
- DUR, STOP, İPTAL yanıtları geldiğinde ilgili numaranın pazarlama izni kapatılır.

## Meta bağlantısı
Gerçek +90 numaranın Phone Number ID'si (test numarasının değil) ve uygun Cloud API yetkileri zorunludur.
Telefon uygulamasında kullanılmaya devam edilecek mevcut numara için Coexistence onboarding gereklidir; standart taşıma yapılmamalıdır.
Meta WhatsApp Manager üzerinde Türkçe ve sıfır parametreli Marketing tanıtım şablonu hazırlanıp onaylatılmalıdır. Örnek ad: caliskan_b2b_basvuru_tanitim.
Kampanyalarda da değişkensiz ve Meta tarafından onaylanmış Marketing mesaj şablonları kullanılmalıdır.
Railway CRM-RMA-PANEL servisinde şu sunucu değişkenleri gerekir:
- WHATSAPP_ACCESS_TOKEN (gizli, üretim)
- WHATSAPP_PHONE_NUMBER_ID (gerçek API numarası)
- WHATSAPP_MARKETING_WELCOME_TEMPLATE (onaylı Marketing şablon adı)
- WHATSAPP_APP_SECRET (gizli)
- WHATSAPP_WEBHOOK_VERIFY_TOKEN (gizli)
- WHATSAPP_GRAPH_VERSION (isteğe bağlı, varsayılan v24.0)
Webhook: https://admin.ecalisgan.com/api/webhooks/whatsapp; Meta Developers içinde messages alanına abone olunmalıdır.

## Ücretler / güvenlik / sınırlar
Harici sağlayıcı aboneliği gerekmeyebilir ancak Meta şablon mesajları ücretli olabilir.
Tam otomasyon izinli ve onaylı şablonlu kişilere sınırlıdır. Kayıt onayında manuel destek sohbeti açılmaz.
Gerçek Cloud API bağlantısı olmadan kampanya taslağı hazırlanabilir ancak mesaj iletilemez.
Önceden kayıtlı müşteriler, yeni ve açık pazarlama izni vermeden kampanyaya dahil edilemez.
Meta mesaj ID'si ve webhook statüleri raporda takip edilir; teslimat garantisi verilmez.