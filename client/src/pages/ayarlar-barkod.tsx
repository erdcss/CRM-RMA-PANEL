import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  DEFAULT_BARCODE_SETTINGS,
  loadBarcodeSettings,
  saveBarcodeSettings,
  type BarcodeSettings,
} from "@/lib/barcodeSettings";
import { generatePackageLabelPDF } from "@/lib/package-label-export";

const SAMPLE = {
  packageNumber: "RMA-KOLI-2026-000001",
  supplierAccountCode: "111119",
  supplierName: "Örnek Tedarikçi",
  status: "kapatildi",
  barcodeValue: "RMA-111119-S3-P42-DEMO1234",
  qrValue: "RMA-111119-S3-P42-DEMO1234",
  createdAt: new Date().toISOString(),
  closedAt: new Date().toISOString(),
  productCount: 2,
  totalQuantity: 3,
  items: [
    {
      quantity: 1,
      product: { name: "Örnek Ürün A", stockCode: "STK-001", ticket: { receiptNumber: "FIS-001" } },
    },
    {
      quantity: 2,
      product: { name: "Örnek Ürün B", stockCode: "STK-002" },
    },
  ],
};

export default function AyarlarBarkod() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [draft, setDraft] = useState<BarcodeSettings>(DEFAULT_BARCODE_SETTINGS);
  const [previewing, setPreviewing] = useState(false);

  useEffect(() => {
    setDraft(loadBarcodeSettings());
  }, []);

  const update = (key: keyof BarcodeSettings, value: string) => {
    const num = Number(value.replace(",", "."));
    if (!Number.isFinite(num)) return;
    setDraft((prev) => ({ ...prev, [key]: num }));
  };

  const save = () => {
    saveBarcodeSettings(draft);
    toast({ title: "Kaydedildi", description: "Barkod etiket ayarları güncellendi." });
  };

  const preview = async () => {
    setPreviewing(true);
    try {
      saveBarcodeSettings(draft);
      await generatePackageLabelPDF(SAMPLE);
    } catch (err) {
      toast({ title: "Önizleme başarısız", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setPreviewing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate("/ayarlar")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>
        <div>
          <h1 className="text-xl font-bold">Barkod Ayarları</h1>
          <p className="text-sm text-muted-foreground">Etiket boyutu ve yazdırma</p>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6 max-w-xl mx-auto w-full space-y-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Etiket Boyutları (mm)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Field label="Etiket Genişliği" value={draft.labelWidthMm} onChange={(v) => update("labelWidthMm", v)} />
            <Field label="Etiket Yüksekliği" value={draft.labelHeightMm} onChange={(v) => update("labelHeightMm", v)} />
            <Field label="QR Kod Boyutu (mm)" value={draft.qrSizeMm} onChange={(v) => update("qrSizeMm", v)} />
            <Field label="Barkod Yazı Boyutu (pt)" value={draft.barcodeFontPt} onChange={(v) => update("barcodeFontPt", v)} />
          </CardContent>
        </Card>

        <p className="text-xs text-muted-foreground">
          Ayarlar koli etiketi PDF indirirken uygulanır.
        </p>

        <Button variant="outline" className="w-full" onClick={preview} disabled={previewing}>
          <Printer className="h-4 w-4 mr-2" />
          {previewing ? "Hazırlanıyor…" : "Örnek Etiket PDF"}
        </Button>
        <Button className="w-full" onClick={save}>Ayarları Kaydet</Button>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input type="number" value={String(value)} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}
