import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  ShoppingCart,
  ScanBarcode,
  Search,
  Grid2X2,
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
  Store,
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
import LocationNotificationSettings from "@/components/b2b-location-notification-settings";
import { IyzicoAdminCredentials } from "@/components/iyzico-admin-credentials";
import type { BrandingConfig } from "@/hooks/use-branding";
import { emptyStoreLinks, type StoreLinks } from "@/components/b2b-footer";

async function fetchBranding(): Promise<BrandingConfig> {
  const response = await fetch("/api/admin/branding", { credentials: "include" });
  if (!response.ok) throw new Error("Marka ayarları alınamadı");
  return response.json();
}

type MetaTrackingSettings={enabled:boolean;pixelId:string;capiConfigured?:boolean};
type B2BMobileHeaderSettings={
  logo:string|null; background:string|null; tagline:string;
  taglineImage:string|null; taglineMode:"text"|"image";
};
function sloganPreviewSegments(value:string){
  const words=value.trim().split(/\s+/).filter(Boolean);
  return {
    lead: words.length>2 ? words.slice(0,-2).join(" ") : "",
    highlight: words.slice(-2).join(" "),
  };
}
const DEFAULT_HEADER_TAGLINE="Toptan alışverişin akıllı yolu";

// Trim transparent canvas margins without scaling or changing the visible artwork.
// Existing artwork is also normalized when the header is saved again.
async function trimSloganTransparency(source:string):Promise<string>{
  try{
    const image=new Image();
    if(!source.startsWith("data:")&&!source.startsWith("blob:"))image.crossOrigin="anonymous";
    await new Promise<void>((resolve,reject)=>{
      image.onload=()=>resolve();
      image.onerror=()=>reject(new Error("Slogan görseli okunamadı"));
      image.src=source;
    });
    const width=image.naturalWidth,height=image.naturalHeight;
    if(!width||!height||width*height>16_000_000)return source;
    const canvas=document.createElement("canvas");
    canvas.width=width;canvas.height=height;
    const ctx=canvas.getContext("2d",{willReadFrequently:true});
    if(!ctx)return source;
    ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,width,height).data;
    let left=width,right=-1,top=height,bottom=-1;
    for(let y=0;y<height;y++)for(let x=0;x<width;x++){
      if(pixels[(y*width+x)*4+3]<24)continue;
      if(x<left)left=x;if(x>right)right=x;
      if(y<top)top=y;if(y>bottom)bottom=y;
    }
    if(right<left||bottom<top)return source;
    const pad=Math.max(2,Math.ceil((bottom-top+1)*0.04));
    left=Math.max(0,left-pad);right=Math.min(width-1,right+pad);
    top=Math.max(0,top-pad);bottom=Math.min(height-1,bottom+pad);
    const croppedWidth=right-left+1,croppedHeight=bottom-top+1;
    if(croppedWidth===width&&croppedHeight===height)return source;
    const cropped=document.createElement("canvas");
    cropped.width=croppedWidth;cropped.height=croppedHeight;
    const output=cropped.getContext("2d");
    if(!output)return source;
    output.drawImage(canvas,left,top,croppedWidth,croppedHeight,0,0,croppedWidth,croppedHeight);
    const result=cropped.toDataURL("image/png");
    return result.length<=10_000_000?result:source;
  }catch{return source;}
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
  const [savingFooterBanner, setSavingFooterBanner] = useState(false);
  const [metaDraft,setMetaDraft]=useState<Partial<MetaTrackingSettings>>({});
  const [savingMeta,setSavingMeta]=useState(false);
  const {data:metaSettings={enabled:false,pixelId:""}}=useQuery<MetaTrackingSettings>({
    queryKey:["/api/admin/meta-tracking"],
    queryFn:async()=>{const r=await fetch("/api/admin/meta-tracking",{credentials:"include"});if(!r.ok)throw new Error("Meta ayarları alınamadı");return r.json();}
  });
  const metaValues={...metaSettings,...metaDraft};

  const [savingFooter,setSavingFooter]=useState(false);
  const { data: footerSettings = emptyStoreLinks, isLoading: footerLoading } = useQuery<StoreLinks>({ queryKey:["/api/admin/b2b-footer"],queryFn:async()=>{const r=await fetch("/api/admin/b2b-footer",{credentials:"include"});if(!r.ok)throw new Error("Alt bilgi okunamadı");return r.json();} });
  const footerValues = {...footerSettings,...footerDraft};
  const [notifications, setNotifications] = useState(true);
  const [autoBackup, setAutoBackup] = useState(false);
  const [draft, setDraft] = useState<BrandingConfig>({});
  // These controls have a dedicated save action; they never replace the
  // native square app icon, the web storefront logo, or splash assets.
  const [headerLogoDraft,setHeaderLogoDraft]=useState<string|null|undefined>(undefined);
  const [headerBackgroundDraft,setHeaderBackgroundDraft]=useState<string|null|undefined>(undefined);
  const [headerTaglineDraft,setHeaderTaglineDraft]=useState<string|null>(null);
  const [headerTaglineImageDraft,setHeaderTaglineImageDraft]=useState<string|null|undefined>(undefined);
  const [headerTaglineModeDraft,setHeaderTaglineModeDraft]=useState<"text"|"image"|null>(null);
  const [savingHeader,setSavingHeader]=useState(false);
  const [saving, setSaving] = useState(false);
  const [savingPayments, setSavingPayments] = useState(false);
  const [paymentDraft, setPaymentDraft] = useState<PaymentSettings["bankTransfer"] | null>(null);

  const { data: branding = {}, isLoading } = useQuery<BrandingConfig>({
    queryKey: ["/api/admin/branding"],
    queryFn: fetchBranding,
  });

  const {data:mobileHeader,isLoading:headerLoading}=useQuery<B2BMobileHeaderSettings>({
    queryKey:["/api/admin/b2b-mobile-header"],
    queryFn:async()=>{
      const response=await fetch("/api/admin/b2b-mobile-header",{credentials:"include",cache:"no-store"});
      if(!response.ok)throw new Error("Mobil header ayarları alınamadı");
      return response.json();
    },
  });
  const previewHeaderLogo=headerLogoDraft===undefined?(mobileHeader?.logo||null):headerLogoDraft;
  const previewHeaderBackground=headerBackgroundDraft===undefined?(mobileHeader?.background||null):headerBackgroundDraft;
  const previewHeaderTagline=headerTaglineDraft===null
    ? (mobileHeader?.tagline??DEFAULT_HEADER_TAGLINE):headerTaglineDraft;
  const previewHeaderTaglineImage=headerTaglineImageDraft===undefined
    ? (mobileHeader?.taglineImage||null):headerTaglineImageDraft;
  const previewHeaderTaglineMode=headerTaglineModeDraft ?? mobileHeader?.taglineMode ?? "text";
  const previewSloganParts=sloganPreviewSegments(previewHeaderTagline);
  const [trimmedSlogan,setTrimmedSlogan]=useState<{source:string;image:string}|null>(null);
  useEffect(()=>{
    let active=true;
    if(previewHeaderTaglineImage)void trimSloganTransparency(previewHeaderTaglineImage).then(image=>{
      if(active)setTrimmedSlogan({source:previewHeaderTaglineImage,image});
    });
    return ()=>{active=false;};
  },[previewHeaderTaglineImage]);
  const displaySloganImage=trimmedSlogan?.source===previewHeaderTaglineImage
    ? trimmedSlogan.image:previewHeaderTaglineImage;

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

  async function saveMetaTracking(){
    setSavingMeta(true);
    try{
      const response=await fetch("/api/admin/meta-tracking",{
        method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(metaValues)
      });
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error||"Meta ayarları kaydedilemedi");
      setMetaDraft({});
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/admin/meta-tracking"]}),
        queryClient.invalidateQueries({queryKey:["/api/public/meta-tracking"]})
      ]);
      toast({title:"Meta ayarları kaydedildi",description:"B2B web Pixel ve onay tercihi yönetimi güncellendi."});
    }catch(error){
      toast({title:"Meta ayarları kaydedilemedi",description:error instanceof Error?error.message:"Hata oluştu",variant:"destructive"});
    }finally{setSavingMeta(false);}
  }

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

  async function saveFooterBanner() {
    setSavingFooterBanner(true);
    try {
      if (footerLoading || isLoading) throw new Error("Marka ve alt bilgi ayarları henüz yükleniyor");
      const url = String(footerValues.footerBannerUrl || "").trim();
      if (url && !/^https:\/\//i.test(url)) {
        throw new Error("Tıklama bağlantısı https:// ile başlamalı");
      }
      if (Object.prototype.hasOwnProperty.call(draft, "b2b_footer_banner")) {
        const imageResponse = await fetch("/api/admin/branding", {
          method: "PUT", credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ b2b_footer_banner: draft.b2b_footer_banner }),
        });
        const imageResult = await imageResponse.json().catch(() => ({}));
        if (!imageResponse.ok) throw new Error(imageResult.error || "Banner görseli kaydedilemedi");
      }
      const response = await fetch("/api/admin/b2b-footer", {
        method: "PUT", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...footerSettings, footerBannerUrl: url }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Banner bağlantısı kaydedilemedi");
      setDraft(current => {
        const next = { ...current };
        delete next.b2b_footer_banner;
        return next;
      });
      setFooterDraft(current => {
        const next = { ...current };
        delete next.footerBannerUrl;
        return next;
      });
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/admin/branding"]}),
        queryClient.invalidateQueries({queryKey:["/api/public/branding"]}),
        queryClient.invalidateQueries({queryKey:["/api/admin/b2b-footer"]}),
        queryClient.invalidateQueries({queryKey:["/api/public/b2b-footer"]}),
      ]);
      toast({ title: "Alt bilgi bannerı kaydedildi", description: "Web sitesindeki görsel ve tıklama bağlantısı güncellendi." });
    } catch(error) {
      toast({ title: "Banner kaydedilemedi", description: error instanceof Error ? error.message : "Lütfen yeniden deneyin", variant: "destructive" });
    } finally {
      setSavingFooterBanner(false);
    }
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

  async function saveMobileHeader(){
    setSavingHeader(true);
    try{
      if(headerLoading)throw new Error("Header ayarlarının yüklenmesi tamamlanmalı");
      if(previewHeaderTaglineMode==="image"&&!previewHeaderTaglineImage)
        throw new Error("Görsel modunu kullanmak için slogan görseli yükleyin.");
      const payload:{
        tagline:string;taglineMode:"text"|"image";
        logo?:string|null;background?:string|null;taglineImage?:string|null;
      }={
        tagline:previewHeaderTagline.trim(),
        taglineMode:previewHeaderTaglineMode,
      };
      if(headerLogoDraft!==undefined)payload.logo=headerLogoDraft;
      if(headerBackgroundDraft!==undefined)payload.background=headerBackgroundDraft;
      if(headerTaglineImageDraft!==undefined)payload.taglineImage=headerTaglineImageDraft;
      if(previewHeaderTaglineImage&&(previewHeaderTaglineMode==="image"||headerTaglineImageDraft!==undefined)){
        const normalized=trimmedSlogan?.source===previewHeaderTaglineImage
          ? trimmedSlogan.image:await trimSloganTransparency(previewHeaderTaglineImage);
        if(normalized!==previewHeaderTaglineImage)payload.taglineImage=normalized;
      }
      const response=await fetch("/api/admin/b2b-mobile-header",{
        method:"PUT",credentials:"include",headers:{"Content-Type":"application/json"},
        body:JSON.stringify(payload),
      });
      const result=await response.json().catch(()=>({})) as {error?:string};
      if(!response.ok)throw new Error(result.error||"Mobil header kaydedilemedi");
      setHeaderLogoDraft(undefined);
      setHeaderBackgroundDraft(undefined);
      setHeaderTaglineDraft(null);
      setHeaderTaglineImageDraft(undefined);
      setHeaderTaglineModeDraft(null);
      await Promise.all([
        queryClient.invalidateQueries({queryKey:["/api/admin/b2b-mobile-header"]}),
        queryClient.invalidateQueries({queryKey:["/api/admin/branding"]}),
        queryClient.invalidateQueries({queryKey:["/api/public/branding"]}),
      ]);
      toast({title:"Uygulama üst header ayarları kaydedildi",
        description:"Slogan metni, görseli ve görünüm tercihi kaydedildi."});
    }catch(error){
      toast({title:"Header ayarları kaydedilemedi",
        description:error instanceof Error?error.message:"Bir hata oluştu",variant:"destructive"});
    }finally{setSavingHeader(false);}
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
            <TabsTrigger value="mobile-download">Uygulama İndirme Bannerları</TabsTrigger>
            <TabsTrigger value="meta">Meta Pixel</TabsTrigger>
            <TabsTrigger value="payments">Ödeme</TabsTrigger>
            <TabsTrigger value="location-notifications">Konum ve Bildirimler</TabsTrigger>
            <TabsTrigger value="system">Sistem</TabsTrigger>
            <TabsTrigger value="apple-review">Apple İnceleme Hesabı</TabsTrigger>
            <TabsTrigger value="google-play-review">Google Play İnceleme Hesabı</TabsTrigger>
            <TabsTrigger value="email">E-posta Servisi</TabsTrigger>
          </TabsList>


          <TabsContent value="location-notifications"><LocationNotificationSettings/></TabsContent>

          <TabsContent value="meta" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Meta Pixel · Çalışkan B2B Web</CardTitle>
                <CardDescription>
                  Sadece halka açık B2B web mağazasında çalışır. Kullanıcı reklam ölçümüne açıkça izin verene
                  kadar Meta kodu yüklenmez. İşlemler PageView, ViewContent, Search, AddToCart,
                  InitiateCheckout ve doğrulanmış Purchase olaylarıyla izlenir.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="flex items-center gap-4 rounded-xl border p-4">
                  <Switch checked={metaValues.enabled} onCheckedChange={enabled=>setMetaDraft(current=>({...current,enabled}))}/>
                  <div><div className="font-semibold">B2B web Meta Pixel etkin</div>
                    <p className="text-xs text-muted-foreground">Yalnızca izin veren ziyaretçiler için etkinleştirilir.</p></div>
                </div>
                <label className="block max-w-lg space-y-2">
                  <span className="text-sm font-semibold">Meta Pixel / Dataset ID</span>
                  <Input inputMode="numeric" pattern="[0-9]*" value={metaValues.pixelId}
                    onChange={event=>setMetaDraft(current=>({...current,pixelId:event.target.value.replace(/[^0-9]/g,"")}))}
                    placeholder="Sayısal Pixel ID"/>
                  <p className="text-xs text-muted-foreground">Meta Events Manager ekranında seçili Çalışkan B2B web Pixel ID: 949840147857568. Web olayları yalnızca bu alanda kayıtlı veri setine gider. Farklı ID girerseniz olaylar o veri setine yönlendirilir.</p>
                </label>
                <div className="rounded-xl border border-slate-200 bg-muted/30 px-4 py-3 text-sm">
                  <strong>Conversions API bağlantısı:</strong> {metaSettings.capiConfigured
                    ? "Sunucuda erişim belirteci tanımlı (Meta tarafından kabul edildiği henüz test edilmelidir)."
                    : "Eksik · Railway API servisine META_CONVERSIONS_ACCESS_TOKEN gizli değişkeni eklenmeli."}
                </div>
                <p className="text-xs leading-5 text-muted-foreground">
                  Conversions API için ayrıca güvenli bir Meta erişim belirteci ve uygulama olayları için
                  iOS/Android Meta App ID gerekir. Bu gizli bilgiler burada yayınlanmaz.
                  Web Pixel kurulumunu Meta Events Manager → Test Events ekranında doğrulayın. “Facebook SDK güncelleyin” uyarısı ayrı bir iOS/Android uygulama ayarıdır; bu web Pixel alanını değiştirerek kalkmaz.
                </p>
                <Button disabled={savingMeta} onClick={()=>void saveMetaTracking()}>
                  <Save className="mr-2 h-4 w-4"/>{savingMeta?"Kaydediliyor…":"Meta Ayarlarını Kaydet"}
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="mobile-download" className="space-y-5">
            <Card>
              <CardHeader>
                <CardTitle>Uygulama İndirme Alanı · Çalışkan B2B</CardTitle>
                <CardDescription>
                  Masaüstü ana sayfanın sağındaki sabit dikey bannerları, mobil web üst indirme şeridini
                  ve B2B uygulamasının Hesabım bölümündeki güncelleme bağlantısını buradan yönetin.
                  Bağlantı boşsa ilgili banner görünmez.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2">
                  {([
                    ["appStoreUrl","App Store indirme bağlantısı"],
                    ["googlePlayUrl","Google Play indirme bağlantısı"],
                    ["latestIosVersion","Güncel iOS sürümü (örn. 1.1.0)"],
                    ["latestAndroidVersion","Güncel Android sürümü (örn. 1.1.0)"],
                    ["downloadHeaderTitle","Mobil web indirme başlığı"],
                    ["downloadHeaderText","Mobil web indirme açıklaması"]
                  ] as const).map(([key,label])=><label key={key} className="space-y-2">
                    <span className="text-sm font-semibold">{label}</span>
                    <Input value={footerValues[key]} placeholder={key.endsWith("Url")?"https://":"Metin girin"}
                      onChange={event=>setFooterDraft(current=>({...current,[key]:event.target.value}))}/>
                  </label>)}
                </div>
              </CardContent>
            </Card>
            {([
              {key:"appStore",title:"App Store · iPhone",imageKey:"appStoreBannerImage" as const,titleKey:"appStoreBannerTitle" as const,textKey:"appStoreBannerText" as const,buttonKey:"appStoreBannerButton" as const},
              {key:"googlePlay",title:"Google Play · Android",imageKey:"googlePlayBannerImage" as const,titleKey:"googlePlayBannerTitle" as const,textKey:"googlePlayBannerText" as const,buttonKey:"googlePlayBannerButton" as const}
            ]).map(item=><Card key={item.key}>
              <CardHeader><CardTitle>{item.title} · Dikey İndirme Bannerı</CardTitle>
                <CardDescription>Dikey dar tasarıma uygun görsel, kısa metin ve bağlantıya giden indirme butonu.</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                <AssetUploader portrait cover title={item.title+" banner görseli"}
                  description="Dikey görsel önerilir; PNG, JPG veya WebP."
                  value={footerValues[item.imageKey] || null}
                  onChange={value=>setFooterDraft(current=>({...current,[item.imageKey]:value||""}))}/>
                <div className="grid content-start gap-4">
                  {([
                    [item.titleKey,"Banner başlığı"],
                    [item.textKey,"Banner açıklaması"],
                    [item.buttonKey,"Buton yazısı"]
                  ] as const).map(([key,label])=><label key={key} className="space-y-2">
                    <span className="text-sm font-semibold">{label}</span>
                    <Input value={footerValues[key]} onChange={event=>setFooterDraft(current=>({...current,[key]:event.target.value}))}/>
                  </label>)}
                </div>
              </CardContent>
            </Card>)}
            <Button disabled={savingFooter} onClick={()=>void saveFooter()}>
              <Save className="mr-2 h-4 w-4"/>{savingFooter?"Kaydediliyor…":"İndirme Bannerlarını Kaydet"}
            </Button>
          </TabsContent>

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
              <CardHeader>
                <CardTitle>Web Alt Bilgi · Yatay Banner</CardTitle>
                <CardDescription>
                  B2B web sitesinde alt bilgi bağlantılarının altında ve sosyal medya çubuğunun üstünde görünür.
                  Uzun, ince yatay görsel önerilir (ör. 1800 × 300 px). Görseli yükleyip tıklanınca açılacak bağlantıyı belirleyebilirsiniz.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <AssetUploader
                    title="Alt bilgi banner görseli"
                    description="Yatay görsel yükleyin: PNG, JPG veya WebP. Görsel kesilmeden gösterilir."
                    value={values.b2b_footer_banner}
                    onChange={value=>setAsset("b2b_footer_banner", value)}
                    cover
                  />
                  <label className="space-y-2">
                    <span className="text-sm font-semibold">Banner tıklama bağlantısı (URL)</span>
                    <Input
                      type="url"
                      placeholder="https://wa.me/905386983444"
                      value={footerValues.footerBannerUrl}
                      onChange={event=>setFooterDraft(current=>({...current,footerBannerUrl:event.target.value}))}
                    />
                    <p className="text-xs text-muted-foreground">
                      Örneğin WhatsApp destek veya web destek sayfası. Boş bırakılırsa görsel tıklanamaz.
                      Bağlantı yeni sekmede açılır; yalnızca HTTPS adresleri kabul edilir.
                    </p>
                  </label>
                </div>
                {values.b2b_footer_banner ? <div className="overflow-hidden rounded-xl border bg-white p-2">
                  <p className="mb-2 text-xs font-semibold text-muted-foreground">Web alt bilgi önizlemesi</p>
                  <img src={values.b2b_footer_banner} alt="Yatay alt bilgi banner önizlemesi"
                    className="block aspect-[6/1] w-full object-contain"/>
                </div> : <p className="rounded-xl border border-dashed px-4 py-5 text-sm text-muted-foreground">
                  Henüz bir banner seçilmedi. Görsel kaydedilene kadar web sitesindeki banner alanı gizli kalır.
                </p>}
                <Button disabled={savingFooterBanner || footerLoading || isLoading} onClick={()=>void saveFooterBanner()}>
                  <Save className="mr-2 h-4 w-4"/>
                  {savingFooterBanner ? "Kaydediliyor…" : "Banner Görseli ve Bağlantısını Kaydet"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle>B2B Sosyal Medya ve Ürün Paylaşım Mağaza Rozetleri</CardTitle><CardDescription>Buraya eklediğiniz App Store ve Google Play rozet görselleri, B2B mobil ürün paylaşımının 1080×1920 şablonunda otomatik kullanılır. Web alt bilgi bağlantıları da buradan yönetilir; boş rozet paylaşımda gösterilmez.</CardDescription></CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 md:grid-cols-2">
                  {([
                    ["instagram","Instagram bağlantısı"],["facebook","Facebook bağlantısı"],["youtube","YouTube bağlantısı"],["tiktok","TikTok bağlantısı"],
                    ["appStoreUrl","App Store URL"],["googlePlayUrl","Google Play URL"],
                    ["appStoreImage","App Store rozet görsel URL"],["googlePlayImage","Google Play rozet görsel URL"]
                  ] as const).map(([key,title])=><label key={key} className="space-y-2"><span className="text-sm font-semibold">{title}</span><Input type="url" placeholder="https://" value={footerValues[key] || ""} onChange={e=>setFooterDraft(v=>({...v,[key]:e.target.value}))}/></label>)}
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <AssetUploader title="App Store rozet görseli yükle" description="Ürün paylaşım görselinde kullanılacak orijinal mağaza rozeti. Yüksek çözünürlüklü PNG önerilir." value={footerValues.appStoreImage || null} onChange={value=>setFooterDraft(v=>({...v,appStoreImage:value||""}))}/>
                  <AssetUploader title="Google Play rozet görseli yükle" description="PNG, JPEG veya WebP mağaza rozeti; küçük dosya önerilir." value={footerValues.googlePlayImage || null} onChange={value=>setFooterDraft(v=>({...v,googlePlayImage:value||""}))}/>
                </div>
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-950">
                  Bu iki görsel mobil uygulamanın ürün paylaşım şablonuna doğrudan yansır.
                  Değişiklikleri <b>Alt Bilgi Bağlantılarını Kaydet</b> butonuyla kaydedin.
                  Kayıt sonrasında yeni paylaşım görselleri güncel rozetleri kullanır.
                </div>
                <div className="flex flex-wrap gap-4">
                  {(["appStoreImage","googlePlayImage"] as const).map(key => footerValues[key] ? <img key={key} src={footerValues[key]} alt={key} className="h-12 max-w-44 rounded bg-slate-900 object-contain p-1"/> : null)}
                </div>
                <Button disabled={savingFooter} onClick={()=>void saveFooter()}><Save className="mr-2 h-4 w-4"/>{savingFooter?"Kaydediliyor…":"Alt Bilgi Bağlantılarını Kaydet"}</Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Smartphone className="h-5 w-5" />
                  Çalışkan B2B Mobile · Uygulama Üst Header Bölümü
                </CardTitle>
                <CardDescription>
                  Ana sayfanın üst bölümünde kullanılan yatay logoyu ve altındaki sloganı
                  ve isteğe bağlı arka plan görselini bağımsız yönetin. Bu varlıklar iPhone
                  uygulama simgesi, splash veya B2B web logosunu değiştirmez.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <AssetUploader
                    title="Header Logosu"
                    description="Yatay ve tercihen şeffaf PNG önerilir (ör. 1200×300 px). Görsel orantısı korunur; kesilmeden görüntülenir."
                    value={previewHeaderLogo}
                    onChange={setHeaderLogoDraft}
                    pngOnly
                  />
                  <AssetUploader
                    title="Header Arka Plan Görseli"
                    description="Yatay görsel yükleyin (önerilen 1920×640 px, PNG/JPEG/WebP). Kırpılarak headerı kaplar; logo ve slogan ayrı katmanda kalır."
                    value={previewHeaderBackground}
                    onChange={setHeaderBackgroundDraft}
                    cover
                  />
                  <div className="rounded-2xl border bg-muted/20 p-4 space-y-4">
                    <div>
                      <Label htmlFor="b2b-mobile-header-tagline" className="text-sm font-semibold">
                        Header Sloganı
                      </Label>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Metin olarak beyaz kalın-eğik başlangıç, sarı vurgulu son iki kelime ve alt çizgi kullanılır.
                        İsterseniz aynı alana kendi slogan görselinizi de yükleyebilirsiniz.
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" size="sm"
                        variant={previewHeaderTaglineMode==="text"?"default":"outline"}
                        aria-pressed={previewHeaderTaglineMode==="text"}
                        onClick={()=>setHeaderTaglineModeDraft("text")}>
                        Yazı Olarak
                      </Button>
                      <Button type="button" size="sm"
                        variant={previewHeaderTaglineMode==="image"?"default":"outline"}
                        aria-pressed={previewHeaderTaglineMode==="image"}
                        disabled={!previewHeaderTaglineImage}
                        onClick={()=>setHeaderTaglineModeDraft("image")}>
                        Görsel Olarak
                      </Button>
                    </div>
                    <Input id="b2b-mobile-header-tagline" maxLength={110}
                      value={previewHeaderTagline}
                      onChange={event=>setHeaderTaglineDraft(event.target.value)}
                      placeholder="Toptan alışverişin akıllı yolu"/>
                    <p className="text-right text-xs text-muted-foreground">
                      {previewHeaderTagline.length}/110 karakter
                    </p>
                    <AssetUploader title="Slogan Görseli"
                      description="Önerilen: şeffaf PNG, 1200×180 px. Şeffaf boşluklar otomatik temizlenir; slogan büyütülerek logonun altında gösterilir."
                      value={displaySloganImage}
                      darkPreview
                      pngOnly
                      onChange={value=>{
                        setHeaderTaglineImageDraft(value);
                        setHeaderTaglineModeDraft(value?"image":"text");
                      }}
                    />
                    <p className="text-xs text-muted-foreground">
                      Görsel yüklemek yazılı sloganı silmez; istediğiniz zaman tekrar metin moduna geçebilirsiniz.
                    </p>
                  </div>
                </div>

                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="mb-3 flex items-center gap-2 text-sm font-semibold">
                    <Monitor className="h-4 w-4"/> Header Önizleme
                  </div>
                  <p className="mb-4 text-xs text-muted-foreground">
                    Arka plan saat ve pil simgelerinin arkasından başlayarak headerı tamamen kaplar.
                    Logo ve slogan ortada, altında ince arama çubuğu ve mini kategori kartları bulunur.
                  </p>
                  <div className="mx-auto w-full max-w-[460px] overflow-hidden rounded-[30px] border-[5px] border-slate-600 bg-[#111113] shadow-xl">
                    {/* Header artwork extends behind the status bar to the top edge. */}
                    <div className="relative overflow-hidden bg-[radial-gradient(ellipse_at_top_left,_#45300c,_#141416_60%)]">
                      {previewHeaderBackground ? (
                        <img
                          src={previewHeaderBackground}
                          alt="Çalışkan B2B header arka plan önizlemesi"
                          className="absolute inset-0 h-full w-full object-cover"
                        />
                      ) : null}
                      <div className="relative z-10 flex items-center justify-between px-4 pt-2 text-xs font-bold text-white">
                        <span>9:41</span><span>●●●  ▰</span>
                      </div>
                      <div className="relative z-10 flex min-h-[82px] items-center justify-center px-4 pb-2 pt-1">
                        <div className="flex w-full flex-col items-center justify-center">
                          <div className="flex w-[64%] flex-col items-center justify-center">
                          {previewHeaderLogo ? (
                            <img src={previewHeaderLogo} alt="Çalışkan B2B header logo önizlemesi"
                              className="h-[38px] w-[85%] object-contain"/>
                          ) : (
                            <div className="text-center text-lg font-black text-amber-400">
                              ÇALIŞKAN B2B
                            </div>
                          )}
                          </div>
                          {previewHeaderTaglineMode==="image" && displaySloganImage ? (
                            <img src={displaySloganImage}
                              alt="Çalışkan B2B slogan görseli önizlemesi"
                              className="mt-1 h-[54px] w-[86%] max-w-[340px] object-contain"/>
                          ) : previewHeaderTagline.trim() ? (
                            <div className="mt-1 flex max-w-[90%] items-center justify-center gap-0.5 pb-1.5 text-center text-[15px] font-black italic tracking-tight">
                              {previewSloganParts.lead ? (
                                <span className="text-white">{previewSloganParts.lead}</span>
                              ) : null}
                              <span className="relative whitespace-nowrap text-[#FFCD00]">
                                {previewSloganParts.highlight}
                                <span className="absolute -bottom-[3px] left-[3%] h-[2px] w-[94%] -rotate-3 rounded-full bg-[#FFCD00]"/>
                              </span>
                            </div>
                          ) : null}
                        </div>
                        <div className="absolute right-3 top-2 flex items-center gap-3 text-white">
                          <Bell className="h-5 w-5"/>
                          <ShoppingCart className="h-5 w-5"/>
                        </div>
                      </div>
                    </div>

                    <div className="bg-[#111113] px-3 pb-3 pt-1">
                      <div className="flex h-8 items-center gap-2 rounded-lg bg-[#F8F8F8] pl-3 pr-2 text-xs font-light text-[#45454A]">
                        <Search className="h-4 w-4 shrink-0 text-[#242426]" strokeWidth={1.5}/>
                        <span className="min-w-0 flex-1">Ürün, marka veya barkod ara</span>
                        <ScanBarcode className="h-5 w-5 shrink-0 text-[#202124]" strokeWidth={1.5}/>
                      </div>
                      <div className="mt-[7px] grid grid-cols-7 gap-1 pb-[3px]">
                          {[
                            ["▤","Elektronik"],["◉","Züccaciye"],["♨","Ev Gereçleri"],
                            ["⚒","Hırdavat"],["▣","Ofis & Kırtasiye"],["▥","Toptan Paketler"],
                          ].map(([symbol,label])=>(
                            <div key={label} className="flex h-[57px] min-w-0 flex-col items-center justify-center gap-[3px] rounded-[9px] border border-[#414146] border-t-[#505055] bg-[#2A2A2D] px-0.5 text-white shadow-md shadow-black/40">
                              <span className="text-lg text-[#FFCD00]">{symbol}</span>
                              <span className="w-full break-words text-center text-[8px] font-normal leading-[10px]">{label}</span>
                            </div>
                          ))}
                        <div className="flex h-[57px] min-w-0 flex-col items-center justify-center gap-[3px] rounded-[9px] border border-[#FFCD00] bg-[#2A2A2D] px-0.5 text-white shadow-md shadow-black/40">
                          <Grid2X2 className="h-5 w-5 text-[#FFCD00]"/>
                          <span className="w-full text-center text-[8px] font-normal leading-[10px]">Tüm Kategoriler</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
                <Button disabled={savingHeader||headerLoading||!mobileHeader} onClick={()=>void saveMobileHeader()}>
                  <Save className="mr-2 h-4 w-4"/>
                  {savingHeader?"Kaydediliyor…":"Header Ayarlarını Kaydet"}
                </Button>
              </CardContent>
            </Card>

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Çalışkan B2B Mobile
                  </CardTitle>
                  <CardDescription>Çalışkan B2B mobil uygulamasının logosunu ve tek Splash Ekranı görselini yönetin. Güncel splash her açılışta sunucudan alınır; ilk iOS açılış karesindeki yerel görsel ise yeni TestFlight sürümüyle değişir. Giriş ve kayıt ekranları sabit arka plan kullanır.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <AssetUploader
                    title="Uygulama Logosu"
                    description="Bu 1024×1024 PNG, iOS uygulama simgesi ve HD ürün paylaşım şablonundaki uygulama ikonu olarak kullanılır."
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
                    description="1080×1920 PNG (9:16) önerilir. Başlangıçta kesintisiz gösterilir; değişiklikler sonraki uygulama açılışında alınır. iOS ilk açılış görseli için yeni TestFlight derlemesi gerekir."
                    value={values.b2b_mobile_splash}
                    onChange={(value) => setAsset("b2b_mobile_splash", value)}
                    pngOnly
                  />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Store className="h-5 w-5" />
                    Çalışkan Dükkan · Masaüstü ve Mobil
                  </CardTitle>
                  <CardDescription>Masaüstü ile iOS/Android uygulamasında ortak kullanılan logo ve açılış görseli.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <AssetUploader title="Çalışkan Dükkan Logosu" description="Programın üst alanı ve mobil uygulama logosu." value={values.dukkan_logo} onChange={value=>setAsset("dukkan_logo",value)} square />
                  <AssetUploader title="Çalışkan Dükkan Splash" description="Açılış ekranı görseli." value={values.dukkan_splash} onChange={value=>setAsset("dukkan_splash",value)} />
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
            <IyzicoAdminCredentials />

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
          <TabsContent value="google-play-review" className="space-y-6">
            <GooglePlayReviewAccountSettings />
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
  gmailClientIdPrefix?: string|null;
  sender?: string|null;
  verification: "last_send_succeeded"|"last_send_failed"|"not_tested_since_restart";
  latestAttempt?: { at: string; provider: string; success: boolean; error?: string } | null;
  missing?: string[];
  guidance?: string;
};
function B2BMailSettings() {
  const { toast } = useToast();
  const [sendingTest,setSendingTest] = useState(false);
  const [checkingOauth,setCheckingOauth] = useState(false);
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

  async function checkGmailOAuth() {
    setCheckingOauth(true);
    try {
      const response = await fetch("/api/admin/b2b-mail/check-gmail-oauth", {
        method: "POST", credentials: "include",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Google OAuth kontrolü başarısız.");
      toast({
        title: "Google OAuth yenilemesi başarılı",
        description: result.message || "Şimdi e-posta gönderim testi yapabilirsiniz.",
      });
    } catch (error) {
      toast({
        title: "Google OAuth yenilemesi başarısız",
        description: error instanceof Error ? error.message : "OAuth bağlantısını kontrol edin.",
        variant: "destructive",
      });
    } finally {
      setCheckingOauth(false);
      void refetch();
    }
  }

  async function testMail() {
    const recipient = testRecipient.trim().toLowerCase();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(recipient) || recipient.length > 254) {
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
          {data?.provider === "gmail_api" && data.gmailClientIdPrefix ? (
            <div className="text-sm text-muted-foreground">
              Sunucunun OAuth Client ID başlangıcı: <strong className="font-mono">{data.gmailClientIdPrefix}…</strong>
              <p className="mt-1 text-xs">
                Google Cloud → Clients bölümündeki Caliskan B2B Gmail Production
                istemcisinin Client ID başlangıcıyla aynı olmalıdır.
                Eşleşmiyorsa GOOGLE_GMAIL_CLIENT_ID yanlış servis veya ortama kaydedilmiş olabilir.
              </p>
            </div>
          ) : null}
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
        {data?.provider === "gmail_api" ? (
          <Button variant="outline" disabled={checkingOauth || sendingTest || isLoading}
            onClick={() => void checkGmailOAuth()}>
            <RefreshCw className="mr-2 h-4 w-4"/>
            {checkingOauth ? "OAuth kontrol ediliyor…" : "Google OAuth Bağlantısını Kontrol Et"}
          </Button>
        ) : null}
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

function GooglePlayReviewAccountSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [newEmail,setNewEmail] = useState("googleplay.review@ecalisgan.com");
  const [createOpen,setCreateOpen] = useState(false);
  const [busy,setBusy] = useState(false);
  const [credentials,setCredentials] = useState<{email:string;password:string}|null>(null);
  const [revealPassword,setRevealPassword] = useState(false);
  const endpoint="/api/admin/google-play-review-account";
  const {data:account,isLoading,error} = useQuery<ReviewAccountStatus>({
    queryKey:[endpoint],
    retry:false,
    queryFn:async()=>{
      const response=await fetch(endpoint,{credentials:"include",cache:"no-store"});
      const payload=await response.json().catch(()=>({}));
      if(!response.ok)throw new Error(payload.error || "Hesap durumu alınamadı.");
      return payload as ReviewAccountStatus;
    },
  });
  const instructions = (email:string,password:string) =>
    "Login instructions for Google Play review:\n"+
    "1. Open the Çalışkan B2B application.\n"+
    "2. Tap Sign in / Giriş Yap.\n"+
    "3. Enter the review email and password listed above.\n"+
    "4. Tap Giriş Yap to access the approved test customer account.\n"+
    "No OTP, SMS, WhatsApp verification, company approval, or additional documents are required.\n"+
    "This is a restricted test account; do not place real orders or make real payments.\n"+
    "Review email: "+email+"\nReview password: "+password;
  async function run(mode:"create"|"reset"){
    const email=(mode==="create"?newEmail:account?.email||"").trim().toLowerCase();
    if(!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email)||email.length>254){
      toast({title:"Geçerli bir e-posta adresi girin.",variant:"destructive"});return;
    }
    if(mode==="create"&&(account?.exists||!account))return;
    if(mode==="reset"&&(!account?.exists||!window.confirm(
      "Google Play inceleme hesabının mevcut şifresi geçersiz olacak. Devam edilsin mi?"
    )))return;
    setBusy(true);
    try{
      const response=await fetch(endpoint+(mode==="reset"?"/reset-password":""),{
        method:"POST",credentials:"include",cache:"no-store",
        headers:{"Content-Type":"application/json"},body:JSON.stringify({email}),
      });
      const result=await response.json().catch(()=>({})) as {email?:string;password?:string;error?:string};
      if(!response.ok||!result.email||!result.password)
        throw new Error(result.error||"İnceleme hesabı işlemi başarısız.");
      setCredentials({email:result.email,password:result.password});
      setRevealPassword(false);
      setCreateOpen(false);
      await queryClient.invalidateQueries({queryKey:[endpoint]});
      toast({title:mode==="create"?"Google Play inceleme hesabı hazır":"İnceleme hesabının şifresi yenilendi",
        description:"Şifre yalnızca bu pencerede gösterilir. Play Console'a kaydedin."});
    }catch(e){
      toast({title:"Hesap oluşturulamadı",
        description:e instanceof Error?e.message:"Yeniden deneyin.",variant:"destructive"});
    }finally{setBusy(false);}
  }
  const copy=async(value:string)=>{
    try{
      await navigator.clipboard.writeText(value);
      toast({title:"Panoya kopyalandı"});
    }catch{
      toast({title:"Kopyalanamadı; metni elle seçip kopyalayın.",variant:"destructive"});
    }
  };
  return (
    <>
      <Card className="max-w-3xl">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><KeyRound className="h-5 w-5"/>
            Çalışkan B2B — Google Play İnceleme Hesabı
          </CardTitle>
          <CardDescription>
            Google Play Console için Apple inceleme hesabından ayrı bir B2B müşteri hesabı oluşturun.
            Şifre otomatik ve güvenli oluşturulur; yalnızca bir kez görüntülenir.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border bg-muted/20 p-4 text-sm">
            <div className="text-xs text-muted-foreground">Hesap durumu</div>
            <div className="mt-1 font-semibold">{isLoading?"Kontrol ediliyor…":
              error?"Durum alınamadı":account?.exists?(account.active?"Etkin":"Pasif"):
              "Henüz oluşturulmadı"}</div>
            {account?.email?<div className="mt-2 break-all">{account.email}</div>:null}
          </div>
          {error?<p className="text-sm text-destructive">
            {error instanceof Error?error.message:"Süper yönetici yetkisiyle tekrar giriş yapın."}
          </p>:null}
          <div className="flex flex-wrap gap-2">
            <Button disabled={busy||isLoading||!!error||!account||account.exists}
              onClick={()=>setCreateOpen(true)}>
              Yeni İnceleme Hesabı Ekle
            </Button>
            <Button variant="outline" disabled={busy||isLoading||!!error||!account?.exists}
              onClick={()=>void run("reset")}>
              Şifreyi Yenile
            </Button>
          </div>
          <p className="text-xs leading-relaxed text-muted-foreground">
            Bu bir giriş kimliğidir; e-posta kutusu oluşturulmaz. WhatsApp/SMS doğrulaması
            gerektirmeyen ayrı bir onaylı test müşteri hesabı oluşturulur. Gerçek firma
            bilgilerini veya yönetici yetkilerini kullanmayın.
          </p>
        </CardContent>
      </Card>
      <Dialog open={createOpen} onOpenChange={open=>{if(!open&&!busy)setCreateOpen(false);}}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Google Play inceleme hesabı oluştur</DialogTitle>
            <DialogDescription>
              Google inceleme ekibinin uygulamaya giriş yaparken kullanacağı e-posta kimliğini girin.
              Şifreyi sistem üretecek.
            </DialogDescription>
          </DialogHeader>
          <label className="space-y-2 text-sm font-medium">
            <span>İnceleme giriş e-postası</span>
            <Input type="email" value={newEmail} autoComplete="off"
              onChange={event=>setNewEmail(event.target.value)} maxLength={254}/>
          </label>
          <Button disabled={busy||!newEmail.includes("@")} onClick={()=>void run("create")}>
            {busy?"Oluşturuluyor…":"Hesabı Oluştur ve Şifreyi Göster"}
          </Button>
        </DialogContent>
      </Dialog>
      <Dialog open={Boolean(credentials)} onOpenChange={open=>{if(!open){setCredentials(null);setRevealPassword(false);}}}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Google Play inceleme bilgileri hazır</DialogTitle>
            <DialogDescription>
              Bu bilgiler yalnızca bu pencerede görünür. Pencereyi kapatmadan önce
              Play Console → Oturum Açma Bilgileri bölümüne kaydedin.
            </DialogDescription>
          </DialogHeader>
          {credentials?<div className="space-y-3">
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">E-posta / kullanıcı adı</div>
              <div className="flex items-center justify-between gap-2">
                <code className="break-all text-sm">{credentials.email}</code>
                <Button size="sm" variant="outline" onClick={()=>void copy(credentials.email)}>Kopyala</Button>
              </div>
            </div>
            <div className="rounded-lg border p-3">
              <div className="text-xs text-muted-foreground">Şifre</div>
              <div className="flex items-center justify-between gap-2">
                <code className="break-all text-sm">
                  {revealPassword?credentials.password:"••••••••••••••••"}
                </code>
                <div className="flex gap-1">
                  <Button size="sm" variant="outline" onClick={()=>setRevealPassword(v=>!v)}>
                    {revealPassword?"Gizle":"Göster"}
                  </Button>
                  <Button size="sm" variant="outline" onClick={()=>void copy(credentials.password)}>Kopyala</Button>
                </div>
              </div>
            </div>
            <div className="rounded-lg border p-3 space-y-2">
              <div className="text-sm font-semibold">Google Play inceleme talimatları (İngilizce)</div>
              <p className="text-xs text-muted-foreground">
                Erişim için gereken diğer bilgiler alanına yapıştırın.
              </p>
              <Button variant="outline" onClick={()=>void copy(instructions(credentials.email,credentials.password))}>
                <Copy className="mr-2 h-4 w-4"/> E-posta, Şifre ve Talimatları Kopyala
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Bu şifreyi sohbete göndermeyin. Google Play Console dışında paylaşmayın.
            </p>
          </div>:null}
        </DialogContent>
      </Dialog>
    </>
  );
}

type ReviewAccountStatus = {
  exists: boolean;
  email: string | null;
  active: boolean;
};

type ReviewAccountsStatus = {
  b2b: ReviewAccountStatus;
  business: ReviewAccountStatus;
};

type ReviewerApp = "b2b" | "business";

const reviewConfig: Record<ReviewerApp, {
  title: string;
  description: string;
  defaultEmail: string;
  endpoint: string;
}> = {
  b2b: {
    title: "Çalışkan B2B",
    description: "Apple incelemesi için yetkisiz, firma onayı gerektirmeyen B2B müşteri hesabı.",
    defaultEmail: "caliskanb2b.review@gmail.com",
    endpoint: "/api/admin/b2b-review-account",
  },
  business: {
    title: "Çalışkan Business",
    description: "Business uygulaması için ayrı, gerçek işletme verilerine erişmeyen sınırlı inceleme hesabı.",
    defaultEmail: "caliskanbusiness.review@gmail.com",
    endpoint: "/api/admin/business-review-account",
  },
};

function AppleReviewAccountSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [busyApp, setBusyApp] = useState<ReviewerApp | null>(null);
  const [createApp, setCreateApp] = useState<ReviewerApp | null>(null);
  const [emails, setEmails] = useState<Record<ReviewerApp, string>>({
    b2b: reviewConfig.b2b.defaultEmail,
    business: reviewConfig.business.defaultEmail,
  });
  const [credentials, setCredentials] = useState<{
    app: ReviewerApp;
    email: string;
    password: string;
  } | null>(null);

  const { data: accounts, isLoading, error } = useQuery<ReviewAccountsStatus>({
    queryKey: ["/api/admin/apple-review-accounts"],
    retry: false,
    queryFn: async () => {
      const response = await fetch("/api/admin/apple-review-accounts", {
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "İnceleme hesapları alınamadı.");
      return payload as ReviewAccountsStatus;
    },
  });

  async function reviewAction(app: ReviewerApp, mode: "create" | "reset") {
    const status = accounts?.[app];
    const email = mode === "reset"
      ? status?.email?.trim().toLowerCase() || ""
      : emails[app].trim().toLowerCase();
    if (!/^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/.test(email) || email.length > 254) {
      toast({ title: "Geçerli bir e-posta girin", variant: "destructive" });
      return;
    }
    if (mode === "create" && (status?.exists || !accounts)) {
      toast({ title: "Önce hesap durumunu kontrol edin", variant: "destructive" });
      return;
    }
    if (mode === "reset" && (!status?.exists ||
      !window.confirm(reviewConfig[app].title + " inceleme hesabının eski şifresi geçersiz olacak. Devam edilsin mi?"))) return;

    setBusyApp(app);
    try {
      const response = await fetch(reviewConfig[app].endpoint + (mode === "reset" ? "/reset-password" : ""), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
        cache: "no-store",
      });
      const result = await response.json().catch(() => ({})) as {
        email?: string; password?: string; error?: string;
      };
      if (!response.ok || !result.email || !result.password) {
        throw new Error(result.error || "İnceleme hesabı işlemi tamamlanamadı.");
      }
      setCredentials({ app, email: result.email, password: result.password });
      setCreateApp(null);
      await queryClient.invalidateQueries({ queryKey: ["/api/admin/apple-review-accounts"] });
      toast({
        title: mode === "create" ? "İnceleme hesabı oluşturuldu" : "İnceleme şifresi yenilendi",
        description: "Şifre yalnızca bu pencerede görünür. App Store Connect'e kaydedin.",
      });
    } catch (error) {
      toast({
        title: "İşlem başarısız",
        description: error instanceof Error ? error.message : "Lütfen tekrar deneyin.",
        variant: "destructive",
      });
    } finally {
      setBusyApp(null);
    }
  }

  return (
    <>
      <div className="grid gap-4 lg:grid-cols-2">
        {(["b2b", "business"] as const).map((app) => {
          const config = reviewConfig[app];
          const status = accounts?.[app];
          return (
            <Card key={app} className="h-full">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2">
                  <KeyRound className="h-5 w-5" />
                  {config.title} – Apple İnceleme Hesabı
                </CardTitle>
                <CardDescription>{config.description}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="rounded-lg border bg-muted/20 p-3 text-sm">
                  <div className="mb-1 text-xs text-muted-foreground">Hesap durumu</div>
                  <div className="font-medium">
                    {isLoading ? "Kontrol ediliyor…" : error ? "Durum alınamadı" :
                      status?.exists ? (status.active ? "Etkin" : "Pasif") : "Henüz oluşturulmadı"}
                  </div>
                  {status?.email ? <div className="mt-1 break-all text-muted-foreground">{status.email}</div> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button variant="outline"
                    disabled={!status?.exists || !!busyApp || !!error}
                    onClick={() => void reviewAction(app, "reset")}>
                    {busyApp === app ? "İşleniyor…" : "Şifreyi Yenile"}
                  </Button>
                  <Button disabled={!!busyApp || !!error || !accounts || !!status?.exists}
                    onClick={() => setCreateApp(app)}>
                    İnceleme Hesabı Oluştur
                  </Button>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {app === "business"
                    ? "Bu hesap yalnızca Çalışkan Business uygulamasındaki örnek verili, salt-okunur inceleme ekranını açar. Yönetici yetkisi veya canlı müşteri verisi verilmez."
                    : "Bu hesap yalnızca B2B müşteri erişimi sağlar; yönetici yetkisi verilmez."}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Dialog open={createApp !== null} onOpenChange={(open) => { if (!open) setCreateApp(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{createApp ? reviewConfig[createApp].title : ""} inceleme hesabı oluştur</DialogTitle>
            <DialogDescription>Apple için ayrı bir e-posta kullanın. Mevcut müşteri veya yönetici hesapları değiştirilmez.</DialogDescription>
          </DialogHeader>
          {createApp ? (
            <>
              <label className="space-y-2 text-sm font-medium">
                <span>İnceleme hesabı e-posta adresi</span>
                <Input type="email" autoComplete="off"
                  value={emails[createApp]}
                  onChange={(event) => setEmails((prev) => ({ ...prev, [createApp]: event.target.value }))}
                />
              </label>
              <Button disabled={!!busyApp || !emails[createApp].includes("@")}
                onClick={() => void reviewAction(createApp, "create")}>
                {busyApp ? "Oluşturuluyor…" : "Hesabı Oluştur"}
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(credentials)} onOpenChange={(open) => { if (!open) setCredentials(null); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{credentials ? reviewConfig[credentials.app].title : ""} – İnceleme hesabı hazır</DialogTitle>
            <DialogDescription>
              App Store Connect → App Review Information bölümüne kaydedin. Şifre bu pencere kapatıldıktan sonra tekrar gösterilemez.
            </DialogDescription>
          </DialogHeader>
          {credentials ? (
            <div className="space-y-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">E-posta</div>
                <code className="break-all">{credentials.email}</code>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">Şifre</div>
                <code className="break-all">{credentials.password}</code>
              </div>
              <Button onClick={() => {
                void navigator.clipboard.writeText("Username: " + credentials.email + "\nPassword: " + credentials.password)
                  .then(() => toast({ title: "Giriş bilgileri kopyalandı" }))
                  .catch(() => toast({ title: "Kopyalama başarısız", variant: "destructive" }));
              }}>
                <Copy className="mr-2 h-4 w-4" /> Apple Giriş Bilgilerini Kopyala
              </Button>
              <p className="text-xs text-muted-foreground">
                Bu bilgileri yalnızca Apple inceleme ekibiyle App Store Connect üzerinden paylaşın.
              </p>
            </div>
          ) : null}
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
  darkPreview = false,
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
  darkPreview?: boolean;
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
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border ${darkPreview ? "bg-[#141416]" : "bg-background"} ${portrait ? "h-44 w-24" : square ? "h-20 w-20" : darkPreview ? "h-20 w-36" : "h-20 w-28"}`}>
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
