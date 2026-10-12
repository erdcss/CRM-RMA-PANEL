import { useEffect } from "react";
import { Link } from "wouter";
import { ArrowLeft, ArrowRight, CircleHelp, Headphones, LifeBuoy, LockKeyhole, PackageSearch, ShieldCheck, Smartphone, Truck } from "lucide-react";

const questions = [
  {
    title: "Uygulamaya nasıl giriş yapabilirim?",
    answer: "Çalışkan B2B hesabınıza kayıtlı e-posta adresiniz ve şifrenizle giriş yapabilirsiniz. Henüz işletme hesabınız yoksa İşletmemi Kaydet bölümünden başvuru oluşturabilirsiniz.",
  },
  {
    title: "Şifremi unuttum, ne yapmalıyım?",
    answer: "Giriş ekranındaki Şifremi Unuttum bağlantısını kullanarak şifre sıfırlama talebi oluşturabilirsiniz. İşlem sırasında kullandığınız e-posta adresinin doğru olduğundan emin olun.",
  },
  {
    title: "Siparişlerimi nasıl takip edebilirim?",
    answer: "Oturum açtıktan sonra Sipariş Listesi veya Hesabım alanındaki sipariş bilgilerini görüntüleyebilirsiniz. Bir siparişle ilgili yardım almak için destek talebi oluşturun.",
  },
  {
    title: "Ürün, iade veya hesap sorunu için nasıl destek alabilirim?",
    answer: "Hesabım → Destek Hattı bölümünden konu ve açıklama yazarak talep gönderebilirsiniz. İncelenecek siparişin numarasını ve ilgili ürünün bilgilerini eklemeniz çözümü kolaylaştırır.",
  },
];

export default function B2BSupport() {
  useEffect(() => {
    const previous = document.title;
    document.title = "Destek Merkezi | Çalışkan B2B";
    return () => { document.title = previous; };
  }, []);

  return (
    <div className="min-h-screen bg-[#f8f9fb] text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="flex items-center gap-3 text-lg font-black tracking-tight" aria-label="Çalışkan B2B ana sayfasına dön">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffcb05] text-xl font-black text-slate-950">Ç</span>
            <span>Çalışkan <strong>B2B</strong></span>
          </Link>
          <Link href="/" className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold hover:bg-slate-100 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Ana Sayfa
          </Link>
        </div>
      </header>

      <main id="main-content" className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 sm:py-14">
        <section className="rounded-3xl bg-[#111315] px-6 py-10 text-white sm:px-10 sm:py-14" aria-labelledby="support-heading">
          <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-[#ffcb05]">
            <Headphones className="h-5 w-5" aria-hidden="true" /> ÇALIŞKAN B2B DESTEK MERKEZİ
          </div>
          <h1 id="support-heading" className="max-w-2xl text-3xl font-black leading-tight sm:text-5xl">
            Size nasıl yardımcı olabiliriz?
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-slate-300">
            Çalışkan B2B iOS, Android ve web deneyiminde hesap, giriş, ürünler, siparişler ve iadeler konusunda yardım alın.
            Destek sayfamıza giriş yapmadan erişebilirsiniz.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/hesabim?tab=support"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#ffcb05] px-5 py-3 font-bold text-slate-950 transition hover:bg-yellow-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500"
            >
              Destek Talebi Oluştur <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/uye-girisi"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-500 px-5 py-3 font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500"
            >
              <LockKeyhole className="h-4 w-4" aria-hidden="true" /> Giriş Yap
            </Link>
          </div>
          <p className="mt-4 text-sm text-slate-400">Talep gönderebilmek ve taleplerinizi takip edebilmek için işletme hesabınızla oturum açmanız gerekir.</p>
        </section>

        <section aria-labelledby="topics-heading">
          <h2 id="topics-heading" className="text-2xl font-black">Destek Konuları</h2>
          <p className="mt-2 text-slate-600">Hızlı yardım için ihtiyacınız olan konuyu seçin.</p>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: Smartphone, title: "Uygulama ve Giriş", description: "Hesap açma, giriş ve şifre işlemleri" },
              { icon: PackageSearch, title: "Ürün ve Stok", description: "Ürün bilgileri, barkodlar ve katalog" },
              { icon: Truck, title: "Sipariş ve Teslimat", description: "Sipariş durumu ve teslimat soruları" },
              { icon: ShieldCheck, title: "İade ve Hesap", description: "İade talepleri ve firma bilgileri" },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.title} href="/hesabim?tab=support" className="group rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-yellow-400 hover:shadow-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-yellow-500">
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-yellow-100 text-slate-900">
                    <Icon className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <h3 className="mt-4 font-bold">{item.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-amber-700">Talep oluştur <ArrowRight className="h-4 w-4" aria-hidden="true" /></span>
                </Link>
              );
            })}
          </div>
        </section>

        <section aria-labelledby="faq-heading">
          <div className="flex items-center gap-3">
            <CircleHelp className="h-6 w-6 text-amber-600" aria-hidden="true" />
            <h2 id="faq-heading" className="text-2xl font-black">Sık Sorulan Sorular</h2>
          </div>
          <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-white">
            {questions.map((item) => (
              <details key={item.title} className="group border-b border-slate-200 last:border-0">
                <summary className="cursor-pointer px-5 py-5 font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-yellow-500 sm:px-6">
                  {item.title}
                </summary>
                <p className="px-5 pb-5 text-sm leading-7 text-slate-600 sm:px-6">{item.answer}</p>
              </details>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-start justify-between gap-5 rounded-2xl border border-yellow-200 bg-yellow-50 p-6 sm:flex-row sm:items-center" aria-labelledby="more-help">
          <div>
            <div className="mb-2 flex items-center gap-2"><LifeBuoy className="h-5 w-5" aria-hidden="true" /><h2 id="more-help" className="text-lg font-bold">Sorununuz devam ediyor mu?</h2></div>
            <p className="max-w-xl text-sm leading-6 text-slate-700">Hesabınızdan destek talebi oluşturun. Talebinizi ilgili ekibe iletmek için yaşadığınız sorunu ve mümkünse sipariş numarasını paylaşın.</p>
          </div>
          <Link href="/hesabim?tab=support" className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white hover:bg-slate-800">
            Destek Hattına Git <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </section>
      </main>

      <footer className="border-t border-slate-200 bg-white px-4 py-7 text-center text-sm text-slate-600">
        © {new Date().getFullYear()} Çalışkan B2B · <Link href="/" className="font-semibold underline underline-offset-2">Ana Sayfa</Link>
      </footer>
    </div>
  );
}
