import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, FileText, LockKeyhole, Mail, ShieldCheck } from "lucide-react";

const updatedAt = "26 Ekim 2026";

const sections: { title: string; paragraphs?: string[]; bullets?: string[] }[] = [
  {
    title: "1. Kapsam ve veri sorumlusu",
    paragraphs: [
      "Bu gizlilik politikası, Çalışkan B2B markasıyla sunulan internet sitesi ve iOS/Android mobil uygulamalarının kullanımı sırasında kişisel verilerin işlenmesine ilişkin genel bilgilendirme amacıyla hazırlanmıştır. Veri işleme faaliyetlerinden, Çalışkan B2B hizmetini işleten tüzel veya gerçek kişi, ilgili faaliyet kapsamında veri sorumlusu sıfatıyla sorumludur.",
      "Veri sorumlusuna ilişkin güncel ticaret unvanı ve resmi iletişim bilgilerinin teyidi için aşağıdaki Destek Merkezi üzerinden iletişime geçebilirsiniz. Bu bilgiler yayın öncesinde ayrıca tamamlanmalıdır."
    ]
  },
  {
    title: "2. İşlenebilen kişisel veriler",
    bullets: [
      "Hesap ve kimlik bilgileri: ad, soyad, e-posta, telefon, giriş ve hesap bilgileri.",
      "İşletme ve ticari bilgiler: firma adı, vergi/fatura bilgileri, yetkili kullanıcı bilgileri.",
      "Sipariş ve teslimat verileri: ürünler, miktarlar, fiyatlar, adresler, sipariş ve iade geçmişi.",
      "Hesap/Defterim içerikleri: kullanıcı tarafından oluşturulan cari kayıtlar, notlar ve işletme finans takibi bilgileri.",
      "Destek iletişimleri: destek taleplerinin konusu, mesajlar ve talebe eklenen bilgiler.",
      "Teknik ve kullanım verileri: IP adresi, cihaz ve tarayıcı bilgileri, oturum güvenliği kayıtları, hata günlükleri ve uygulama etkileşimleri., kullanıcının izin vermesi halinde bildirim gönderimi için push belirteçleri."
    ]
  },
  {
    title: "3. Verileri işleme amaçları",
    bullets: [
      "Kayıt, kimlik doğrulama, hesap açma ve kullanıcı yetkilendirmesi işlemlerini yürütmek.",
      "Toptan ürünleri görüntüleme, teklif/sipariş oluşturma ve sipariş süreçlerini işletmek.",
      "Ödeme, faturalama, kargo, iade ve müşteri desteği süreçlerini gerçekleştirmek.",
      "İsteğe bağlı hesap, liste ve Defterim içeriklerini kullanıcıya sunmak.",
      "Dolandırıcılığı önlemek, sistem güvenliğini sağlamak ve teknik sorunları gidermek.",
      "Mevzuattan doğan muhasebe, saklama ve resmi kurumlara karşı yükümlülükleri yerine getirmek.",
      "Uygulamanın kullanımını, performansını ve hizmet kalitesini ölçüp geliştirmek."
    ]
  },
  {
    title: "4. Hukuki sebepler",
    paragraphs: [
      "Kişisel veriler, uygulanabildiği ölçüde 6698 sayılı Kişisel Verilerin Korunması Kanunu'nun 5. ve 6. maddelerinde öngörülen hukuki sebeplere dayanılarak işlenir. Bunlar sözleşmenin kurulması veya ifası, hukuki yükümlülüklerin yerine getirilmesi, bir hakkın tesisi/kullanılması/korunması ve temel haklara zarar vermemek koşuluyla meşru menfaat olabilir. Açık rıza gerektiren işlemlerde ayrıca uygun bir rıza mekanizması işletilmelidir."
    ]
  },
  {
    title: "5. Paylaşım, hizmet sağlayıcılar ve yurt dışı",
    paragraphs: [
      "Siparişlerin yerine getirilmesi veya teknik hizmetlerin sağlanması gerektiğinde veriler; yetkili çalışanlar, ilgili tedarikçiler, ödeme hizmeti sağlayıcıları, kargo firmaları, barındırma/altyapı ve destek hizmeti sağlayıcılarıyla sadece ilgili amaç için gerekli olduğu ölçüde paylaşılabilir. Kanuni zorunluluk bulunan hâllerde yetkili kamu kurum ve kuruluşlarına da bilgi aktarılabilir.",
      "Kullanılan altyapı veya hizmet sağlayıcının konumuna bağlı olarak yurt dışına veri aktarımı söz konusu olabilir. Böyle bir aktarım, yürürlükteki KVKK şartlarına ve gerekli güvencelere uygun şekilde değerlendirilmelidir. Uygulamada kullanılan tedarikçi ve aktarım mekanizmalarının kesin listesi yayın öncesinde teyit edilmelidir."
    ]
  },
  {
    title: "6. Saklama, koruma ve güvenlik",
    paragraphs: [
      "Kişisel veriler, işleme amacı için gereken süre boyunca ve varsa vergi, ticaret, muhasebe ve diğer mevzuatta belirtilen saklama sürelerine uygun olarak tutulur. Süre sonunda, yasal saklama yükümlülüğü bulunmayan veriler ilgili mevzuat çerçevesinde silinir, yok edilir veya anonimleştirilir.",
      "Verilerin korunması için erişim yetkilendirmesi, oturum güvenliği, iletişim güvenliği ve hizmetin niteliğine uygun idari/teknik tedbirlerin uygulanması hedeflenir. İnternet üzerinden veri iletiminin mutlak güvenliği garanti edilemez."
    ]
  },
  {
    title: "7. Çerezler, cihaz izinleri ve analiz",
    paragraphs: [
      "Web sitesinde oturumun sürdürülmesi, güvenlik ve temel işlevler için çerezler veya benzer depolama teknikleri kullanılabilir. Mobil uygulama; kullanıcı tarafından izin verilen kamera, bildirim veya benzeri cihaz özelliklerine ilgili işlevlerin sağlanması amacıyla erişebilir. Kullanım ve hata kayıtları hizmet kalitesini iyileştirmek için değerlendirilebilir.",
      "B2B web mağazasındaki Meta Pixel yalnızca ziyaretçinin reklam ve ölçüm çerezlerine açıkça izin vermesi üzerine yüklenir. İzin verilirse sayfa görüntüleme, ürün görüntüleme, arama, sepete ekleme, ödeme başlatma, doğrulanmış satın alma ve yeni kayıt başvurusu gibi etkileşimlerin olay bilgileri Meta ile paylaşılabilir.",
      "Meta Conversions API erişimi sunucuda etkinleştirilmişse ve ziyaretçi ölçüme izin vermişse, doğrulanmış satın alma olayları eşleştirme amacıyla SHA-256 ile özetlenmiş e-posta ve sınırlı teknik bilgilerle Meta tarafına iletilebilir. Meta hizmetleri nedeniyle yurt dışına aktarım söz konusu olabileceğinden, veri sorumlusu gerekli KVKK değerlendirmelerini ayrıca yapmalıdır.",
      "Bu isteğe bağlı ölçümden vazgeçmek veya yeniden izin vermek için web mağazası altındaki Reklam ve çerez tercihleri bağlantısını kullanabilirsiniz. Ret halinde Meta Pixel yüklenmez; site alışveriş işlevleri devam eder."
    ]
  },
  {
    title: "8. Haklarınız ve hesap silme",
    paragraphs: [
      "KVKK'nın 11. maddesi uyarınca verilerinizin işlenip işlenmediğini öğrenme, işlenmişse bilgi talep etme, işleme amacını öğrenme, yanlış veya eksik verilerin düzeltilmesini isteme, şartları varsa silinmesini veya yok edilmesini talep etme ve kanunda belirtilen diğer haklarınızı kullanabilirsiniz.",
      "Çalışkan B2B hesabınızda Hesabım → Ayarlar → Hesabımı Sil seçeneğinden, mevcut şifreniz ve açık onayınız ile hesabınızı kapatabilirsiniz. Bu işlem giriş erişiminizi kaldırır ve profil bilgileriniz ile kayıtlı adres ve ödeme yöntemi tercihlerinizi siler. Sipariş, fatura ve kanunen muhafazası zorunlu ticari kayıtlar ilgili yükümlülükler boyunca saklanabilir. Diğer kayıtlarınızın incelenmesi ve kişisel veri talepleriniz için Destek Merkezi üzerinden başvurabilirsiniz."
    ]
  },
  {
    title: "9. Güncellemeler",
    paragraphs: [
      "Ürün özellikleri, yasal gereklilikler veya veri işleme süreçleri değiştiğinde politika güncellenebilir. Güncel metin bu sayfada yayımlanır. Önemli değişiklikler gerektiğinde uygulama içinden veya uygun bir iletişim kanalıyla ayrıca duyurulabilir."
    ]
  }
];

