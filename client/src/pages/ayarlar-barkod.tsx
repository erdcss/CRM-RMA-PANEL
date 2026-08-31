import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { ArrowLeft, ChevronDown, Printer, RotateCcw, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { BarcodeLabel } from "@/components/barcode/BarcodeLabel";
import {
  DEFAULT_BARCODE_NUMBER,
  NIIMBOT_D110M_PRESET,
  PRINTER_PROFILES,
  clampBarcodeLabelSettings,
  estimateBarcodeFit,
  loadBarcodeLabelSettings,
  resetBarcodeLabelSettings,
  sanitizeBarcodeNumber,
  saveBarcodeLabelSettings,
  validateBarcodeNumber,
  type BarcodeLabelSettings,
} from "@/lib/barcodeSettings";
import { openBarcodePrintWindow, renderCode128Svg } from "@/lib/barcodeLabelRenderer";

const PREVIEW_SCALE = 10;
const ASPECT = NIIMBOT_D110M_PRESET.labelWidthMm / NIIMBOT_D110M_PRESET.labelHeightMm;

export default function AyarlarBarkod() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [settings, setSettings] = useState<BarcodeLabelSettings>(NIIMBOT_D110M_PRESET);
  const [barcodeNumber, setBarcodeNumber] = useState(DEFAULT_BARCODE_NUMBER);
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [printing, setPrinting] = useState(false);

  useEffect(() => {
    const loaded = loadBarcodeLabelSettings();
    setSettings(loaded);
  }, []);

  const cleaned = sanitizeBarcodeNumber(barcodeNumber);
  const validation = validateBarcodeNumber(cleaned);
  const fit = useMemo(
    () => estimateBarcodeFit(cleaned, settings.labelWidthMm, settings.marginLeftMm, settings.marginRightMm),
    [cleaned, settings.labelWidthMm, settings.marginLeftMm, settings.marginRightMm],
  );

  const patchSettings = useCallback((patch: Partial<BarcodeLabelSettings>) => {
    setSettings((prev) => clampBarcodeLabelSettings({ ...prev, ...patch }));
  }, []);

  const patchNumber = (key: keyof BarcodeLabelSettings, raw: string) => {
    const num = Number(raw.replace(",", "."));
    if (!Number.isFinite(num)) return;
    patchSettings({ [key]: num });
  };

  const handleBarcodeInput = (raw: string) => {
    const next = raw.replace(/[^\d]/g, "");
    setBarcodeNumber(next);
  };

  const persist = () => {
    saveBarcodeLabelSettings(settings);
    toast({ title: "Kaydedildi", description: "Barkod etiket ayarları güncellendi." });
  };

  const handleReset = () => {
    const defaults = resetBarcodeLabelSettings();
    setSettings(defaults);
    setBarcodeNumber(DEFAULT_BARCODE_NUMBER);
    toast({ title: "Varsayılana dönüldü" });
  };

  const handleTestBarcode = () => {
    setBarcodeNumber(DEFAULT_BARCODE_NUMBER);
    patchSettings(NIIMBOT_D110M_PRESET);
    toast({ title: "Test barkodu hazır", description: DEFAULT_BARCODE_NUMBER });
  };

  const handlePrint = async () => {
    if (!validation.valid) {
      toast({ title: validation.error, variant: "destructive" });
      return;
    }
    setPrinting(true);
    try {
      saveBarcodeLabelSettings(settings);
      const render = renderCode128Svg(cleaned, settings);
      if (!render.fits || !fit.fits) {
        toast({
          title: "Uyarı",
          description: fit.warning ?? "Barkod etiket genişliğine sığmayabilir.",
        });
      }
      openBarcodePrintWindow(cleaned, settings, render);
    } catch (err) {
      toast({
        title: "Yazdırma başarısız",
        description: err instanceof Error ? err.message : undefined,
        variant: "destructive",
      });
    } finally {
      setPrinting(false);
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
          <h1 className="text-xl font-bold">Barkod & Etiket Ayarları</h1>
          <p className="text-sm text-muted-foreground">NIIMBOT D110-M · Code 128 · 40×12 mm</p>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Yazıcı & Etiket</CardTitle>
                <CardDescription>Fiziksel etiket profili ve boyutları</CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-2">
                <FieldReadonly label="Yazıcı Profili" value={PRINTER_PROFILES["niimbot-d110m"].label} />
                <FieldReadonly label="Barkod Türü" value="Code 128" />
                <NumberField label="Etiket Genişliği (mm)" value={settings.labelWidthMm} min={10} max={100} onChange={(v) => patchNumber("labelWidthMm", v)} />
                <NumberField label="Etiket Yüksekliği (mm)" value={settings.labelHeightMm} min={8} max={100} onChange={(v) => patchNumber("labelHeightMm", v)} />
                <FieldReadonly label="Yön" value="Yatay" />
                <NumberField label="Baskı Adedi" value={settings.quantity} min={1} max={100} onChange={(v) => patchNumber("quantity", v)} />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Barkod</CardTitle>
                <CardDescription>Yalnızca rakamsal Code 128 değeri basılır</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="barcode-number">Barkod Numarası</Label>
                  <Input
                    id="barcode-number"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    value={barcodeNumber}
                    onChange={(e) => handleBarcodeInput(e.target.value)}
                    className="font-mono"
                    placeholder="8691234567890"
                  />
                  {!validation.valid ? (
                    <p className="text-xs text-destructive">{validation.error}</p>
                  ) : null}
                  {!fit.fits && fit.warning ? (
                    <p className="text-xs text-amber-600">{fit.warning}</p>
                  ) : null}
                </div>

                <div className="flex items-center justify-between rounded-md border p-3">
                  <div>
                    <Label htmlFor="human-readable">Alt Numara Göster</Label>
                    <p className="text-xs text-muted-foreground">Barkodun altında aynı rakamlar</p>
                  </div>
                  <Switch
                    id="human-readable"
                    checked={settings.showHumanReadable}
                    onCheckedChange={(checked) => patchSettings({ showHumanReadable: checked })}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <FieldReadonly
                    label="Barkod Yüksekliği"
                    value={settings.barcodeHeightMm > 0 ? `${settings.barcodeHeightMm} mm` : "Otomatik"}
                  />
                  <FieldReadonly
                    label="Alt Numara Boyutu"
                    value={settings.numberFontSizePt > 0 ? `${settings.numberFontSizePt} pt` : "Otomatik"}
                  />
                </div>
              </CardContent>
            </Card>

            <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
              <Card>
                <CardHeader className="pb-3">
                  <CollapsibleTrigger asChild>
                    <button type="button" className="flex w-full items-center justify-between text-left">
                      <div>
                        <CardTitle className="text-base">Gelişmiş Ayarlar</CardTitle>
                        <CardDescription>Kenar boşlukları, kalibrasyon ve ince ayar</CardDescription>
                      </div>
                      <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
                    </button>
                  </CollapsibleTrigger>
                </CardHeader>
                <CollapsibleContent>
                  <CardContent className="grid gap-4 sm:grid-cols-2 pt-0">
                    <NumberField label="Sol boşluk (mm)" value={settings.marginLeftMm} min={0} max={10} step={0.1} onChange={(v) => patchNumber("marginLeftMm", v)} />
                    <NumberField label="Sağ boşluk (mm)" value={settings.marginRightMm} min={0} max={10} step={0.1} onChange={(v) => patchNumber("marginRightMm", v)} />
                    <NumberField label="Üst boşluk (mm)" value={settings.marginTopMm} min={0} max={10} step={0.1} onChange={(v) => patchNumber("marginTopMm", v)} />
                    <NumberField label="Alt boşluk (mm)" value={settings.marginBottomMm} min={0} max={10} step={0.1} onChange={(v) => patchNumber("marginBottomMm", v)} />
                    <NumberField label="Barkod yüksekliği (mm, 0=oto)" value={settings.barcodeHeightMm} min={0} max={50} step={0.1} onChange={(v) => patchNumber("barcodeHeightMm", v)} />
                    <NumberField label="Alt sayı (pt, 0=oto)" value={settings.numberFontSizePt} min={0} max={24} step={0.5} onChange={(v) => patchNumber("numberFontSizePt", v)} />
                    <NumberField label="Barkod-numara aralığı (mm)" value={settings.barcodeNumberGapMm} min={0} max={5} step={0.1} onChange={(v) => patchNumber("barcodeNumberGapMm", v)} />
                    <NumberField label="Yatay ofset X (mm)" value={settings.offsetXmm} min={-5} max={5} step={0.1} onChange={(v) => patchNumber("offsetXmm", v)} />
                    <NumberField label="Dikey ofset Y (mm)" value={settings.offsetYmm} min={-5} max={5} step={0.1} onChange={(v) => patchNumber("offsetYmm", v)} />
                  </CardContent>
                </CollapsibleContent>
              </Card>
            </Collapsible>

            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="flex-1" onClick={handleTestBarcode}>
                <ScanLine className="h-4 w-4 mr-2" />
                Test Barkodu Oluştur
              </Button>
              <Button className="flex-1" onClick={handlePrint} disabled={printing || !validation.valid}>
                <Printer className="h-4 w-4 mr-2" />
                {printing ? "Hazırlanıyor…" : "Yazdır"}
              </Button>
              <Button variant="secondary" className="flex-1" onClick={handleReset}>
                <RotateCcw className="h-4 w-4 mr-2" />
                Varsayılana Dön
              </Button>
            </div>
            <Button variant="ghost" className="w-full" onClick={persist}>
              Ayarları Kaydet
            </Button>
          </div>

          <div className="space-y-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Baskı Önizleme</CardTitle>
                <CardDescription>
                  Oran {NIIMBOT_D110M_PRESET.labelWidthMm}:{NIIMBOT_D110M_PRESET.labelHeightMm} (
                  {ASPECT.toFixed(2)}:1)
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-col items-center gap-4">
                {validation.valid ? (
                  <BarcodeLabel value={cleaned} settings={settings} previewScale={PREVIEW_SCALE} />
                ) : (
                  <div className="text-sm text-muted-foreground py-8">Geçerli barkod numarası girin</div>
                )}
                <dl className="w-full text-xs text-muted-foreground space-y-1 border-t pt-3">
                  <div className="flex justify-between">
                    <dt>Etiket</dt>
                    <dd>{settings.labelWidthMm} × {settings.labelHeightMm} mm</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Barkod</dt>
                    <dd>Code 128</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Yazıcı</dt>
                    <dd>NIIMBOT D110-M</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Adet</dt>
                    <dd>{settings.quantity}</dd>
                  </div>
                </dl>
                <p className="text-[11px] text-muted-foreground text-center">
                  Önizleme bilgileri yazdırılmaz. Çıktıda yalnızca barkod ve numara yer alır.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
}

function FieldReadonly({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input value={value} readOnly className="bg-muted/40" />
    </div>
  );
}

function NumberField({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  onChange: (value: string) => void;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={String(value)}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
