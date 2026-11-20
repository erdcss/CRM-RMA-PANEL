import { useEffect } from "react";
import { Link } from "wouter";
import { B2BHeader } from "@/components/b2b-header";
import { B2BFooter } from "@/components/b2b-footer";
import { ArrowLeft, ArrowRight, FileText, Truck } from "lucide-react";

type LegalSection = { title: string; paragraphs: string[] };

function CommerceLegalPage({ title, subtitle, sections, updated }: {
  title: string; subtitle: string; sections: LegalSection[]; updated: string;
}) {
  useEffect(() => {
    const oldTitle = document.title;
    document.title = title + " | Çalışkan B2B";
    return () => { document.title = oldTitle; };
  }, [title]);

  return (
    <div className="min-h-screen bg-[#f8f8f6] text-[#171717]">
      <B2BHeader />
      <main className="mx-auto w-full max-w-6xl px-4 pb-16 pt-8 sm:px-6 sm:pt-12" id="main-content">
        <Link href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-600 hover:text-black"><ArrowLeft className="h-4 w-4" /> Ana sayfa</Link>
        <div className="mt-7 overflow-hidden rounded-3xl bg-[#111] px-6 py-10 text-white sm:px-10 sm:py-14">
          <div className="flex items-center gap-3 text-sm font-semibold text-[#ffcc00]"><FileText className="h-5 w-5" /> ÇALIŞKAN B2B · YASAL BİLGİLENDİRME</div>
          <h1 className="mt-5 text-3xl font-black leading-tight sm:text-5xl">{title}</h1>
          <p className="mt-4 max-w-3xl text-sm leading-7 text-white/75 sm:text-base">{subtitle}</p>
          <p className="mt-5 text-xs text-white/60">Son güncelleme: {updated}</p>
        </div>
        <div className="mt-7 grid gap-6 lg:grid-cols-[minmax(0,1fr)_260px]">
          <article className="space-y-9 rounded-3xl border border-zinc-200 bg-white px-5 py-8 shadow-sm sm:px-9 sm:py-10">
            {sections.map((s, i) => (
              <section key={s.title} id={"bolum-" + (i+1)} className="scroll-mt-8">
                <h2 className="text-lg font-extrabold sm:text-xl">{i + 1}. {s.title}</h2>
                <div className="mt-3 space-y-3 text-sm leading-7 text-zinc-700 sm:text-[15px]">
                  {s.paragraphs.map((p) => <p key={p}>{p}</p>)}
                </div>
              </section>
            ))}
          </article>
          <aside className="h-fit space-y-4 lg:sticky lg:top-5">
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <Truck className="h-6 w-6 text-amber-600" />
              <p className="mt-3 font-extrabold">Teslimat ve iade</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Kargo, teslim alma, sipariş iptali ve iade talebi koşulları.</p>
              <Link href="/teslimat-iade" className="mt-4 inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4">Şartları incele <ArrowRight className="h-4 w-4" /></Link>
            </div>
            <div className="rounded-2xl border border-zinc-200 bg-white p-5">
              <p className="font-extrabold">İletişim ve destek</p>
              <p className="mt-2 text-sm leading-6 text-zinc-600">Sipariş ve ticari işlemlerle ilgili talebinizi destek merkezimizden iletebilirsiniz.</p>
              <Link href="/iletisim" className="mt-4 inline-flex items-center gap-2 text-sm font-bold underline underline-offset-4">İletişim <ArrowRight className="h-4 w-4" /></Link>
            </div>
          </aside>
        </div>
      </main>
      <B2BFooter />
    </div>
  );
}

