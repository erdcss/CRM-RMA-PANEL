import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { B2BHeader } from "@/components/b2b-header";
import { B2BFooter } from "@/components/b2b-footer";
import {
  ArrowDownRight, ArrowRight, ArrowUpRight, BadgeCheck, BookOpen, Boxes,
  Building2, CheckCircle2, ChevronRight, ClipboardList,
  Headphones, Layers3, LockKeyhole, PackageSearch,
  ShieldCheck, ShoppingBag, Store, Wallet
} from "lucide-react";

const solidButton = "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl bg-[#ffcc00] px-6 py-3 text-sm font-extrabold text-[#101010] transition hover:bg-[#f2ba00] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffcc00]";
const outlineButton = "inline-flex min-h-12 items-center justify-center gap-2.5 rounded-xl border border-white/25 bg-white/[0.055] px-6 py-3 text-sm font-bold text-white transition hover:border-[#ffcc00]/70 hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#ffcc00]";
const lightLink = "inline-flex min-h-11 items-center justify-center gap-2.5 rounded-xl border border-[#dededb] bg-white px-5 py-3 text-sm font-extrabold text-[#151515] transition hover:border-[#ffcc00] hover:bg-[#fffbea] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#d5ab00]";
const SectionEyebrow = ({ children }: { children: React.ReactNode }) => (
  <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-[#a77c00]">
    <span aria-hidden="true" className="h-[2px] w-6 bg-[#e4b400]" />{children}
  </div>
);

function EyebrowDark({ children }: { children: React.ReactNode }) {
  return <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.23em] text-[#ffcc00]"><span className="h-1.5 w-1.5 rounded-full bg-[#ffcc00]" />{children}</div>;
}

function EditorialFrame({ children }: { children: React.ReactNode }) {
  return <div className="relative isolate overflow-hidden rounded-[28px] bg-[#111213] text-white shadow-[0_16px_60px_rgba(0,0,0,0.12)] sm:rounded-[36px]">
    <div aria-hidden="true" className="pointer-events-none absolute -right-28 -top-36 h-[390px] w-[390px] rounded-full bg-[#ffcc00]/[0.11] blur-[85px]" />
    <div aria-hidden="true" className="pointer-events-none absolute bottom-0 right-0 h-[310px] w-[360px] translate-x-1/4 translate-y-1/3 rounded-full border-[70px] border-[#ffcc00]/[0.055]" />
    {children}
  </div>;
}

const features = [
  { icon: PackageSearch, title: "Geniş ürün keşfi", desc: "Elektronik, elektrik, hırdavat ve farklı kategorilerde ihtiyaç duyduğunuz ürünlere ulaşın." },
  { icon: Boxes, title: "Toptan sipariş", desc: "Koli içi adetleri ve ürün detaylarını inceleyip toplu alım listenizi oluşturun." },
  { icon: Store, title: "Tedarikçi ağı", desc: "Platformda listelenen tedarikçi ve mağazaların ürünlerini tek noktadan keşfedin." },
  { icon: Wallet, title: "Dijital Defterim", desc: "Cari hesap, nakit, banka ve ticari notlarınızı hesabınız üzerinden takip edin." },
];

const steps = [
  { num: "01", title: "Ürünü keşfet", desc: "Kategorileri gezin, ürün bilgilerini ve fiyatları inceleyin." },
  { num: "02", title: "Siparişi oluştur", desc: "Koli bazlı adet belirleyerek ürünleri sipariş listenize ekleyin." },
  { num: "03", title: "Süreci takip et", desc: "Siparişlerinize ve ilgili hesap kayıtlarına tek yerden erişin." },
  { num: "04", title: "İhtiyacını planla", desc: "Eksik Listem ve Defterim ile iş akışınızı düzenleyin." },
];

function AboutPage() {
  return <>
    <section className="relative px-4 pt-6 sm:px-6 sm:pt-10">
      <div className="mx-auto max-w-6xl">
        <EditorialFrame>
          <div className="grid items-center gap-11 px-6 py-11 sm:px-12 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:gap-14 lg:px-16 lg:py-20">
            <div className="relative z-10">
              <EyebrowDark>Hakkımızda · Çalışkan B2B</EyebrowDark>
              <h1 className="mt-6 max-w-2xl text-[38px] font-black leading-[1.09] tracking-[-0.04em] sm:text-[56px] lg:text-[62px]">
                Ticaretin gücü, <span className="text-[#ffcc00]">dijitalin hızıyla</span> buluşuyor.
              </h1>
              <p className="mt-6 max-w-xl text-[15px] leading-8 text-[#c5c5c5] sm:text-[17px]">
                Çalışkan B2B, işletmelerin toptan ürün tedarikini daha düzenli, ulaşılabilir ve yönetilebilir hale getirmek için geliştirilen dijital bir alışveriş platformudur.
              </p>
              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/" className={solidButton}>Ürünleri Keşfet <ArrowUpRight className="h-4 w-4" aria-hidden="true" /></Link>
                <Link href="/iletisim" className={outlineButton}>Bizimle İletişime Geç <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              </div>
            </div>
            <div className="relative z-10 mx-auto w-full max-w-md" aria-label="Çalışkan B2B platform özellikleri">
              <div className="relative overflow-hidden rounded-[26px] border border-[#ffcc00]/25 bg-[#1d1d1e] p-5 shadow-[0_25px_65px_rgba(0,0,0,.4)] sm:p-7">
                <div className="flex items-center justify-between border-b border-white/10 pb-5">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-[0.23em] text-white/40">ÇALIŞKAN B2B</p>
                    <p className="mt-1.5 text-xl font-black">Tedarik ekosistemi</p>
                  </div>
                  <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#ffcc00] text-black"><Layers3 className="h-6 w-6" aria-hidden="true" /></span>
                </div>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {[
                    { icon: ShoppingBag, label: "Ürünler", subtitle: "Ürün keşfi" },
                    { icon: Boxes, label: "Siparişler", subtitle: "Koli bazlı alım" },
                    { icon: BookOpen, label: "Defterim", subtitle: "Cari ve kasa" },
                    { icon: ClipboardList, label: "Eksik Listem", subtitle: "İhtiyaç takibi" }
                  ].map(item => { const Icon = item.icon; return <div key={item.label} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-xl bg-[#ffcc00]/[0.12] text-[#ffcc00]"><Icon className="h-5 w-5" aria-hidden="true" /></div>
                    <p className="text-sm font-extrabold">{item.label}</p>
                    <p className="mt-1 text-[11px] text-white/50">{item.subtitle}</p>
                  </div>; })}
                </div>
                <div className="mt-4 flex items-center gap-3 rounded-xl border border-[#ffcc00]/20 bg-[#ffcc00]/[0.085] px-4 py-3">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-[#ffcc00]" aria-hidden="true" />
                  <p className="text-xs leading-5 text-white/75">Ürün keşfinden hesap takibine tek platform</p>
                </div>
              </div>
            </div>
          </div>
        </EditorialFrame>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="mission-heading">
      <div className="grid gap-8 lg:grid-cols-[0.75fr_1.25fr] lg:gap-16">
        <div>
          <SectionEyebrow>Yaklaşımımız</SectionEyebrow>
          <h2 id="mission-heading" className="mt-4 text-3xl font-black leading-[1.18] tracking-tight text-[#131313] sm:text-4xl">İşletmelerin günlük tedarik akışını kolaylaştırıyoruz.</h2>
        </div>
        <div className="space-y-5 text-[15px] leading-8 text-[#5f605f] sm:text-base">
          <p>Toptan alışverişte ürün bulmak, uygun koli miktarını belirlemek, siparişleri izlemek ve ticari hesapları düzenlemek çoğu zaman farklı araçlar gerektirir.</p>
          <p>Çalışkan B2B, bu adımları dijital ortamda bir araya getirerek işletmelerin ürün ve tedarik süreçlerini daha görünür bir şekilde yönetmesine yardımcı olmayı amaçlar.</p>
          <div className="flex flex-wrap gap-x-6 gap-y-3 border-t border-[#dededb] pt-6 text-sm font-bold text-[#181818]">
            <span className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-[#c99b00]" aria-hidden="true" /> İşletme odaklı</span>
            <span className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-[#c99b00]" aria-hidden="true" /> Kullanımı anlaşılır</span>
            <span className="flex items-center gap-2"><BadgeCheck className="h-5 w-5 text-[#c99b00]" aria-hidden="true" /> Tek merkezden takip</span>
          </div>
        </div>
      </div>
    </section>

    <section className="bg-[#f0f0ec] py-16 sm:py-24" aria-labelledby="features-heading">
      <div className="mx-auto max-w-6xl px-4 sm:px-6">
        <SectionEyebrow>Çalışkan B2B ile</SectionEyebrow>
        <div className="mt-4 flex flex-wrap items-end justify-between gap-4">
          <h2 id="features-heading" className="max-w-2xl text-3xl font-black leading-tight tracking-tight sm:text-4xl">İşiniz için ihtiyacınız olan araçlar</h2>
          <span className="text-sm text-[#696969]">Keşif · Sipariş · Takip</span>
        </div>
        <div className="mt-9 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((feature,index) => { const Icon=feature.icon; return <article key={feature.title} className="group rounded-[22px] border border-[#e2e2dd] bg-white p-6 transition duration-200 hover:-translate-y-1 hover:border-[#e8c248] hover:shadow-xl hover:shadow-black/5">
            <div className="flex items-center justify-between">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#fff5c5] text-[#111]"><Icon className="h-6 w-6" aria-hidden="true" /></span>
              <span className="text-xs font-bold text-[#bbb]">0{index+1}</span>
            </div>
            <h3 className="mt-6 text-lg font-extrabold">{feature.title}</h3>
            <p className="mt-3 text-sm leading-7 text-[#666]">{feature.desc}</p>
          </article>; })}
        </div>
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="process-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <SectionEyebrow>Nasıl çalışır?</SectionEyebrow>
          <h2 id="process-heading" className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Dört adımda daha düzenli tedarik</h2>
        </div>
        <Link href="/" className={lightLink}>Kataloğa Göz At <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
      </div>
      <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {steps.map((item,index) => <div key={item.num} className="relative border-t-2 border-[#ffcc00] pt-5">
          <div className="flex items-start justify-between"><span className="text-4xl font-black tracking-tight text-[#c9c9c3]">{item.num}</span>{index<3?<ArrowDownRight className="h-6 w-6 text-[#d2a900]" aria-hidden="true"/>:null}</div>
          <h3 className="mt-5 text-lg font-extrabold">{item.title}</h3>
          <p className="mt-2 max-w-xs text-sm leading-7 text-[#6b6b69]">{item.desc}</p>
        </div>)}
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="flex flex-col items-start justify-between gap-7 rounded-[26px] bg-[#ffcc00] px-7 py-9 sm:flex-row sm:items-center sm:px-10 sm:py-11">
        <div>
          <h2 className="text-2xl font-black tracking-tight text-[#101010] sm:text-3xl">Toptan alışverişi tek noktadan yönetin.</h2>
          <p className="mt-2 max-w-lg text-sm leading-6 text-black/70">Ürün kataloğunu keşfedin veya tedarikçi hesabınızla ilgili sorular için bize ulaşın.</p>
        </div>
        <Link href="/iletisim" className="inline-flex min-h-12 shrink-0 items-center justify-center gap-2 rounded-xl bg-black px-6 py-3 text-sm font-extrabold text-white transition hover:bg-[#2b2b2b]">İletişime Geç <ArrowUpRight className="h-4 w-4" aria-hidden="true"/></Link>
      </div>
    </section>
  </>;
}

const channels = [
  { icon: Headphones, label: "Destek merkezi", title: "Yardıma mı ihtiyacınız var?", text: "Ürünler, hesap erişimi, iade ve uygulama kullanımıyla ilgili yardım konularını inceleyin.", action: "Destek Merkezini Aç", href: "/destek", external: false },
  { icon: ClipboardList, label: "Sipariş & hesap", title: "Talebinizi bize iletin", text: "İşletme hesabınızla giriş yaparak sipariş veya üyelik konulu bir destek talebi oluşturun.", action: "Destek Talebi Oluştur", href: "/hesabim?tab=support", external: false },
  { icon: Building2, label: "Tedarikçi işlemleri", title: "Tedarikçi olmak ister misiniz?", text: "Platformdaki tedarikçi süreçleri için başvuru ve panel bağlantısını ziyaret edin.", action: "Tedarikçi Paneline Git", href: "https://pazaryeri.ecalisgan.com", external: true },
] as const;

const faqs = [
  { q:"Siparişim hakkında nasıl bilgi alabilirim?", a:"Hesabınızdan Siparişlerim bölümünü kontrol edin. Ek yardıma ihtiyacınız varsa Destek Hattı bölümünde sipariş numaranızla talep oluşturun." },
  { q:"İşletme hesabımla giriş yapamıyorum, ne yapmalıyım?", a:"Üye Girişi sayfasındaki şifre yenileme adımlarını izleyin. Sorun sürüyorsa Destek Merkezi'ndeki giriş konularını inceleyin." },
  { q:"Ürün veya tedarikçi bilgilerini nerede görebilirim?", a:"Ürün detay sayfalarında ilgili ürün ve mağaza bilgilerini inceleyebilirsiniz. Tedarikçi başvuruları için Tedarikçi Panelini ziyaret edin." },
];

function ContactPage() {
  return <>
    <section className="mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-10">
      <EditorialFrame>
        <div className="relative z-10 grid items-center gap-8 px-6 py-11 sm:px-12 sm:py-16 lg:grid-cols-[1.15fr_0.85fr] lg:gap-16 lg:px-16">
          <div>
            <EyebrowDark>Çalışkan B2B · İletişim</EyebrowDark>
            <h1 className="mt-6 text-[40px] font-black leading-[1.08] tracking-[-0.04em] sm:text-[56px]">Doğru destek, <span className="text-[#ffcc00]">doğru adreste.</span></h1>
            <p className="mt-6 max-w-xl text-[15px] leading-8 text-[#c9c9c9] sm:text-[17px]">Hesabınız, siparişleriniz veya tedarikçi işlemleriniz hakkında size yardımcı olabilecek doğru kanala kolayca ulaşın.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/destek" className={solidButton}>Destek Merkezine Git <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
              <Link href="/hakkimizda" className={outlineButton}>Bizi Tanıyın <ArrowUpRight className="h-4 w-4" aria-hidden="true"/></Link>
            </div>
          </div>
          <div className="relative grid gap-3">
            {[
              { icon: ShoppingBag, label: "Ürün & sipariş desteği", desc: "Sipariş sorularınız için" },
              { icon: LockKeyhole, label: "Hesap & giriş işlemleri", desc: "Üyelik ve erişim desteği" },
              { icon: Store, label: "Tedarikçi iletişimi", desc: "Başvuru ve mağaza işlemleri" }
            ].map((item,index)=>{const Icon=item.icon;return <div key={item.label} className="flex items-center gap-4 rounded-2xl border border-white/[0.12] bg-white/[0.065] px-4 py-4 backdrop-blur-sm sm:px-5">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ffcc00]/[0.14] text-[#ffcc00]"><Icon className="h-5 w-5" aria-hidden="true"/></div>
              <div className="flex-1"><p className="text-sm font-extrabold">{item.label}</p><p className="mt-1 text-xs text-white/50">{item.desc}</p></div>
              <span className="text-xs font-extrabold text-[#ffcc00]/80">0{index+1}</span>
            </div>;})}
          </div>
        </div>
      </EditorialFrame>
    </section>
    <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24" aria-labelledby="channels-heading">
      <SectionEyebrow>İletişim kanallarımız</SectionEyebrow>
      <h2 id="channels-heading" className="mt-4 max-w-xl text-3xl font-black tracking-tight sm:text-4xl">Size nasıl yardımcı olabiliriz?</h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-[#626262] sm:text-base">Konunuza uygun bir kanalı seçerek işleminize devam edebilirsiniz. Destek talepleri için hesabınızla giriş yapmanız gerekir.</p>
      <div className="mt-9 grid gap-5 lg:grid-cols-3">
        {channels.map((item)=>{const Icon=item.icon;return <article key={item.label} className="flex flex-col rounded-[23px] border border-[#e6e6e1] bg-white p-6 shadow-[0_9px_35px_rgba(0,0,0,0.035)] transition hover:-translate-y-1 hover:border-[#f0ca42] hover:shadow-lg sm:p-7">
          <div className="flex items-center justify-between"><span className="flex h-14 w-14 items-center justify-center rounded-[18px] bg-[#fff3b4]"><Icon className="h-6 w-6" aria-hidden="true" /></span><ArrowUpRight className="h-5 w-5 text-[#a3a3a3]" aria-hidden="true"/></div>
          <p className="mt-7 text-[11px] font-extrabold uppercase tracking-[0.2em] text-[#a17a00]">{item.label}</p>
          <h3 className="mt-2 text-xl font-black tracking-tight">{item.title}</h3>
          <p className="mt-3 flex-1 text-sm leading-7 text-[#696969]">{item.text}</p>
          {item.external ?
            <a href={item.href} target="_blank" rel="noopener noreferrer" className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#111] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#333]">{item.action}<ArrowUpRight className="h-4 w-4" aria-hidden="true" /></a> :
            <Link href={item.href} className="mt-7 inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[#111] px-4 py-3 text-sm font-bold text-white transition hover:bg-[#333]">{item.action}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
          }
        </article>;})}
      </div>
    </section>

    <section className="bg-[#f0f0ec] py-16 sm:py-20" aria-labelledby="support-flow-heading">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:items-center lg:gap-20">
        <div>
          <SectionEyebrow>Talep yönetimi</SectionEyebrow>
          <h2 id="support-flow-heading" className="mt-4 text-3xl font-black leading-tight sm:text-4xl">Sorununuzu bize iletmenin en kolay yolu.</h2>
          <p className="mt-5 text-sm leading-7 text-[#666]">Destek kaydı oluştururken konuyu ve varsa sipariş numarasını belirtin. Başvurunuz işletme hesabınızla ilişkilendirilir.</p>
          <Link href="/hesabim?tab=support" className="mt-6 inline-flex min-h-12 items-center gap-2 rounded-xl bg-[#ffcc00] px-5 py-3 text-sm font-extrabold text-[#111] hover:bg-[#edb800]">Talep Oluştur <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
        </div>
        <div className="space-y-3">
          {[
            { n:"01", title:"İşletme hesabınızla giriş yapın", text:"Hesabım bölümünden destek alanına geçin." },
            { n:"02", title:"Konuyu ve detayları paylaşın", text:"Sipariş numarası veya ürün bilgisini ekleyin." },
            { n:"03", title:"Talebinizi hesabınızdan takip edin", text:"Destek bölümünde kayıtlı taleplerinizi görüntüleyin." }
          ].map(item=><div key={item.n} className="flex gap-5 rounded-2xl border border-[#e4e4df] bg-white p-5">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#151515] text-sm font-black text-[#ffcc00]">{item.n}</span>
            <div><h3 className="font-extrabold">{item.title}</h3><p className="mt-1 text-sm leading-6 text-[#6d6d6d]">{item.text}</p></div>
          </div>)}
        </div>
      </div>
    </section>

    <section className="mx-auto grid max-w-6xl gap-10 px-4 py-16 sm:px-6 sm:py-24 lg:grid-cols-[0.7fr_1.3fr] lg:gap-16" aria-labelledby="contact-faq">
      <div>
        <SectionEyebrow>Yardım merkezi</SectionEyebrow>
        <h2 id="contact-faq" className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">Sık sorulan sorular</h2>
        <p className="mt-4 text-sm leading-7 text-[#696969]">En çok ihtiyaç duyulan işlemlerle ilgili kısa yanıtlar.</p>
        <Link href="/destek#faq-heading" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-extrabold text-[#141414] underline decoration-[#ffcc00] decoration-2 underline-offset-4">Tüm Yardım Konuları <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
      <div className="divide-y divide-[#e3e3df] rounded-[23px] border border-[#e4e4df] bg-white px-5 sm:px-7">
        {faqs.map(item=><details key={item.q} className="group py-5">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-left text-sm font-extrabold leading-6 text-[#151515] marker:hidden sm:text-base">
            {item.q}<ChevronRight className="h-5 w-5 shrink-0 text-[#b18a00] transition-transform group-open:rotate-90" aria-hidden="true"/>
          </summary>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-[#6b6b6b]">{item.a}</p>
        </details>)}
      </div>
    </section>

    <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6 sm:pb-16">
      <div className="flex flex-col gap-5 rounded-[24px] border border-[#ffcc00]/35 bg-[#151515] px-6 py-8 text-white sm:flex-row sm:items-center sm:justify-between sm:px-10">
        <div className="flex items-start gap-4">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[#ffcc00] text-[#111]"><ShieldCheck className="h-6 w-6" aria-hidden="true"/></span>
          <div><h2 className="text-lg font-black sm:text-xl">Gizliliğiniz bizim için önemli.</h2><p className="mt-2 max-w-lg text-sm leading-6 text-white/60">Kişisel verilerinizle ilgili açıklamalara ve başvuru yollarına gizlilik politikamızdan ulaşabilirsiniz.</p></div>
        </div>
        <Link href="/privacy" className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-white/25 px-5 py-3 text-sm font-bold transition hover:border-[#ffcc00] hover:text-[#ffcc00]">Gizlilik Politikası <ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>
      </div>
    </section>
  </>;
}

const otherPages = {
  "/kampanyalar": { title:"Kampanyalar", text:"Çalışkan B2B'deki güncel ürün ve fırsatları ana sayfamız üzerinden inceleyebilirsiniz.",cta:"Ürünleri Keşfet",href:"/" },
  "/akademi": { title:"Çalışkan Akademi", text:"Tedarikçiler ve işletmeler için eğitim ve bilgilendirme içerikleri hazırlanmaktadır. Bu alandaki yeni duyuruları takip edebilirsiniz.",cta:"Tedarikçi Ol",href:"https://pazaryeri.ecalisgan.com" },
} as const;

function OtherPage({ path }: { path: keyof typeof otherPages }) {
  const page=otherPages[path];
  return <section className="mx-auto max-w-6xl px-4 py-14 sm:px-6 sm:py-24">
    <div className="relative overflow-hidden rounded-[28px] border border-[#e9e8e1] bg-white p-8 sm:p-14">
      <SectionEyebrow>Çalışkan B2B</SectionEyebrow>
      <h1 className="mt-5 text-4xl font-black tracking-tight sm:text-5xl">{page.title}</h1>
      <p className="mt-6 max-w-2xl text-base leading-8 text-[#616161]">{page.text}</p>
      {page.href.startsWith("https://")?
        <a href={page.href} rel="noopener noreferrer" className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-xl bg-[#111] px-5 py-3 text-sm font-bold text-white hover:bg-[#333]">{page.cta}<ArrowRight className="h-4 w-4" aria-hidden="true"/></a>:
        <Link href={page.href} className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-xl bg-[#111] px-5 py-3 text-sm font-bold text-white hover:bg-[#333]">{page.cta}<ArrowRight className="h-4 w-4" aria-hidden="true"/></Link>}
    </div>
  </section>;
}

export default function B2BInfoPage() {
  const [location] = useLocation();
  const path = location.split("?")[0];
  const pageTitle = path === "/iletisim" ? "İletişim" : path === "/hakkimizda" ? "Biz Kimiz?" : path === "/akademi" ? "Çalışkan Akademi" : "Kampanyalar";
  useEffect(() => { document.title = pageTitle + " | Çalışkan B2B"; }, [pageTitle]);
  return <div className="min-h-screen bg-[#f8f8f6] text-[#141414]">
    <B2BHeader />
    <main id="main-content">
      {path === "/iletisim" ? <ContactPage /> : path === "/hakkimizda" ? <AboutPage /> : <OtherPage path={path === "/akademi" ? "/akademi" : "/kampanyalar"} />}
    </main>
    <B2BFooter />
  </div>;
}
