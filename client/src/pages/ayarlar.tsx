import { Settings as SettingsIcon, Bell, Database, Download, ScanLine, Image as ImageIcon, Upload, Smartphone } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";

type AppKey = "b2b" | "business";
type ImageKind = "logo" | "splash";
type Branding = Record<AppKey, Record<ImageKind, string | null>>;

const EMPTY_BRANDING: Branding = {
  b2b: { logo: null, splash: null },
  business: { logo: null, splash: null },
};

export default function Ayarlar() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState(true);
  const [autoBackup, setAutoBackup] = useState(false);
  const [branding, setBranding] = useState<Branding>(EMPTY_BRANDING);
  const [uploading, setUploading] = useState<string | null>(null);

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadBranding = async () => {
    try {
      const headers = await authHeaders();
      const response = await fetch("/api/admin/app-branding", { headers });
      if (!response.ok) return;
      setBranding(await response.json());
    } catch {
      // Branding is optional; settings page remains usable if storage is unavailable.
    }
  };

  useEffect(() => { void loadBranding(); }, []);

  const uploadImage = async (app: AppKey, kind: ImageKind, file?: File) => {
    if (!file) return;
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      toast({ title: "Geçersiz dosya", description: "PNG, JPG veya WEBP yükleyin.", variant: "destructive" });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast({ title: "Dosya çok büyük", description: "Görsel en fazla 5 MB olabilir.", variant: "destructive" });
      return;
    }

    const key = `${app}-${kind}`;
    setUploading(key);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const headers = await authHeaders();
      const response = await fetch("/api/admin/app-branding", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...headers },
        body: JSON.stringify({ app, kind, dataUrl }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Görsel yüklenemedi");
      setBranding((current) => ({
        ...current,
        [app]: { ...current[app], [kind]: payload.url },
      }));
      toast({ title: "Kaydedildi", description: kind === "logo" ? "Uygulama logosu güncellendi." : "Splash ekranı güncellendi." });
    } catch (error) {
      toast({ title: "Yükleme başarısız", description: error instanceof Error ? error.message : "Tekrar deneyin.", variant: "destructive" });
    } finally {
      setUploading(null);
    }
  };

  const BrandingCard = ({ app, title, description }: { app: AppKey; title: string; description: string }) => (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Smartphone className="h-5 w-5 text-primary" />
          <CardTitle>{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-5 md:grid-cols-2">
        {(["logo", "splash"] as ImageKind[]).map((kind) => {
          const label = kind === "logo" ? "Uygulama Logosu" : "Splash Ekranı";
          const key = `${app}-${kind}`;
          return (
            <div key={kind} className="rounded-xl border p-4 space-y-3">
              <div className="flex items-center gap-2 font-medium"><ImageIcon className="h-4 w-4" />{label}</div>
              <div className={`flex items-center justify-center overflow-hidden rounded-lg bg-muted ${kind === "logo" ? "h-36" : "h-56"}`}>
                {branding[app][kind] ? (
                  <img src={branding[app][kind] ?? undefined} alt={label} className="h-full w-full object-contain" />
                ) : (
                  <span className="text-sm text-muted-foreground">Henüz görsel eklenmedi</span>
                )}
              </div>
              <Label className="block">
                <input className="hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => void uploadImage(app, kind, e.target.files?.[0])} />
                <Button type="button" variant="outline" className="w-full pointer-events-none" disabled={uploading === key}>
                  <Upload className="h-4 w-4 mr-2" />{uploading === key ? "Yükleniyor…" : "Görsel Yükle / Değiştir"}
                </Button>
              </Label>
              <p className="text-xs text-muted-foreground">PNG, JPG veya WEBP · Maksimum 5 MB</p>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <h1 className="text-2xl font-bold">Ayarlar</h1>
        <p className="text-sm text-muted-foreground mt-1">Sistem ve mobil uygulama ayarlarını yönetin</p>
      </div>

      <main className="flex-1 overflow-auto p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <BrandingCard app="b2b" title="Çalışkan B2B" description="Müşteri uygulamasının logo ve açılış ekranını yönetin." />
          <BrandingCard app="business" title="Çalışkan Business" description="Yönetici uygulamasının logo ve açılış ekranını yönetin." />

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><ScanLine className="h-5 w-5 text-primary" /><CardTitle>Barkod & Etiket</CardTitle></div>
              <CardDescription>NIIMBOT D110-M Code 128 etiket yazdırma (40×12 mm)</CardDescription>
            </CardHeader>
            <CardContent><Button variant="outline" onClick={() => navigate("/ayarlar/barkod")}>Barkod & Etiket Ayarları</Button></CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Bell className="h-5 w-5 text-primary" /><CardTitle>Bildirimler</CardTitle></div>
              <CardDescription>Bildirim tercihlerinizi yönetin</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Label htmlFor="notifications" className="cursor-pointer">Yeni kayıt bildirimleri</Label>
                <Switch id="notifications" checked={notifications} onCheckedChange={setNotifications} data-testid="switch-notifications" />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><Database className="h-5 w-5 text-primary" /><CardTitle>Veri Yönetimi</CardTitle></div>
              <CardDescription>Veritabanı ve yedekleme ayarları</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label htmlFor="auto-backup" className="cursor-pointer">Otomatik yedekleme</Label>
                <Switch id="auto-backup" checked={autoBackup} onCheckedChange={setAutoBackup} data-testid="switch-auto-backup" />
              </div>
              <div className="pt-4 border-t"><Button variant="outline" className="w-full"><Download className="h-4 w-4 mr-2" />Veritabanını Dışa Aktar</Button></div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center gap-2"><SettingsIcon className="h-5 w-5 text-primary" /><CardTitle>Uygulama Bilgisi</CardTitle></div>
              <CardDescription>Sistem ve uygulama detayları</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between"><span className="text-muted-foreground">Versiyon:</span><span className="font-medium">1.0.0</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Platform:</span><span className="font-medium">Web & PWA</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">Son Güncelleme:</span><span className="font-medium">{new Date().toLocaleDateString("tr-TR")}</span></div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