const distanceSections: LegalSection[] = [
  { title: "Taraflar, platform ve kapsam", paragraphs: [
    "Bu metin, Çalışkan B2B (b2b.ecalisgan.com) üzerinden kurulan mesafeli ticari mal alım-satım işlemleri için genel sözleşme şartlarını açıklar. Platform, işletmelerin toptan ürünleri inceleyip sipariş verebildiği bir dijital satış kanalıdır.",
    "Somut işlemde satıcı, ürün/sipariş detayında ve ilgili ticari faturada gösterilen satıcıdır; alıcı, siparişi veren kayıtlı işletme hesabıdır. Satıcının resmî unvanı, kayıtlı adresi, vergi ve iletişim bilgileri işlem belgelerindeki kayıtlarla birlikte değerlendirilir. Platformda üçüncü taraf satıcı varsa satıcıya özgü şartlar ayrıca gösterilir.",
    "Alıcı, işletme adına sipariş vermeye yetkili olduğunu ve üyelik/fatura bilgilerinin doğru olduğunu kabul eder. Bu metin, taraflar arasında ayrıca imzalanan özel bir ticari sözleşmenin açıkça düzenlediği hususları değiştirmez."
  ]},
  { title: "Ürünler ve siparişin oluşumu", paragraphs: [
    "Ürün cinsi, koli içi adet, sipariş miktarı, birim/toplam tutar, KDV, varsa kargo ve diğer masraflar sipariş onayından önce ekranda gösterilir. Onaylanan sipariş özeti, tarafların işlem kayıtlarının parçasıdır.",
    "Sipariş talebinin gönderilmesi tek başına stok ve teslimat garantisi oluşturmaz. Satıcı tarafından kabul/teyit edilmesi ve seçilen ödeme yöntemine göre ödeme durumunun doğrulanmasıyla sipariş işleme alınır. Stok veya fiyat hatasında alıcı bilgilendirilerek mutabakat aranır."
  ]},
  { title: "Ödeme ve faturalandırma", paragraphs: [
    "Kartlı ödeme seçeneği sunulduğunda ödeme bilgileri ilgili yetkili ödeme hizmeti sağlayıcısının güvenli ekranında işlenir. Havale/EFT ile ödemede yalnızca sipariş için bildirilen hesap ve açıklama bilgileri geçerlidir. Ödemenin gerçekleştirildiği, ödeme hizmeti sağlayıcısının veya bankanın teyidiyle belirlenir.",
    "Ödeme alınmadan teslim edilmesi ayrıca kararlaştırılmamış ürünlerde sevkiyat, ödeme ve stok teyidine bağlıdır. Vergi ve fatura bilgileri işletme hesabında doğrulanmalı; satıcı faturayı yürürlükteki mevzuata uygun düzenlemelidir."
  ]},
  { title: "Teslimat ve nakliye", paragraphs: [
    "Teslim şekli, taşıyıcı/ambar veya mağazadan teslim alma seçeneği, tahmini termin ve taşıma bedeli sipariş adımında gösterilen koşullara ve ayrıca yazılı mutabakata göre belirlenir.",
    "Alıcı teslimat adresi ve yetkili teslim alacak kişi bilgilerinin doğruluğundan sorumludur. Hasar, eksiklik veya yanlış ürün halinde teslim tutanağı tutulması ve gecikmeden destek birimine bildirim yapılması değerlendirmeyi kolaylaştırır; kanuni hakları kendiliğinden ortadan kaldırmaz."
  ]},
  { title: "İptal, iade, ayıp ve uyuşmazlık", paragraphs: [
    "Ticari amaçla işletmeler arasında yapılan alımlarda ayıpsız ürünün koşulsuz iade edilmesi otomatik bir hak değildir; iade/iptal koşulları siparişe ilişkin ticari anlaşma ve yürürlükteki mevzuata göre değerlendirilir. Ayıplı veya sözleşmeye aykırı mallarla ilgili alıcının kanuni hakları saklıdır.",
    "İptal, teslimat, ayıp ve iade başvuruları /destek üzerinden sipariş numarası ve açıklama ile iletilebilir. İadeye ilişkin ayrıntılar /teslimat-iade sayfasında açıklanır.",
    "İşlemin hukuken tüketici işlemi sayıldığı istisnai hallerde emredici tüketici hakları ve bilgilendirme yükümlülükleri öncelikle uygulanır. Ticari uyuşmazlıklarda uygulanabilir Türk mevzuatı ve taraflar arasındaki özel yetki hükümleri dikkate alınır."
  ]},
  { title: "İletişim ve kayıtların saklanması", paragraphs: [
    "Platform: Çalışkan B2B — https://b2b.ecalisgan.com. Sipariş ve sözleşme talepleriniz için /iletisim veya /destek sayfalarını kullanabilirsiniz.",
    "Sipariş, ödeme doğrulama ve fatura kayıtları ilgili ticari yükümlülükler ile kişisel veri mevzuatına uygun sürelerde tutulur. Kişisel verilerin işlenmesi /gizlilik-politikasi sayfasında açıklanır."
  ]}
];

