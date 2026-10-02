import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CreditCard, Landmark, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

type PaymentSettings = {
  iyzicoConfigured?: boolean;
  iyzico: {
    enabled: boolean;
    configured: boolean;
    apiKeyPreview: string;
    baseUrl: string;
  };
  bankTransfer: {
    enabled: boolean;
    bankName: string;
    accountHolder: string;
    iban: string;
  };
};

async function loadSettings(): Promise<PaymentSettings> {
  const response = await fetch("/api/admin/payment-settings", { credentials: "include" });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || "Ödeme ayarları alınamadı");
  return payload;
}

export default function AdminPaymentSettingsPage() {
  const { toast } = useToast();
  const { data } = useQuery<PaymentSettings>({
    queryKey: ["/api/admin/payment-settings"],
    queryFn: loadSettings,
  });

  const [saving, setSaving] = useState(false);
  const [iyzicoEnabled, setIyzicoEnabled] = useState(true);
  const [iyzicoApiKey, setIyzicoApiKey] = useState("");
  const [iyzicoPrivateKey, setIyzicoPrivateKey] = useState("");
  const [baseUrl, setBaseUrl] = useState("https://api.iyzipay.com");
  const [bankEnabled, setBankEnabled] = useState(false);
  const [bankName, setBankName] = useState("");
  const [accountHolder, setAccountHolder] = useState("");
  const [iban, setIban] = useState("");

  useEffect(() => {
    if (!data) return;
    setIyzicoEnabled(data.iyzico.enabled);
    setBaseUrl(data.iyzico.baseUrl || "https://api.iyzipay.com");
    setBankEnabled(data.bankTransfer.enabled);
    setBankName(data.bankTransfer.bankName || "");
    setAccountHolder(data.bankTransfer.accountHolder || "");
    setIban(data.bankTransfer.iban || "");
  }, [data]);

  async function save() {
    setSaving(true);
    try {
      const response = await fetch("/api/admin/payment-settings", {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          iyzico: {
            enabled: iyzicoEnabled,
            apiKey: iyzicoApiKey,
            secretKey: iyzicoPrivateKey,
            baseUrl,
          },
          bankTransfer: {
            enabled: bankEnabled,
            bankName,
            accountHolder,
            iban,
          },
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(payload.error || "Ödeme ayarları kaydedilemedi");

      setIyzicoApiKey("");
      setIyzicoPrivateKey("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/payment-settings"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/public/payment-settings"] }),
      ]);
      toast({ title: "Ödeme ayarları kaydedildi" });
    } catch (error) {
      toast({
        title: "Kaydetme başarısız",
        description: error instanceof Error ? error.message : "Bir hata oluştu",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black">Ödeme Ekranı</h1>
            <p className="mt-1 text-sm text-muted-foreground">B2B ödeme seçeneklerini buradan yönetin.</p>
          </div>
          <Button onClick={save} disabled={saving}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Kaydediliyor…" : "Kaydet"}
          </Button>
        </div>

        <div className="grid gap-5">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2"><CreditCard className="h-5 w-5" />Kredi Kartı Ödeme Sistemi</CardTitle>
                  <CardDescription>Canlı iyzico bağlantı bilgileri.</CardDescription>
                </div>
                <Switch checked={iyzicoEnabled} onCheckedChange={setIyzicoEnabled} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-muted/20 p-3 text-sm">
                Durum: <b>{data?.iyzico.configured ? "Canlı bilgiler kayıtlı" : "Bağlantı bilgisi bekleniyor"}</b>
                {data?.iyzico.apiKeyPreview ? <span className="ml-2 text-muted-foreground">{data.iyzico.apiKeyPreview}</span> : null}
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Canlı API Key</Label>
                  <Input value={iyzicoApiKey} onChange={(e) => setIyzicoApiKey(e.target.value)} placeholder="Yeni API Key" autoComplete="off" />
                </div>
                <div className="space-y-2">
                  <Label>Canlı Gizli Anahtar</Label>
                  <Input type="password" value={iyzicoPrivateKey} onChange={(e) => setIyzicoPrivateKey(e.target.value)} placeholder="Yeni gizli anahtar" autoComplete="new-password" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Canlı API Adresi</Label>
                <Input value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />
              </div>
              <p className="text-xs text-muted-foreground">Alanları boş bırakırsanız kayıtlı anahtarlar korunur. Kart bilgileri sistemimizde saklanmaz.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4">
                <div>
                  <CardTitle className="flex items-center gap-2"><Landmark className="h-5 w-5" />Havale / EFT Sistemi</CardTitle>
                  <CardDescription>Müşterilerin ödeme ekranında göreceği banka bilgileri.</CardDescription>
                </div>
                <Switch checked={bankEnabled} onCheckedChange={setBankEnabled} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Banka Adı</Label>
                  <Input value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="Banka adı" />
                </div>
                <div className="space-y-2">
                  <Label>İsim Soyisim / Hesap Sahibi</Label>
                  <Input value={accountHolder} onChange={(e) => setAccountHolder(e.target.value)} placeholder="Hesap sahibi" />
                </div>
              </div>
              <div className="space-y-2">
                <Label>IBAN</Label>
                <Input className="font-mono" value={iban} onChange={(e) => setIban(e.target.value.toUpperCase())} placeholder="TR00 0000 0000 0000 0000 0000 00" />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