export default function B2BPrivacyPage() {
  useEffect(() => {
    const oldTitle = document.title;
    document.title = "Gizlilik Politikası ve KVKK | Çalışkan B2B";
    return () => { document.title = oldTitle; };
  }, []);

  return (
    <div className="min-h-screen bg-[#f7f7f5] text-zinc-900">
      <header className="border-b border-zinc-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 text-lg font-black tracking-tight">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffcc00] text-xl font-black">Ç</span>
            <span>Çalışkan <strong>B2B</strong></span>
          </Link>
          <Link href="/" className="inline-flex min-h-11 items-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold hover:bg-zinc-100">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Ana Sayfa
          </Link>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
        <section className="rounded-3xl bg-[#111315] px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.15em] text-[#ffcc00]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" /> ÇALIŞKAN B2B
          </div>
          <h1 className="mt-5 max-w-3xl text-3xl font-black leading-tight sm:text-5xl">Gizlilik Politikası ve KVKK</h1>
          <p className="mt-5 max-w-2xl text-sm leading-7 text-zinc-300 sm:text-base">
            Bilgilerinizin hangi amaçlarla işlendiği, nasıl korunduğu ve kişisel verilerinizle ilgili haklarınız hakkında açıklamalar.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs text-zinc-200">
            <FileText className="h-4 w-4" aria-hidden="true" /> Son güncelleme: {updatedAt}
          </div>
        </section>

        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_250px] lg:items-start">
          <article className="min-w-0 rounded-3xl border border-zinc-200 bg-white px-5 py-6 shadow-sm sm:px-9 sm:py-9">
            <p className="mb-8 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-6 text-amber-950">
              Bu metin genel bilgilendirme niteliğindedir. Veri sorumlusunun resmi unvanı ve iletişim bilgileri ile kullanılan üçüncü taraf hizmetlerin kapsamı yayın sorumlusu tarafından doğrulanmalıdır.
            </p>
            <div className="space-y-9">
              {sections.map((section, index) => (
                <section key={section.title} id={`bolum-${index + 1}`} className="scroll-mt-8">
                  <h2 className="text-xl font-extrabold tracking-tight sm:text-2xl">{section.title}</h2>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-700 sm:text-[15px]">
                    {section.paragraphs?.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
                    {section.bullets ? <ul className="list-disc space-y-2 pl-5">{section.bullets.map((bullet) => <li key={bullet}>{bullet}</li>)}</ul> : null}
                  </div>
                </section>
              ))}
            </div>
          </article>
          <aside className="space-y-4 lg:sticky lg:top-5">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-2 font-extrabold"><LockKeyhole className="h-5 w-5 text-amber-600" aria-hidden="true" /> Kişisel veri talepleri</div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">Erişim, düzeltme ve silme talepleriniz için destek merkezimizi kullanabilirsiniz.</p>
              <Link href="/support" className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-bold text-white hover:bg-zinc-800">
                Destek Merkezi <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </section>
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-2 font-extrabold"><Mail className="h-5 w-5 text-amber-600" aria-hidden="true" /> İletişim</div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">Hesabınız ve veri işlemlerinizle ilgili sorularınızı iletişim sayfasından iletebilirsiniz.</p>
              <Link href="/iletisim" className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm font-bold underline underline-offset-4">İletişim sayfası <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
            </section>
          </aside>
        </div>
      </main>
      <footer className="border-t border-zinc-800 bg-[#0b0b0b] px-4 py-6 text-center text-sm text-zinc-300">
        <span>© {new Date().getFullYear()} Çalışkan B2B</span>
        <span className="mx-3 text-zinc-600">|</span>
        <Link href="/" className="underline underline-offset-4">Ana Sayfa</Link>
        <span className="mx-3 text-zinc-600">|</span>
        <Link href="/support" className="underline underline-offset-4">Destek</Link>
      </footer>
    </div>
  );
}