const deliverySections: LegalSection[] = [
  { title: "Teslimat seçenekleri", paragraphs: [
    "Çalışkan B2B siparişlerinde sunulan teslim seçenekleri sipariş sırasında gösterilir: uygun ürünlerde kargo, ambar/nakliye ve mağazadan teslim alma. Kullanılabilir yöntem ürün, koli hacmi, teslimat adresi ve satıcıya göre değişebilir.",
    "Teslimat ücreti ve siparişe özel hazırlık/taşıma koşulları ödeme öncesi sipariş özetinde gösterilir. Kesin teslim günü ayrıca açıkça teyit edilmedikçe gösterilen süreler tahminidir."
  ]},
  { title: "Sipariş hazırlığı ve takip", paragraphs: [
    "Sipariş, stok ve ödeme teyidinin ardından hazırlanır. Sevkiyat veya teslim alma bilgileri, kullanılabilir olduğunda sipariş hesabında veya kayıtlı iletişim kanallarında paylaşılır.",
    "Teslimat için işletme unvanı, yetkili alıcı, telefon ve adres bilgilerinin güncel tutulması gerekir. Hatalı/eksik bilgilerden kaynaklanan gecikmeler taraflarca durum özelinde değerlendirilir."
  ]},
  { title: "Eksik, yanlış veya hasarlı ürün", paragraphs: [
    "Paketin gözle görülür hasarı varsa mümkünse taşıyıcıyla tutanak düzenleyin. Eksik/yanlış/hasarlı ürün iddiasını sipariş numarası, ürün kodu ve mevcut fotoğraflarla /destek üzerinden bildirin.",
    "Tutanak veya fotoğraf bulunmaması, kanunen mevcut hakları otomatik olarak ortadan kaldırmaz. Tacir alıcıların kanuni muayene ve ihbar yükümlülükleri saklıdır."
  ]},
  { title: "İptal ve ayıpsız ürün iadeleri", paragraphs: [
    "Sipariş henüz sevke hazırlanmadıysa /destek üzerinden iptal talebi iletebilirsiniz. Tedarike özel veya sevke alınmış siparişler, ürün niteliği ve tarafların anlaşmasına göre değerlendirilebilir.",
    "Çalışkan B2B işletmelere yönelik toptan satış kanalıdır. Bu nedenle ticari satışlarda ayıpsız ürünün yalnızca vazgeçme nedeniyle iadesi, özel anlaşma veya uygulanabilir mevzuat dışında otomatik olarak kabul edilmez. Satıcı tarafından kabul edilen iadede taşıma, ambalaj ve geri ödeme ayrıntıları yazılı olarak bildirilir."
  ]},
  { title: "Ayıplı ürünlerde çözüm ve geri ödeme", paragraphs: [
    "Ayıplı, yanlış veya eksik teslim edilen mallara ilişkin kanuni haklar saklıdır. Talep incelendikten sonra ilgili mevzuat ve satıcıyla yapılan anlaşmaya göre değiştirme, eksikliğin giderilmesi, onarım, bedel indirimi veya bedel iadesi seçenekleri değerlendirilir.",
    "Onaylanan para iadeleri, ödeme aracına uygun biçimde ve uygulanabilir yasal süreler içinde gerçekleştirilir. Banka/ödeme kuruluşunun hesaba yansıtma süresi ayrıca değişebilir. İade için kullanıcıdan kart şifresi ya da SMS doğrulama kodu istenmez."
  ]},
  { title: "Tüketici işlemlerine ilişkin istisna", paragraphs: [
    "Bir işlem niteliği gereği tüketici mevzuatına tabiyse 6502 sayılı Kanun ve Mesafeli Sözleşmeler Yönetmeliği'nin emredici hükümleri uygulanır; tüketicinin kanuni cayma, ayıplı mal ve geri ödeme hakları bu sayfadaki ticari satış açıklamalarıyla sınırlandırılamaz."
  ]},
  { title: "Başvuru kanalları", paragraphs: [
    "İade, iptal ve teslimat taleplerini sipariş numarasıyla Çalışkan B2B Destek Merkezi (/destek) üzerinden iletebilirsiniz. Ticari işlemle ilgili sorular için /iletisim sayfası kullanılabilir.",
    "Bu sayfa genel bilgilendirmedir; işlem sırasında gösterilen ürün ve satıcı koşulları ile kanundan doğan haklar saklıdır."
  ]}
];

export function B2BDistanceSalesPage() {
  return <CommerceLegalPage title="Mesafeli Satış Sözleşmesi" subtitle="İşletmeler arası toptan ürün siparişleri, ödeme, teslimat ve ticari satış hükümleri." sections={distanceSections} updated="20 Kasım 2026" />;
}

export function B2BDeliveryReturnsPage() {
  return <CommerceLegalPage title="Teslimat, İptal ve İade Şartları" subtitle="Toptan siparişlerinizin sevkiyat, teslim alma, iptal ve iade süreçleri hakkında bilgilendirme." sections={deliverySections} updated="20 Kasım 2026" />;
}
