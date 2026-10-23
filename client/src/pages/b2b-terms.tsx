import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, FileText, Headphones, ShieldCheck } from "lucide-react";

const updatedAt = "24 Ekim 2026";

const sections: { title: string; paragraphs?: string[]; bullets?: string[] }[] = [
  {
    title: "1. Hizmetin kapsamı",
    paragraphs: [
      "Bu kullanım koşulları, Çalışkan B2B adıyla sunulan internet sitesi ve iOS/Android uygulamalarındaki üyelik, toptan ürün görüntüleme, sipariş, hesap, destek ve varsa pazaryeri hizmetlerinin kullanımına ilişkin genel kuralları açıklar.",
      "Hizmetin işletmecisine ait güncel resmî unvan ve iletişim bilgileri İletişim ve Destek sayfalarından teyit edilebilir. Bu metin, sipariş sırasında kullanıcıya açıkça bildirilen satıcıya özgü koşulların veya emredici mevzuat hükümlerinin yerine geçmez."
    ]
  },
  {
    title: "2. Üyelik ve hesap güvenliği",
    bullets: [
      "B2B firma hesabı açarken doğru, güncel ve firmaya ait bilgileri vermeniz gerekir. Başvurular incelenebilir, kabul edilebilir veya gerekçesiyle reddedilebilir.",
      "Onaylanan firmalara kayıtlı e-posta adresinden ilk giriş bilgileri gönderilebilir; ilk girişte kalıcı şifre belirlenmesi zorunlu tutulabilir.",
      "Şifrelerinizi koruyun, erişim izni verdiğiniz personelin işlemlerinden ve hesabınızla ilişkili yetkilerden sorumlu olduğunuzu dikkate alın.",
      "Yetkisiz erişim şüphesi halinde şifrenizi değiştirin ve Destek Merkezi üzerinden bildirim yapın."
    ]
  },
  {
    title: "3. Ürün bilgileri ve siparişler",
    paragraphs: [
      "Ürün görselleri, özellikleri, koli miktarları, stok durumları, fiyatlar, vergiler ve teslimat koşulları ilgili ürün ve sipariş ekranlarında gösterilir. Hata veya güncelleme olması halinde kullanıcıya siparişin işlenmesinden önce gerekli bilgi verilir.",
      "Sipariş oluşturmak, her durumda siparişin kesin kabul edildiği anlamına gelmez. Siparişin onay, ödeme, stok ve teslimat durumu ilgili sipariş detayından takip edilir."
    ]
  },
  {
    title: "4. Ödemeler, faturalar ve kayıtlar",
    paragraphs: [
      "Desteklenen ödeme yöntemleri ilgili ödeme ekranında gösterilir. Kart işlemleri yetkili ödeme hizmeti sağlayıcısı tarafından işlenebilir; banka havalesinde ödeme teyidi ayrıca gerekebilir.",
      "Fatura ve diğer ticari belgeler yürürlükteki mevzuata ve işlem bilgilerine uygun olarak düzenlenir. İşlem tutarları, vergi bilgileri ve varsa ek masraflar siparişin ilgili adımında belirtilir.",
      "Uygulamadaki Defter ve finans takibi araçları kullanıcının kendi kayıtlarına yardımcı olmak içindir; resmî muhasebe defteri, mali müşavirlik hizmeti veya bankacılık hizmeti olarak değerlendirilmemelidir."
    ]
  },
  {
    title: "5. Teslimat, iptal ve iadeler",
    paragraphs: [
      "Teslimat yöntemi, tahmini süre ve varsa nakliye bedeli siparişe ve teslimat adresine göre değişebilir. Esas alınacak bilgiler siparişin ilgili ekranlarında veya taraflar arasındaki ticari belgelerde açıklanır.",
      "İptal, ayıplı ürün, eksik teslimat ve iade talepleri Destek Merkezi üzerinden iletilebilir. İlgili talepler, somut siparişin koşulları ve uygulanabilir yasal haklar çerçevesinde değerlendirilir. Bu metin kanundan doğan hakları ortadan kaldırmaz."
    ]
  },
  {
    title: "6. Pazaryeri ve üçüncü taraf satıcılar",
    paragraphs: [
      "Platformda üçüncü taraf satıcılar bulunuyorsa, ürünün satıcısı ve varsa satıcıya özgü ticari koşullar ilgili ürün veya sipariş ekranında belirtilir.",
      "Üçüncü taraf bağlantıları ve satıcı beyanları kendi koşullarına tabi olabilir. Çalışkan B2B'nin üstlendiği yükümlülükler, işlem ekranları, taraflar arasındaki sözleşmeler ve yürürlükteki mevzuatla belirlenir."
    ]
  },
  {
    title: "7. Kabul edilebilir kullanım",
    bullets: [
      "Başka kullanıcıların hesaplarına yetkisiz şekilde erişmeyin; hizmeti yanıltıcı başvuru, sahte işlem veya hukuka aykırı faaliyet için kullanmayın.",
      "Platformun güvenliğini, kullanılabilirliğini veya diğer kullanıcıların erişimini bozan otomatik istekler, zararlı yazılımlar veya saldırı girişimleri gerçekleştirmeyin.",
      "Başka kişilerin kişisel verilerini ve ticari sırlarını hukuka aykırı şekilde paylaşmayın."
    ]
  },
  {
    title: "8. Kişisel veriler ve fikrî haklar",
    paragraphs: [
      "Kişisel verilerin işlenmesiyle ilgili açıklamalar Gizlilik Politikası ve KVKK sayfasında yer alır. Gerekli durumlarda ayrıca aydınlatma veya açık rıza süreçleri uygulanır.",
      "Platformun marka, yazılım, tasarım ve içeriklerine ilişkin haklar ilgili hak sahiplerine aittir. Kullanıcılara yalnızca hizmetin olağan kullanımı için gerekli ölçüde erişim sağlanır."
    ]
  },
  {
    title: "9. Hizmet değişiklikleri ve erişim",
    paragraphs: [
      "Bakım, güvenlik veya teknik gereklilikler nedeniyle özelliklerde değişiklik veya geçici kesinti yaşanabilir. Önemli ve kullanıcıları etkileyen değişiklikler uygun kanallardan duyurulabilir.",
      "Hesabın veya hizmetin kötüye kullanımında, mevzuata uygun ve ölçülü tedbirler alınabilir. Tarafların sözleşmesel ve yasal hakları saklıdır."
    ]
  },
  {
    title: "10. İletişim ve uygulanacak kurallar",
    paragraphs: [
      "Üyelik, sipariş, fatura, iade ve kişisel veri talepleriniz için Çalışkan B2B Destek Merkezi veya İletişim sayfasından başvurabilirsiniz.",
      "Tarafların hakları ve uyuşmazlıklar, işlemin niteliğine göre uygulanabilir Türkiye Cumhuriyeti mevzuatı, ilgili sözleşmeler ve emredici yetki kuralları çerçevesinde değerlendirilir."
    ]
  },
];

