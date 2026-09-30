import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Bell,
  Database,
  FileImage,
  Image as ImageIcon,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import type { BrandingConfig } from "@/hooks/use-branding";

async function fetchBranding(): Promise<BrandingConfig> {
  const response = await fetch("/api/admin/branding", { credentials: "include" });
  if (!response.ok) throw new Error("Marka ayarları alınamadı");
  return response.json();
}

export default function Ayarlar() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState(true);
  const [autoBackup, setAutoBackup] = useState(false);
  const [draft, setDraft] = useState<BrandingConfig>({});
  const [saving, setSaving] = useState(false);

  const { data: branding = {}, isLoading } = useQuery<BrandingConfig>({
    queryKey: ["/api/admin/branding"],
    queryFn: fetchBranding,
  });

  const values = useMemo(() => ({ ...branding, ...draft }), [branding, draft]);

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

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-[1400px] space-y-6 p-4 md:p-6 xl:p-8">
        <div>
          <h1 className="text-3xl font-black tracking-tight">Ayarlar</h1>
          <p className="mt-2 text-muted-foreground">
            Yönetim paneli, web sitesi ve mobil uygulama marka varlıklarını tek merkezden yönetin.
          </p>
        </div>

        <Tabs defaultValue="branding" className="space-y-5">
          <TabsList className="h-auto flex-wrap justify-start">
            <TabsTrigger value="branding">Marka & Görseller</TabsTrigger>
            <TabsTrigger value="system">Sistem</TabsTrigger>
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

            <div className="grid gap-6 xl:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Smartphone className="h-5 w-5" />
                    Çalışkan B2B Mobile
                  </CardTitle>
                  <CardDescription>Mobil B2B uygulamasının logo ve splash varlıkları.</CardDescription>
                </CardHeader>
                <CardContent className="grid gap-4 sm:grid-cols-2">
                  <AssetUploader
                    title="Uygulama Logosu"
                    description="Mobil marka ikonu."
                    value={values.b2b_mobile_logo}
                    onChange={(value) => setAsset("b2b_mobile_logo", value)}
                    square
                  />
                  <AssetUploader
                    title="Splash Ekranı"
                    description="Uygulama açılış görseli."
                    value={values.b2b_mobile_splash}
                    onChange={(value) => setAsset("b2b_mobile_splash", value)}
                  />
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
              Native iOS/Android uygulama ikonu veya işletim sistemi açılış ekranındaki değişikliklerin App Store/TestFlight buildine
              yansıması için yeni mobil build gerekir.
            </div>

            <div className="sticky bottom-4 flex justify-end">
              <Button size="lg" onClick={saveBranding} disabled={saving || isLoading || Object.keys(draft).length === 0}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Kaydediliyor…" : "Görsel Ayarlarını Kaydet"}
              </Button>
            </div>
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

function AssetUploader({
  title,
  description,
  value,
  onChange,
  square = false,
}: {
  title: string;
  description: string;
  value?: string | null;
  onChange: (value: string | null) => void;
  square?: boolean;
}) {
  async function handleFile(file?: File) {
    if (!file) return;
    if (!file.type.startsWith("image/")) return;
    if (file.size > 7_000_000) return;

    const reader = new FileReader();
    reader.onload = () => onChange(String(reader.result || ""));
    reader.readAsDataURL(file);
  }

  return (
    <div className="rounded-2xl border bg-muted/20 p-4">
      <div className="flex items-start gap-4">
        <div className={`flex shrink-0 items-center justify-center overflow-hidden rounded-xl border bg-background ${square ? "h-20 w-20" : "h-20 w-28"}`}>
          {value ? (
            <img src={value} alt={title} className="h-full w-full object-contain p-2" />
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
                  accept="image/png,image/jpeg,image/webp,image/svg+xml"
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
