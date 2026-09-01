import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { ArrowLeft, Camera, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { apiRequest } from "@/lib/queryClient";
import { playScanError, playScanSuccess } from "@/lib/scanFeedback";
import { BarcodeScannerModal } from "@/components/packages/BarcodeScannerModal";
import { useToast } from "@/hooks/use-toast";

export default function KoliTara() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [value, setValue] = useState("");
  const [scanOpen, setScanOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const lookupQuery = useQuery({
    queryKey: ["/api/rma/packages/lookup", value],
    enabled: false,
  });

  const handleScan = async (raw?: string) => {
    const q = (raw ?? value).trim();
    if (!q) return;
    setValue(q);
    try {
      const res = await apiRequest("GET", `/api/rma/packages/lookup?q=${encodeURIComponent(q)}`);
      const pkg = await res.json();
      playScanSuccess();
      navigate(`/koliler/${pkg.id}`);
    } catch {
      playScanError();
      toast({ title: "Koli bulunamadı", variant: "destructive" });
      inputRef.current?.select();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate("/koliler")}>
          <ArrowLeft className="h-4 w-4 mr-2" />Geri
        </Button>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <ScanLine className="h-5 w-5" />Barkod / Koli Tara
        </h1>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <Card className="max-w-xl mx-auto">
          <CardHeader>
            <CardTitle className="text-base">USB barkod okuyucu veya manuel giris</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Input
              ref={inputRef}
              autoFocus
              placeholder="Barkod, QR veya koli numarasi..."
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleScan();
                }
              }}
              className="font-mono"
            />
            <Button className="w-full" onClick={() => handleScan()} disabled={lookupQuery.isFetching}>
              Koli Ac
            </Button>
            <Button variant="outline" className="w-full" onClick={() => setScanOpen(true)}>
              <Camera className="h-4 w-4 mr-2" />
              Kamera ile Tara
            </Button>
            <p className="text-xs text-muted-foreground">
              USB barkod okuyucu klavye gibi calisir — okutunca Enter ile otomatik acilir.
            </p>
          </CardContent>
        </Card>
      </main>

      <BarcodeScannerModal
        open={scanOpen}
        title="Koli Barkodunu Tara"
        scanMode="lookup"
        onClose={() => setScanOpen(false)}
        onScanned={(code) => {
          setScanOpen(false);
          void handleScan(code);
        }}
        onScanRejected={(msg) => toast({ title: msg, variant: "destructive" })}
      />
    </div>
  );
}
