import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, CreditCard, Eye, EyeOff, RefreshCw, Save, ShieldCheck } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

type IyzicoAdminSettings = {
  iyzicoConfigured: boolean;
  iyzico: {
    enabled: boolean;
    configured: boolean;
    apiKeyPreview: string;
    baseUrl: string;
  };
};
type TestResult = { ok: boolean; message: string };
const LIVE = "https://api.iyzipay.com";
const SANDBOX = "https://sandbox-api.iyzipay.com";

async function fetchSettings(): Promise<IyzicoAdminSettings> {
  const response = await fetch("/api/admin/payment-settings", {
    credentials: "include",
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "iyzico ayarları okunamadı");
  return payload;
}

export function IyzicoAdminCredentials() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery<IyzicoAdminSettings>({
    queryKey: ["/api/admin/payment-settings"],
    queryFn: fetchSettings,
  });

  const [enabled, setEnabled] = useState(false);
  const [baseUrl, setBaseUrl] = useState(LIVE);
  const [apiKey, setApiKey] = useState("");
  const [secretKey, setSecretKey] = useState("");
  const [showSecret, setShowSecret] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [tested, setTested] = useState<TestResult | null>(null);

  useEffect(() => {
    if (!data?.iyzico) return;
    setEnabled(data.iyzico.enabled);
    setBaseUrl(data.iyzico.baseUrl === SANDBOX ? SANDBOX : LIVE);
    setTested(null);
  }, [data]);

  const hasDraft = Boolean(apiKey.trim() || secretKey.trim()) ||
    Boolean(data && (enabled !== data.iyzico.enabled || baseUrl !== data.iyzico.baseUrl));
  const configured = Boolean(data?.iyzico.configured);
  const active = Boolean(data?.iyzico.enabled && configured);
  const environment = baseUrl === SANDBOX ? "Test / Sandbox" : "Canlı / Production";

  async function saveCredentials() {
    if (Boolean(apiKey.trim()) !== Boolean(secretKey.trim())) {
      toast({ title: "İki anahtarı birlikte girin", description: "API Key ile Secret Key aynı iyzico hesabına ait olmalıdır.", variant: "destructive" });
      return;
    }
    if (enabled && !configured && (!apiKey.trim() || !secretKey.trim())) {
      toast({ title: "API anahtarları gerekli", description: "Ödemeyi etkinleştirmek için API Key ve Secret Key girin.", variant: "destructive" });
      return;
    }
    setSaving(true);
    setTested(null);
    try {
      const payload = {
        iyzico: {
          enabled,
          baseUrl,
          ...(apiKey.trim() && secretKey.trim() ? {
            apiKey: apiKey.trim(),
            secretKey: secretKey.trim(),
          } : {}),
        },
      };
      const response = await fetch("/api/admin/payment-settings", {
        method: "PUT",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "iyzico ayarları kaydedilemedi");

      setApiKey("");
      setSecretKey("");
      setShowSecret(false);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/public/payment-settings"] }),
      ]);
      toast({ title: "iyzico bilgileri kaydedildi", description: "Yeni anahtarlar şifreli olarak saklandı. Bağlantıyı Test Et ile erişimi doğrulayın." });
    } catch (error) {
      toast({ title: "Kaydetme başarısız", description: error instanceof Error ? error.message : "Ödeme ayarları güncellenemedi.", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function testConnection() {
    setTesting(true);
    setTested(null);
    try {
      const response = await fetch("/api/admin/payment-settings/iyzico/test", {
        method: "POST",
        credentials: "include",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      });
      const result = await response.json().catch(() => ({})) as Partial<TestResult>;
      const ok = Boolean(response.ok && result.ok);
      setTested({ ok, message: result.message || (ok ? "Bağlantı doğrulandı." : "Bağlantı doğrulanamadı.") });
      if (!ok) toast({ title: "iyzico test başarısız", description: result.message || "Anahtar ve ortam bilgilerini kontrol edin.", variant: "destructive" });
    } catch {
      setTested({ ok: false, message: "iyzico test servisine erişilemedi. İnternet bağlantısını kontrol edin." });
    } finally {
      setTesting(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" /> iyzico API ve Canlı Kart Ödemesi</CardTitle>
        <CardDescription>
          API Key ve Secret Key'i doğrudan bu panelden güncelleyin. Kart bilgileri Çalışkan sunucularında saklanmaz; ödeme iyzico Checkout Form üzerinden gerçekleştirilir.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div className="space-y-1">
            <p className="font-semibold">API anahtarlarının durumu</p>
            <p className="text-sm text-muted-foreground">{configured
              ? "Anahtarlar kayıtlı. Bu durum tek başına iyzico bağlantısının doğrulandığı anlamına gelmez."
              : "Henüz tam bir API Key / Secret Key çifti bulunmuyor."}</p>
            {data?.iyzico.apiKeyPreview ? <p className="text-xs text-muted-foreground">Kayıtlı API Key: <code>{data.iyzico.apiKeyPreview}</code></p> : null}
          </div>
          <span className={"inline-flex rounded-full px-3 py-1 text-sm font-semibold " +
            (active ? "bg-emerald-100 text-emerald-800" : configured ? "bg-amber-100 text-amber-900" : "bg-slate-100 text-slate-700")}>
            {active ? "Yapılandırıldı · Test bekliyor" : configured ? "Bağlantı kapalı" : "Anahtarlar eksik"}
          </span>
        </div>

        {isLoading ? <p className="text-sm text-muted-foreground">Ödeme ayarları yükleniyor…</p> : null}
        {isError ? <div role="alert" className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertTriangle className="h-4 w-4" /> Ayarlar okunamadı.
          <Button size="sm" variant="outline" onClick={() => void refetch()}>Tekrar dene</Button>
        </div> : null}

        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border p-4">
          <div><Label htmlFor="iyzico-active" className="font-semibold">Kartla ödemeyi etkinleştir</Label>
            <p className="mt-1 text-xs text-muted-foreground">Kapattığınızda yeni iyzico işlemleri başlatılamaz. Mevcut sipariş kayıtları silinmez.</p>
          </div>
          <Switch id="iyzico-active" checked={enabled} onCheckedChange={(v) => { setEnabled(v); setTested(null); }} disabled={isLoading || saving} />
        </div>

        <div className="space-y-2">
          <Label htmlFor="iyzico-environment">iyzico ortamı</Label>
          <select id="iyzico-environment" value={baseUrl} disabled={isLoading || saving}
            onChange={(event) => { setBaseUrl(event.target.value); setTested(null); }}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm">
            <option value={LIVE}>Canlı / Production — api.iyzipay.com</option>
            <option value={SANDBOX}>Test / Sandbox — sandbox-api.iyzipay.com</option>
          </select>
          <p className="text-xs text-muted-foreground">Seçili ortam: {environment}. Canlı anahtarları yalnızca canlı ortamda, test anahtarlarını yalnızca sandbox ortamında kullanın.</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="iyzico-api-key">iyzico API Key</Label>
            <Input id="iyzico-api-key" type="password" autoComplete="new-password" spellCheck={false}
              value={apiKey} onChange={event => { setApiKey(event.target.value); setTested(null); }}
              placeholder={configured ? "Değiştirmek için yeni API Key" : "API Key girin"} disabled={saving || isLoading} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="iyzico-secret-key">iyzico Secret Key</Label>
            <div className="relative">
              <Input id="iyzico-secret-key" type={showSecret ? "text" : "password"} autoComplete="new-password" spellCheck={false}
                value={secretKey} onChange={event => { setSecretKey(event.target.value); setTested(null); }}
                placeholder={configured ? "Değiştirmek için yeni Secret Key" : "Secret Key girin"}
                className="pr-12" disabled={saving || isLoading} />
              <Button type="button" variant="ghost" size="icon" title={showSecret ? "Anahtarı gizle" : "Anahtarı göster"}
                aria-label={showSecret ? "Secret Key gizle" : "Secret Key göster"}
                className="absolute right-1 top-1/2 h-8 w-8 -translate-y-1/2" onClick={() => setShowSecret(v => !v)} disabled={!secretKey}>
                {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        </div>
        <p className="text-xs leading-5 text-muted-foreground">
          Güvenlik için kayıtlı gizli anahtar tekrar gösterilmez. Alanları boş bırakırsanız mevcut anahtarlar korunur; yeni anahtar tanımlarken iki anahtarı birlikte girin. Panel üzerinden kaydetme, Railway'deki ortam değişkenlerini değiştirmez; geçerli ödeme yapılandırması güncellenir.
        </p>

        <div className="flex flex-wrap items-center justify-end gap-3">
          <Button variant="outline" onClick={() => void testConnection()} disabled={testing || saving || hasDraft || !active || isLoading || isError}>
            <RefreshCw className={"mr-2 h-4 w-4 " + (testing ? "animate-spin" : "")} />
            {testing ? "Bağlantı kontrol ediliyor…" : "Bağlantıyı Test Et"}
          </Button>
          <Button onClick={() => void saveCredentials()} disabled={saving || testing || isLoading || isError || !hasDraft}>
            <Save className="mr-2 h-4 w-4" />{saving ? "Kaydediliyor…" : "API Bilgilerini Kaydet"}
          </Button>
        </div>
        {hasDraft ? <p className="text-right text-xs text-amber-700">Değişiklikler henüz kaydedilmedi. Test için önce kaydedin.</p> : null}
        {tested ? <div role="status" className={"flex items-start gap-2 rounded-xl border p-3 text-sm " +
          (tested.ok ? "border-emerald-200 bg-emerald-50 text-emerald-900" : "border-red-200 bg-red-50 text-red-900")}>
          {tested.ok ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />}
          <span>{tested.message}</span>
        </div> : null}
        <p className="flex items-start gap-2 text-xs leading-5 text-muted-foreground">
          <ShieldCheck className="h-4 w-4 shrink-0" /> Bağlantı testi 1 TL'lik taksit/BIN sorgusudur; ödeme veya tahsilat oluşturmaz.
        </p>
      </CardContent>
    </Card>
  );
}