export default function B2BTermsPage() {
  useEffect(() => {
    const oldTitle = document.title;
    document.title = "Kullanım Koşulları | Çalışkan B2B";
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
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-14">
        <section className="rounded-3xl bg-[#111315] px-6 py-9 text-white sm:px-10 sm:py-12">
          <div className="flex items-center gap-2 text-sm font-bold uppercase tracking-[.15em] text-[#ffcc00]">
            <ShieldCheck className="h-5 w-5" aria-hidden="true" /> ÇALIŞKAN B2B
          </div>
          <h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">Kullanım Koşulları</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-zinc-300 sm:text-base">
            Üyelik, sipariş, ödeme, teslimat ve platformun güvenli kullanımı için temel koşullar.
          </p>
          <div className="mt-6 inline-flex items-center gap-2 rounded-full border border-white/20 px-4 py-2 text-xs text-zinc-200">
            <FileText className="mr-2 h-4 w-4" /> Son güncelleme: {updatedAt}
          </div>
        </section>
        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_240px] lg:items-start">
          <article className="min-w-0 rounded-3xl border border-zinc-200 bg-white px-5 py-7 shadow-sm sm:px-9">
            <p className="mb-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
              İşletmeciye ait resmî şirket bilgileri ve somut satış/tedarik koşulları yayımlanmadan önce doğrulanmalıdır.
              Bu metin genel çerçevedir; ayrıca uygulanması gereken ticari sözleşme ve mevzuat hükümleri saklıdır.
            </p>
            <div className="space-y-9">
              {sections.map((section, index) => (
                <section key={section.title} id={`section-${index + 1}`}>
                  <h2 className="text-xl font-extrabold sm:text-2xl">{section.title}</h2>
                  <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-700 sm:text-[15px]">
                    {section.paragraphs?.map(p => <p key={p}>{p}</p>)}
                    {section.bullets && <ul className="list-disc space-y-2 pl-5">
                      {section.bullets.map(p => <li key={p}>{p}</li>)}
                    </ul>}
                  </div>
                </section>
              ))}
            </div>
          </article>
          <aside className="space-y-4 lg:sticky lg:top-5">
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="flex items-center gap-2 font-bold"><Headphones className="h-5 w-5 text-amber-600"/> Yardım ve destek</div>
              <p className="mt-3 text-sm leading-6 text-zinc-600">Sorularınız veya firma başvurunuz için destek merkezimize ulaşın.</p>
              <Link href="/destek" className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-zinc-950 px-4 py-3 text-sm font-semibold text-white">
                Destek Merkezi <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
            <section className="rounded-2xl border border-zinc-200 bg-white p-5">
              <div className="font-bold">Gizlilik ve KVKK</div>
              <Link href="/gizlilik-politikasi" className="mt-3 inline-flex gap-2 text-sm font-semibold underline underline-offset-4">
                Gizlilik politikasını görüntüle <ArrowRight className="h-4 w-4" />
              </Link>
            </section>
          </aside>
        </div>
      </main>
      <footer className="border-t border-zinc-800 bg-[#0b0b0b] px-4 py-6 text-center text-sm text-zinc-300">
        <span>© {new Date().getFullYear()} Çalışkan B2B</span>
        <span className="mx-3 text-zinc-600">|</span>
        <Link href="/" className="underline underline-offset-4">Ana Sayfa</Link>
        <span className="mx-3 text-zinc-600">|</span>
        <Link href="/iletisim" className="underline underline-offset-4">İletişim</Link>
      </footer>
    </div>
  );
}
