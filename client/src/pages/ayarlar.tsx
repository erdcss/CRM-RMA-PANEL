import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  CreditCard,
  Database,
  Copy,
  KeyRound,
  Mail,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  FileImage,
  Image as ImageIcon,
  Landmark,
  Monitor,
  Save,
  Settings as SettingsIcon,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import type { BrandingConfig } from "@/hooks/use-branding";
import { emptyStoreLinks, type StoreLinks } from "@/components/b2b-footer";

async function fetchBranding(): Promise<BrandingConfig> {
  const response = await fetch("/api/admin/branding", { credentials: "include" });
  if (!response.ok) throw new Error("Marka ayarları alınamadı");
  return response.json();
}

type PaymentSettings = {
  iyzicoConfigured: boolean;
  bankTransfer: {
    enabled: boolean;
    bankName: string;
    accountHolder: string;
    iban: string;
  };
};

async function fetchPaymentSettings(): Promise<PaymentSettings> {
  const response = await fetch("/api/admin/payment-settings", { credentials: "include" });
  if (!response.ok) throw new Error("Ödeme ayarları alınamadı");
  return response.json();
}

export default function Ayarlar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState(() =>
    typeof window !== "undefined" && new URLSearchParams(window.location.search).get("tab") === "email"
      ? "email" : "branding",
  );
  const [footerDraft, setFooterDraft] = useState<Partial<StoreLinks>>({});
  const [savingFooter,setSavingFooter]=useState(false);
  const { data: footerSettings = emptyStoreLinks } = useQuery<StoreLinks>({ queryKey:["/api/admin/b2b-footer"],queryFn:async()=>{const r=await fetch("/api/admin/b2b-footer");if(!r.ok)throw new Error("Alt bilgi okunamadı");return r.json();} });
  const footerValues = {...footerSettings,...footerDraft};
  const [notifications, setNotifications] = useState(true);
  const [autoBackup, setAutoBackup] = useState(false);
  const [draft, setDraft] = useState<BrandingConfig>({});
  const [saving, setSaving] = useState(false);
  const [savingPayments, setSavingPayments] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<PaymentSettings["bankTransfer"] | null>(null);

  const { data: branding = {}, isLoading } = useQuery<BrandingConfig>({
    queryKey: ["/api/admin/branding"],
    queryFn: fetchBranding,
  });

  const { data: paymentSettings } = useQuery<PaymentSettings>({
    queryKey: ["/api/admin/payment-settings"],
    queryFn: fetchPaymentSettings,
  });

  const values = useMemo(() => ({ ...branding, ...draft }), [branding, draft]);
  const bankTransfer = paymentDraft || paymentSettings?.bankTransfer || {
    enabled: false,
    bankName: "",
    accountHolder: "",
    iban: "",
  };

  async function saveFooter() {
    setSavingFooter(true);
    try {
      const response = await fetch("/api/admin/b2b-footer",{ method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify(footerValues) });
      const payload = await response.json().catch(()=>({}));
      if (!response.ok) throw new Error(payload.error || "Kaydedilemedi");
      setFooterDraft({});
      await Promise.all([queryClient.invalidateQueries({queryKey:["/api/admin/b2b-footer"]}),queryClient.invalidateQueries({queryKey:["/api/public/b2b-footer"]})]);
      toast({title:"Kaydedildi",description:"B2B footer ve mağaza bağlantıları güncellendi"});
    } catch(error) { toast({title:"Kaydedilemedi",description:error instanceof Error?error.message:"Bir hata oluştu",variant:"destructive"}); }
    finally {setSavingFooter(false);}
  }

  async function saveBranding() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/branding", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Ayarlar kaydedilemedi");

      setDraft({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/branding"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/public/branding"] }),
      ]);
      toast({ title: "Kaydedildi", description: "Marka ve görsel ayarları güncellendi." });
    } catch (error) {
      toast({
        title: "Kaydedilemedi",
        description: error instanceof Error ? error.message : "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  function setAsset(key: keyof BrandingConfig, value: string | null) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function updateBankTransfer(
    key: keyof PaymentSettings["bankTransfer"],
    value: string | boolean,
  ) {
    setPaymentDraft((current) => ({
      ...(current || bankTransfer),
      [key]: value,
    }));
  }

  async function savePaymentSettings() {
    setSavingPayments(true);
    try {
      const response = await fetch("/api/admin/payment-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ bankTransfer }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Ödeme ayarları kaydedilemedi");

      setPaymentDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/public/payment-settings"] }),
      ]);
      toast({ title: "Ödeme ayarları kaydedildi", description: "Havale/EFT bilgileri güncellendi." });
    } catch (error) {
      toast({
        title: "Ödeme ayarları kaydedilemedi",
        description: error instanceof Error ? error.message : "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setSavingPayments(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-6 xl:p-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Ayarlar</h1>
          <p className="mt-2 text-muted-foreground">
            Yönetim paneli, web sitesi ve mobil uygulama marka varlıklarını tek merkezden yönetin.
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="branding">Marka & Görseller</TabsTrigger>
            <TabsTrigger value="payments">Ödeme</TabsTrigger>
            <TabsTrigger value="system">Sistem</TabsTrigger>
            <TabsTrigger value="apple-review">Apple İnceleme Hesabı</TabsTrigger>
            <TabsTrigger value="email">E-posta Servisi</TabsTrigger>
          </TabsList>

          <TabsContent value="branding" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  Web Yönetim Paneli
                </CardTitle>
                <CardDescription>
                  admin.ecalisgan.com için logo ve tarayıcı favicon görsellerini yönetin.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <AssetUploader
                  title="Admin Logo"
                  description="Sidebar ve admin giriş ekranında kullanılır."
                  value={values.admin_logo}
                  onChange={(value) => setAsset("admin_logo", value)}
                />
                <AssetUploader
                  title="Admin Favicon"
                  description="Tarayıcı sekmesi ve PWA simgesi için kullanılır."
                  value={values.admin_favicon}
                  onChange={(value) => setAsset("admin_favicon", value)}
                  square
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Monitor className="h-5 w-5" />
                  B2B Web Sitesi
                </CardTitle>
                <CardDescription>
                  b2b.ecalisgan.com web mağazasının logo ve favicon varlıkları.
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-2">
                <AssetUploader
                  title="B2B Web Logo"
                  description="Mağaza üst menüsü, giriş ve ürün sayfalarında kullanılır."
                  value={values.b2b_logo}
                  onChange={(value) => setAsset("b2b_logo", value)}
                />
                <AssetUploader
                  title="B2B Web Favicon"
                  description="B2B tarayıcı sekmesi için kullanılır."
                  value={values.b2b_favicon}
                  onChange={(value) => setAsset("b2b_favicon", value)}
                  square
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>B2B Alt Bilgi · Sosyal Medya ve Uygulama Mağazaları</CardTitle><CardDescription>Web sitesinin en altındaki siyah şerit ve mobil hamburger menüsündeki bağlantıları yönetin. Boş alanlar kullanıcıya gösterilmez.</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {([
                    ["instagram","Instagram bağlantısı"],["facebook","Facebook bağlantısı"],["youtube","YouTube bağlantısı"],["tiktok","TikTok bağlantısı"],
                    ["appStoreUrl","App Store URL"],["googlePlayUrl","Google Play URL"],
                    ["appStoreImage","App Store rozet görsel URL"],["googlePlayImage","Google Play rozet görsel URL"]
                  ] as const).map(([key,title])=><label key={key} className="space-y-2"><span className="text-sm font-semibold">{title}</span><Input type="url" placeholder="https://" value={footerValues[key] || ""} onChange={e=>setFooterDraft(v=>({...v,[key]:e.target.value}))}/></label>)}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AssetUploader title="App Store rozet görseli yükle" description="PNG, JPEG veya WebP mağaza rozeti; küçük dosya önerilir." value={footerValues.appStoreImage || null} onChange={value=>setFooterDraft(v=>({...v,appStoreImage:value||""}))}/>
                  <AssetUploader title="Google Play rozet görseli yükle" description="PNG, JPEG veya WebP mağaza rozeti; küçük dosya önerilir." value={footerValues.googlePlayImage || null} onChange={value=>setFooterDraft(v=>({...v,googlePlayImage:value||""}))}/>
                </div>
                <div className="flex flex-wrap gap-4">
                  {(["appStoreImage","googlePlayImage"] as const).map(key => footerValues[key] ? <img key={key} src={footerValues[key]} alt={key} className="h-12 max-w-44 rounded bg-slate-900 object-contain p-1"/> : null)}
                </div>
                <Button disabled={savingFooter} onClick={()=>void saveFooter()}><Save className="mr-2 h-4 w-4"/>{savingFooter?"Kaydediliyor…":"Alt Bilgi Bağlantılarını Kaydet"}</Button>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Çalışkan B2B Mobile
                  </CardTitle>
                  <CardDescription>Çalışkan B2B mobil uygulamasının logo, 5 saniyelik splash ve giriş ekranı görsellerini ayrı yönetin.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <AssetUploader
                    title="Uygulama Logosu"
                    description="iOS uygulama simgesi için 1024×1024 PNG yükleyin."
                    value={values.b2b_mobile_logo}
                    onChange={(value) => setAsset("b2b_mobile_logo", value)}
                    square
                    pngOnly
                  />
                  <AssetUploader
                    title="Android Uygulama İkonu"
                    description="GEREKLİ: 1024×1024 piksel kare PNG (tercihen şeffaf olmayan, keskin/HD). Arka planı dört kenara kadar doldurun; iç boşluk bırakmayın. Logo ve okunması gereken yazılar merkezdeki yaklaşık 680×680 piksel güvenli daire içinde kalsın. Android simge şeklini cihaz belirler."
                    value={values.b2b_mobile_android_icon}
                    onChange={(value) => setAsset("b2b_mobile_android_icon", value)}
                    square
                    cover
                    requiredSize={[1024, 1024]}
                    pngOnly
                  />
                  <AssetUploader
                    title="Splash Ekranı"
                    description="Önerilen: 1080×1920 piksel dikey PNG (9:16), yüksek çözünürlüklü ve kenarlara kadar uzanan tasarım. Android 12+ ilk sistem açılış ekranı üretici/işletim sistemi tarafından kontrol edilir; ardından görsel tam ekran ve kırpılarak (cover) gösterilir."
                    value={values.b2b_mobile_splash}
                    onChange={(value) => setAsset("b2b_mobile_splash", value)}
                    pngOnly
                  />
                  <div className="sm:col-span-2">
                    <AssetUploader
                      title="Giriş Ekranı Görseli"
                      description="Önerilen 1080×1920 dikey PNG, JPEG veya WebP. Giriş ve İşletmemi Kaydet ekranlarının arka planıdır; splash ekranından bağımsızdır. Form alanlarını görsele eklemeyin."
                      value={values.b2b_mobile_login_background}
                      onChange={(value) => setAsset("b2b_mobile_login_background", value)}
                      cover
                      portrait
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Çalışkan Business Mobile
                  </CardTitle>
                  <CardDescription>Business uygulamasının logo ve splash varlıkları.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <AssetUploader
                    title="Uygulama Logosu"
                    description="Business mobil marka ikonu."
                    value={values.business_mobile_logo}
                    onChange={(value) => setAsset("business_mobile_logo", value)}
                    square
                  />
                  <AssetUploader
                    title="Splash Ekranı"
                    description="Business uygulama açılış görseli."
                    value={values.business_mobile_splash}
                    onChange={(value) => setAsset("business_mobile_splash", value)}
                  />
                </CardContent>
              </Card>
            </div>

            <div className="rounded-2xl border bg-background p-4 text-sm text-muted-foreground">
              <b className="text-foreground">Mobil build notu:</b> Logo ve splash görselleri burada merkezi olarak saklanır.
              Uygulama içi splash bir sonraki açılışta güncellenir. Sonraki native build güncel logo ve splash görsellerini otomatik indirir;
              sistemin ilk açılış ekranı ve uygulama ikonu için yeni iOS/Android buildin dağıtılması gerekir.
            </div>

            <div className="sticky bottom-4 flex justify-end">
              <Button size="lg" onClick={saveBranding} disabled={saving || isLoading || Object.keys(draft).length === 0}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Kaydediliyor…" : "Görsel Ayarlarını Kaydet"}
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  iyzico Canlı Kart Ödemesi
                </CardTitle>
                <CardDescription>
                  Kart bilgileri Çalışkan sunucularında tutulmaz; ödeme iyzico Checkout Form üzerinden tamamlanır.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex flex-col gap-3 rounded-xl border p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="font-semibold">Canlı bağlantı durumu</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Railway üzerinde IYZICO_API_KEY ve IYZICO_SECRET_KEY tanımlandığında aktif olur.
                    </div>
                  </div>
                  <span className={`inline-flex w-fit rounded-full px-3 py-1 text-sm font-semibold ${
                    paymentSettings?.iyzicoConfigured
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-amber-100 text-amber-800"
                  }`}>
                    {paymentSettings?.iyzicoConfigured ? "Canlı bağlantı aktif" : "API anahtarları bekleniyor"}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Landmark className="h-5 w-5" />
                  Havale / EFT
                </CardTitle>
                <CardDescription>
                  B2B ödeme sayfasında gösterilecek banka ve IBAN bilgilerini yönetin.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between rounded-xl border p-4">
                  <div>
                    <Label htmlFor="bank-transfer-enabled" className="font-semibold">Havale/EFT ödeme seçeneği</Label>
                    <div className="mt-1 text-xs text-muted-foreground">Aktif edildiğinde müşteriler ödeme sayfasında bu yöntemi seçebilir.</div>
                  </div>
                  <Switch
                    id="bank-transfer-enabled"
                    checked={bankTransfer.enabled}
                    onCheckedChange={(value) => updateBankTransfer("enabled", value)}
                  />
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label>Banka Adı</Label>
                    <Input
                      value={bankTransfer.bankName}
                      onChange={(event) => updateBankTransfer("bankName", event.target.value)}
                      placeholder="Örn. Türkiye İş Bankası"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Hesap Sahibi</Label>
                    <Input
                      value={bankTransfer.accountHolder}
                      onChange={(event) => updateBankTransfer("accountHolder", event.target.value)}
                      placeholder="Firma unvanı"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>IBAN</Label>
                  <Input
                    value={bankTransfer.iban}
                    onChange={(event) => updateBankTransfer("iban", event.target.value.toUpperCase())}
                    placeholder="TR00 0000 0000 0000 0000 0000 00"
                    className="font-mono"
                  />
                </div>

                <div className="flex justify-end">
                  <Button onClick={savePaymentSettings} disabled={savingPayments || paymentDraft === null}>
                    <Save className="mr-2 h-4 w-4" />
                    {savingPayments ? "Kaydediliyor…" : "Ödeme Ayarlarını Kaydet"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="apple-review" className="space-y-6">
            <AppleReviewAccountSettings />
          </TabsContent>
          <TabsContent value="email" className="space-y-6">
            <B2BMailSettings />
          </TabsContent>

          <TabsContent value="system" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Bell className="h-5 w-5" />
                  Bildirimler
                </CardTitle>
                <CardDescription>Operasyon bildirim tercihleri</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="notifications">Yeni kayıt bildirimleri</Label>
                  <Switch id="notifications" checked={notifications} onCheckedChange={setNotifications} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="h-5 w-5" />
                  Veri Yönetimi
                </CardTitle>
                <CardDescription>Veritabanı ve yedekleme tercihleri</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="auto-backup">Otomatik yedekleme</Label>
                  <Switch id="auto-backup" checked={autoBackup} onCheckedChange={setAutoBackup} />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <SettingsIcon className="h-5 w-5" />
                  Uygulama Bilgisi
                </CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 text-sm sm:grid-cols-3">
                <Info label="Versiyon" value="1.0.0" />
                <Info label="Platform" value="Web + iOS + Android" />
                <Info label="Altyapı" value="Railway + PostgreSQL" />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}



type B2BMailStatus = {
  provider: "resend"|"gmail_api"|"webhook"|"gmail_smtp"|"none";
  configured: boolean;
  sender?: string|null;
  verification: "last_send_succeeded"|"last_send_failed"|"not_tested_since_restart";
  latestAttempt?: { at: string; provider: string; success: boolean; error?: string } | null;
  missing?: string[];
  guidance?: string;
};
function B2BMailSettings() {
  const { toast } = useToast();
  const [sendingTest,setSendingTest] = useState(false);
  const [testRecipient,setTestRecipient] = useState("");
  const {data,refetch,isLoading,error}=useQuery<B2BMailStatus>({
    queryKey:["/api/admin/b2b-mail/status"],
    retry:false,
    queryFn:async()=>{
      const r=await fetch("/api/admin/b2b-mail/status",{credentials:"include",cache:"no-store"});
      const b=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(b.error||"E-posta durumu alınamadı.");
      return b as B2BMailStatus;
    },
  });
  // Gmail can safely prefill the already configured mailbox; users can
  // change the destination when the super-admin login has no email.
  useEffect(() => {
    if (data?.provider === "gmail_api" && data.sender) {
      setTestRecipient(current => current || data.sender || "");
    }
  }, [data?.provider, data?.sender]);

  async function testMail() {
    const recipient = testRecipient.trim().toLowerCase();
    if (!/^[^\\s@<>]+@[^\\s@<>]+\\.[^\\s@<>]+$/.test(recipient) || recipient.length > 254) {
      toast({title:"Geçerli bir alıcı e-posta adresi girin",variant:"destructive"});
      return;
    }
    setSendingTest(true);
    try {
      const r=await fetch("/api/admin/b2b-mail/test",{method:"POST",credentials:"include",headers:{"Content-Type":"application/json"},body:JSON.stringify({recipient})});
      const b=await r.json().catch(()=>({}));
      if(!r.ok)throw new Error(b.error||"Test e-postası gönderilemedi.");
      toast({title:"E-posta servisi yanıt verdi",description:b.message||"Test gönderimi kabul edildi."});
    }catch(e){
      toast({title:"E-posta bağlantısı çalışmıyor",
        description:e instanceof Error?e.message:"Tekrar deneyin.",
        variant:"destructive"});
    }finally{
      await refetch();
      setSendingTest(false);
    }
  }
  const providerLabel={
    resend:"Resend (HTTPS API)",
    gmail_api:"Google Gmail API (OAuth)",
    webhook:"E-posta webhook",
    gmail_smtp:"Gmail SMTP (Railway üzerinde önerilmez)",
    none:"E-posta sağlayıcısı bulunamadı",
  }[data?.provider||"none"];
  const statusBad=!data?.configured||data?.verification==="last_send_failed";
  return <Card>
    <CardHeader>
      <CardTitle className="flex items-center gap-2"><Mail className="h-5 w-5"/>B2B E-posta Gönderim Merkezi</CardTitle>
      <CardDescription>
        Firma başvurusu onaylandığında tek kullanımlık giriş şifresi gönderilir.
        Şifre e-postası gönderilemezse başvuru beklemede kalır; kullanıcıya erişim açılmaz.
      </CardDescription>
    </CardHeader>
    <CardContent className="space-y-5">
      {isLoading?<p className="text-sm text-muted-foreground">E-posta servisi kontrol ediliyor…</p>:
        error?<p className="text-sm text-destructive">{error instanceof Error?error.message:"Durum kontrolü başarısız"}</p>:
        <div className="space-y-3 rounded-xl border p-4">
          <div className="flex flex-wrap items-center gap-2">
            {statusBad?<AlertTriangle className="h-5 w-5 text-amber-600"/>:
              data?.verification==="last_send_succeeded"?<CheckCircle2 className="h-5 w-5 text-emerald-600"/>:
                <Mail className="h-5 w-5"/>}
            <span className="font-semibold">{providerLabel}</span>
            <span className="text-xs text-muted-foreground">
              {statusBad?"Bağlantı düzeltmesi gerekli":data?.verification==="last_send_succeeded"
                ?"Son gönderim kabul edildi":"Kurulu / canlı test henüz yapılmadı"}
            </span>
          </div>
          <div className="text-sm text-muted-foreground">Gönderici: <strong>{data?.sender||"Tanımlanmamış"}</strong></div>
          {data?.latestAttempt?<div className="text-sm">
            <p>Son deneme: {new Date(data.latestAttempt.at).toLocaleString("tr-TR")} · {data.latestAttempt.success?"Başarılı":"Başarısız"}</p>
            {data.latestAttempt.error?<p className="mt-1 text-destructive">{data.latestAttempt.error}</p>:null}
          </div>:null}
          {data?.guidance?<p className="text-sm leading-6 text-muted-foreground">{data.guidance}</p>:null}
          {data?.missing?.length?<p className="text-sm text-destructive">Eksik: {data.missing.join(", ")}</p>:null}
        </div>}
      <div className="max-w-md space-y-2">
        <Label htmlFor="b2b-mail-test-recipient">Test e-postasının gönderileceği adres</Label>
        <Input id="b2b-mail-test-recipient" type="email" value={testRecipient}
          maxLength={254} autoComplete="email" placeholder="ornek@firma.com"
          onChange={event=>setTestRecipient(event.target.value)} />
        <p className="text-xs text-muted-foreground">
          Yönetici hesabının e-posta adresi kayıtlı olmasa da test yapabilirsiniz.
          Test mesajı şifre veya müşteri bilgisi içermez.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button disabled={sendingTest||isLoading||!data?.configured||!testRecipient.trim()}
          onClick={()=>void testMail()}>
          <Mail className="mr-2 h-4 w-4"/>{sendingTest?"Test gönderiliyor…":"Belirtilen Adrese Test Gönder"}
        </Button>
        <Button variant="outline" onClick={()=>void refetch()}><RefreshCw className="mr-2 h-4 w-4"/>Durumu Yenile</Button>
      </div>
      <div className="space-y-3 rounded-xl border bg-muted/15 p-4 text-sm leading-6">
        <p className="font-semibold">Gmail yetkilendirmesi geçersizse iki çözüm bulunur:</p>
        <p><strong>1. Gmail hesabını yeniden yetkilendirme:</strong> Aynı OAuth istemcisinden yeni bir refresh token
          alın ve Railway CRM-RMA-PANEL servisindeki <code>GOOGLE_GMAIL_REFRESH_TOKEN</code> değişkenini yenileyin.
          <code> gmail.send</code> izni ve Gmail API etkin olmalıdır.</p>
        <p><strong>2. Resend ile gönderim:</strong> Gönderici alan adını doğrulayın.
          Railway CRM-RMA-PANEL servisinde <code>RESEND_API_KEY</code> ve doğrulanmış
          <code> B2B_MAIL_FROM</code> değerlerini tanımlayın.
          Geçerli Resend yapılandırması Gmail yerine öncelikli kullanılır.</p>
        <p className="text-muted-foreground">
          Değişkenleri yalnızca Railway’in gizli değişkenler alanında saklayın; bu ekrana veya sohbete API anahtarı yapıştırmayın.
          Kaydettikten sonra test gönderimini doğrulayın ve bekleyen firma başvurusunu yeniden onaylayın.
        </p>
      </div>
    </CardContent>
  </Card>;
}

function AppleReviewAccountSettings() {
  const { toast } = useToast();
  const [email, setEmail] = useState("caliskanb2b.review@gmail.com");
  const [busy, setBusy] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [credentials, setCredentials] = useState<{ email: string; password: string } | null>(null);

  async function reviewAction(mode: "create" | "reset") {
    const normalizedEmail = email.trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(normalizedEmail)) {
      toast({ title: "Geçerli bir e-posta girin", variant: "destructive" });
      return;
    }
    if (mode === "reset" && !window.confirm("Mevcut Apple inceleme şifresi geçersiz olacak. Devam edilsin mi?")) return;

    setBusy(true);
    try {
      const response = await fetch(mode === "create"
        ? "/api/admin/b2b-review-account"
        : "/api/admin/b2b-review-account/reset-password", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const result = await response.json().catch(() => ({})) as { email?: string; password?: string; error?: string };
      if (!response.ok || !result.email || !result.password) {
        throw new Error(result.error || "Apple inceleme hesabı işlemi tamamlanamadı");
      }
      setCredentials({ email: result.email, password: result.password });
      setCreateDialogOpen(false);
      toast({ title: mode === "create" ? "İnceleme hesabı oluşturuldu" : "İnceleme şifresi yenilendi",
        description: "Giriş bilgileri yalnızca bu kez görüntülenir. App Store Connect'e kaydedin." });
    } catch (error) {
      toast({ title: "İşlem başarısız",
        description: error instanceof Error ? error.message : "Lütfen tekrar deneyin",
        variant: "destructive" });
    } finally { setBusy(false); }
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5" />Apple App Store İnceleme Hesabı</CardTitle>
          <CardDescription>
            Apple inceleme ekibi için ayrı, yetkisiz B2B müşteri hesabı yönetin. Bu hesap firma üyelik başvurusu gerektirmez ve yönetici erişimi vermez.
            Gerçek müşteri hesaplarının e-posta ile ilk şifre oluşturma sürecini etkilemez.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <Button disabled={busy} variant="outline" onClick={() => void reviewAction("reset")}>Mevcut Hesabın Şifresini Yenile</Button>
          <Button disabled={busy} onClick={() => setCreateDialogOpen(true)}>İnceleme Hesabı Oluştur</Button>
        </CardContent>
      </Card>

      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apple inceleme hesabı oluştur</DialogTitle>
            <DialogDescription>İnceleme için ayrı bir e-posta girin. Başka bir kullanıcının hesabı etkilenmez.</DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium">
            <span>İnceleme hesabı e-posta adresi</span>
            <Input type="email" autoComplete="off" value={email} onChange={(event) => setEmail(event.target.value)} />
          </label>
          <Button disabled={busy || !email.includes("@")} onClick={() => void reviewAction("create")}>
            {busy ? "Oluşturuluyor…" : "Hesabı Oluştur"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(credentials)} onOpenChange={(open) => { if (!open) setCredentials(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Apple inceleme hesabı hazır</DialogTitle>
            <DialogDescription>Giriş bilgilerini App Store Connect → App Review Information bölümüne kaydedin. Şifre pencere kapatıldıktan sonra gösterilmez.</DialogDescription>
          </DialogHeader>
          {credentials ? <div className="space-y-3">
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">E-posta</div><code className="break-all">{credentials.email}</code></div>
            <div className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">Şifre</div><code className="break-all">{credentials.password}</code></div>
            <Button onClick={() => {
              void navigator.clipboard.writeText(`Username: ${credentials.email}\nPassword: ${credentials.password}`)
                .then(() => toast({ title: "Giriş bilgileri kopyalandı" }))
                .catch(() => toast({ title: "Kopyalama başarısız", variant: "destructive" }));
            }}><Copy className="mr-2 h-4 w-4" />Giriş Bilgilerini Kopyala</Button>
            <p className="text-xs text-muted-foreground">Bu şifreyi yalnızca Apple inceleme ekibiyle paylaşın.</p>
          </div> : null}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AssetUploader({
  title,
  description,
  value,
  onChange,
  square = false,
  cover = false,
  portrait = false,
  pngOnly = false,
  requiredSize,
}: {
  title: string;
  description: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  square?: boolean;
  cover?: boolean;
  portrait?: boolean;
  pngOnly?: boolean;
  requiredSize?: [number, number];
}) {
  const { toast } = useToast();
  async function handleFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (pngOnly && file.type !== "image/png") {
      toast({ title: "PNG gerekli", description: "Bu uygulama simgesi için PNG formatında görsel seçin.", variant: "destructive" });
      return;
    }
    if (file.size > 7_000_000) {
      toast({ title: "Görsel çok büyük", description: "En fazla 7 MB görsel yükleyin.", variant: "destructive" });
      return;
    }

    if (requiredSize) {
      const dimension = await new Promise<{width:number;height:number}|null>(resolve=>{
        const image=new Image();
        const blobUrl=URL.createObjectURL(file);
        image.onload=()=>{resolve({width:image.naturalWidth,height:image.naturalHeight});URL.revokeObjectURL(blobUrl);};
        image.onerror=()=>{resolve(null);URL.revokeObjectURL(blobUrl);};
        image.src=blobUrl;
      });
      if (!dimension || dimension.width!==requiredSize[0] || dimension.height!==requiredSize[1]) {
        toast({title:"Görsel ölçüsü uygun değil",
          description:`Tam ${requiredSize[0]}×${requiredSize[1]} piksel PNG yükleyin.`,
          variant:"destructive"});
        return;
      }
    }
    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <div className="flex items-start gap-4">
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background ${portrait ? "h-44 w-24" : square ? "h-20 w-20" : "h-20 w-28"}`}>
          {value ? (
            <img src={value} alt={title} className={cover ? "h-full w-full object-cover" : "h-full w-full object-contain p-2"} />
          ) : (
            <ImageIcon className="h-7 w-7 text-muted-foreground" />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-semibold">{title}</div>
          <p className="mt-1 text-xs leading-5 text-muted-foreground">{description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" asChild>
              <label className="cursor-pointer">
                <Upload className="mr-2 h-4 w-4" />
                Görsel Yükle
                <input
                  type="file"
                  accept={pngOnly ? "image/png" : cover ? "image/png,image/jpeg,image/webp" : "image/png,image/jpeg,image/webp,image/svg+xml"}
                  className="hidden"
                  onChange={(event) => void handleFile(event.target.files?.[0])}
                />
              </label>
            </Button>
            {value ? (
              <Button type="button" variant="ghost" size="sm" onClick={() => onChange(null)}>
                <Trash2 className="mr-2 h-4 w-4" />
                Kaldır
              </Button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}
