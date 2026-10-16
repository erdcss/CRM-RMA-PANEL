import { Link, useRoute } from "wouter";
import { B2BHeader } from "@/components/b2b-header";
import { B2BFooter } from "@/components/b2b-footer";
import { ArrowRight } from "lucide-react";

const content = {
  "/hakkimizda": { title:"Biz Kimiz?", text:"Çalışkan B2B, işletmelerin toptan ürün tedarik süreçlerini dijital ortamda buluşturan bir alışveriş platformudur.",cta:"Ürünleri İncele",href:"/" },
  "/iletisim": { title:"İletişim", text:"Siparişleriniz, ürünler ve işletme hesabınız hakkında bilgi almak için Çalışkan B2B destek merkezimizden talep oluşturabilirsiniz.",cta:"Destek Merkezine Git",href:"/destek" },
  "/kampanyalar": { title:"Kampanyalar", text:"Çalışkan B2B'deki güncel ürün ve fırsatları ana sayfamız üzerinden inceleyebilirsiniz.",cta:"Ürünleri Keşfet",href:"/" },
  "/akademi": { title:"Çalışkan Akademi", text:"Tedarikçiler ve işletmeler için eğitim ve bilgilendirme içerikleri hazırlanmaktadır. Bu alandaki yeni duyuruları takip edebilirsiniz.",cta:"Tedarikçi Ol",href:"/satici" },
} as const;

export default function B2BInfoPage() {
  const [, route] = useRoute("/:slug");
  const page = content[("/"+String(route?.slug || "")) as keyof typeof content] || content["/hakkimizda"];
  return <div className="min-h-screen bg-[#f8f8f6] text-slate-950"><B2BHeader/>
    <main className="mx-auto max-w-6xl px-4 py-16 sm:py-24">
      <div className="max-w-2xl border-l-4 border-[#ffcc00] pl-6">
        <span className="text-xs font-extrabold uppercase tracking-[.25em] text-yellow-700">ÇALIŞKAN B2B</span>
        <h1 className="mt-4 text-4xl font-black sm:text-5xl">{page.title}</h1>
        <p className="mt-6 text-base leading-8 text-slate-600">{page.text}</p>
        <Link href={page.href} className="mt-8 inline-flex min-h-12 items-center gap-3 rounded-xl bg-black px-5 py-3 text-sm font-bold text-white transition hover:bg-zinc-800">{page.cta}<ArrowRight className="h-4 w-4"/></Link>
      </div>
    </main><B2BFooter/>
  </div>;
}
