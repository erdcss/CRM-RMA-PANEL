import { useCallback, useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation, useSearch } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  Lock,
  MinusCircle,
  PlusCircle,
  Printer,
  ScanLine,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { SupplierProductRow } from "@/components/suppliers/SupplierProductRow";
import { BarcodeScannerModal } from "@/components/packages/BarcodeScannerModal";
import { generatePackageLabelPDF } from "@/lib/package-label-export";
import { playScanError, playScanSuccess } from "@/lib/scanFeedback";
import { resolvePackageLabelSequence } from "@shared/package-label";

const EDITABLE = new Set(["hazirlaniyor", "taslak"]);

type SupplierItem = {
  id: number;
  productId: number;
  supplierAccountCode: string;
  supplierName: string;
  product: {
    id: number;
    name: string | null;
    stockCode?: string | null;
    serialNumber?: string | null;
    category: string;
    status: string;
    quantity?: number | null;
    ticket?: { customer?: { name?: string | null } };
  };
};

type PackageRow = {
  id: number;
  packageNumber: string;
  supplierAccountCode: string;
  supplierName: string;
  status: string;
  barcodeValue?: string | null;
  qrValue?: string | null;
  createdAt: string;
  closedAt?: string | null;
  verifiedAt?: string | null;
  items: Array<{ id: number; productId: number; quantity?: number | null }>;
  productCount?: number;
  totalQuantity?: number;
  labelSequence?: number | null;
  history?: Array<{ eventType?: string | null; metadata?: string | null }>;
};

function statusLabel(status: string) {
  const map: Record<string, string> = {
    hazirlaniyor: "Hazırlanıyor",
    kapatildi: "Kapatıldı · Doğrulama Bekliyor",
    sevke_hazir: "Sevkiyata Hazır",
    sevk_edildi: "Sevk Edildi",
  };
  return map[status] ?? status;
}

export default function TedarikciSevkiyat() {
  const [, navigate] = useLocation();
  const search = useSearch();
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const params = useParams<{ code: string }>();
  const code = decodeURIComponent(params.code || "");
  const supplierName = useMemo(() => {
    const params = new URLSearchParams(search);
    return params.get("name") ? decodeURIComponent(params.get("name")!) : "Tedarikçi";
  }, [search]);

  const [activePkg, setActivePkg] = useState<PackageRow | null>(null);
  const [closedPkg, setClosedPkg] = useState<PackageRow | null>(null);
  const [loadingPkg, setLoadingPkg] = useState(true);
  const [busyProductId, setBusyProductId] = useState<number | null>(null);
  const [scanOpen, setScanOpen] = useState(false);
  const [scanMatched, setScanMatched] = useState(false);

  const { data: items = [], isLoading } = useQuery<SupplierItem[]>({
    queryKey: ["/api/supplier-items"],
  });

  const supplierItems = useMemo(
    () => items.filter((row) => row.supplierAccountCode === code),
    [items, code],
  );

  const inBoxMap = useMemo(() => {
    const map = new Map<number, number>();
    for (const row of activePkg?.items ?? []) map.set(row.productId, row.id);
    return map;
  }, [activePkg]);

  const loadPackage = useCallback(async () => {
    setLoadingPkg(true);
    try {
      const res = await apiRequest("GET", `/api/rma/packages?supplier=${encodeURIComponent(code)}`);
      const all = (await res.json()) as PackageRow[];
      const sorted = [...all].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      );
      const open = sorted.find((row) => EDITABLE.has(row.status));
      const finished = sorted.find((row) => ["kapatildi", "sevke_hazir", "sevk_edildi"].includes(row.status));

      if (open?.id) {
        const detailRes = await apiRequest("GET", `/api/rma/packages/${open.id}`);
        setActivePkg(await detailRes.json());
      } else setActivePkg(null);

      if (finished?.id) {
        const detailRes = await apiRequest("GET", `/api/rma/packages/${finished.id}`);
        const detail = await detailRes.json();
        setClosedPkg(detail);
        setScanMatched(Boolean(detail.verifiedAt) || detail.status === "sevke_hazir");
      } else {
        setClosedPkg(null);
        setScanMatched(false);
      }
    } catch {
      setActivePkg(null);
      setClosedPkg(null);
    } finally {
      setLoadingPkg(false);
    }
  }, [code]);

  useEffect(() => {
    void loadPackage();
  }, [loadPackage]);

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/supplier-items"] });
    queryClient.invalidateQueries({ queryKey: ["/api/rma/packages"] });
    queryClient.invalidateQueries({ queryKey: ["/api/rma/prep-pool"] });
  };

  const addToBox = async (item: SupplierItem) => {
    setBusyProductId(item.productId);
    try {
      if (!activePkg) {
        const res = await apiRequest("POST", "/api/rma/packages", {
          supplierAccountCode: code,
          supplierName: item.supplierName,
          productIds: [item.productId],
        });
        setActivePkg(await res.json());
      } else {
        const res = await apiRequest("POST", `/api/rma/packages/${activePkg.id}/items`, {
          productIds: [item.productId],
        });
        setActivePkg(await res.json());
      }
      invalidate();
    } catch (err) {
      toast({ title: "Koliye eklenemedi", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusyProductId(null);
    }
  };

  const removeFromBox = async (productId: number) => {
    if (!activePkg) return;
    const itemId = inBoxMap.get(productId);
    if (!itemId) return;
    setBusyProductId(productId);
    try {
      const res = await apiRequest("DELETE", `/api/rma/packages/${activePkg.id}/items/${itemId}`);
      const updated = await res.json();
      setActivePkg(updated.items?.length ? updated : null);
      invalidate();
    } catch (err) {
      toast({ title: "Koliden çıkarılamadı", description: err instanceof Error ? err.message : undefined, variant: "destructive" });
    } finally {
      setBusyProductId(null);
    }
  };

  const closeMutation = useMutation({
    mutationFn: async () => {
      if (!activePkg) throw new Error("Aktif koli yok");
      return apiRequest("POST", `/api/rma/packages/${activePkg.id}/close`, {});
    },
    onSuccess: async (res) => {
      const updated = await res.json();
      setClosedPkg(updated);
      setActivePkg(null);
      setScanMatched(false);
      invalidate();
      toast({ title: "Koli kapatıldı", description: "Barkod atandı." });
    },
    onError: (err: Error) => toast({ title: "Hata", description: err.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: async (barcodeValue: string) =>
      apiRequest("POST", "/api/rma/packages/verify", { barcodeValue }),
    onSuccess: async (res) => {
      setClosedPkg(await res.json());
      invalidate();
      toast({ title: "Sevkiyata hazır" });
    },
    onError: (err: Error) => toast({ title: "Doğrulama başarısız", description: err.message, variant: "destructive" }),
  });

  const handleScan = (value: string) => {
    const expected = closedPkg?.barcodeValue || closedPkg?.qrValue;
    if (expected && value === expected) {
      playScanSuccess();
      setScanMatched(true);
      setScanOpen(false);
      toast({ title: "Barkod doğrulandı" });
    } else {
      playScanError();
      toast({ title: "Barkod eşleşmedi", variant: "destructive" });
    }
  };

  const handlePrint = () => {
    const labelPkg = closedPkg ?? activePkg;
    if (!labelPkg) return;
    void generatePackageLabelPDF({
      packageNumber: labelPkg.packageNumber,
      supplierName: labelPkg.supplierName,
      supplierAccountCode: labelPkg.supplierAccountCode,
      status: labelPkg.status,
      barcodeValue: labelPkg.barcodeValue,
      qrValue: labelPkg.qrValue,
      createdAt: labelPkg.createdAt,
      closedAt: labelPkg.closedAt,
      productCount: labelPkg.productCount,
      totalQuantity: labelPkg.totalQuantity,
      items: labelPkg.items,
      labelSequence: labelPkg.labelSequence,
      history: labelPkg.history,
    });
  };

  if (isLoading || loadingPkg) {
    return (
      <div className="p-6 space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  const boxCount = activePkg?.items?.length ?? 0;
  const labelSequence = resolvePackageLabelSequence({
    labelSequence: closedPkg?.labelSequence ?? activePkg?.labelSequence,
    barcodeValue: closedPkg?.barcodeValue || activePkg?.barcodeValue,
    history: closedPkg?.history ?? activePkg?.history,
  });
  const isClosed = closedPkg?.status === "kapatildi";
  const isReady = closedPkg?.status === "sevke_hazir";

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b flex items-center gap-3">
        <Button variant="ghost" onClick={() => navigate(`/tedarikci/${encodeURIComponent(code)}?name=${encodeURIComponent(supplierName)}`)}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Geri
        </Button>
        <div>
          <h1 className="text-xl font-bold">Ürünleri Sevk Et</h1>
          <p className="text-sm text-muted-foreground">{supplierName}</p>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6 space-y-4 max-w-4xl mx-auto w-full">
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {activePkg ? activePkg.packageNumber : closedPkg ? closedPkg.packageNumber : "Aktif koli yok"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p className="text-muted-foreground">
              {activePkg
                ? `${statusLabel(activePkg.status)} · ${boxCount} ürün kolide`
                : closedPkg
                  ? statusLabel(closedPkg.status)
                  : "Koliye eklediğinizde otomatik oluşturulur"}
            </p>
            {labelSequence ? <Badge>Koli sıra no: {labelSequence}/9</Badge> : null}
            {(closedPkg?.barcodeValue || activePkg?.barcodeValue) ? (
              <p className="font-mono text-xs break-all">{closedPkg?.barcodeValue || activePkg?.barcodeValue}</p>
            ) : null}
          </CardContent>
        </Card>

        <h2 className="font-semibold text-muted-foreground">Tedarikçi Ürünleri</h2>
        <div className="space-y-2">
          {supplierItems.map((item) => {
            const inBox = inBoxMap.has(item.productId);
            const busy = busyProductId === item.productId;
            return (
              <SupplierProductRow
                key={item.id}
                item={item}
                onOpen={() => navigate(`/tedarikci/urun/${item.id}`)}
                trailing={
                  <Button
                    variant="ghost"
                    className={`shrink-0 rounded-none border-l h-auto min-h-[72px] flex-col gap-1 px-3 ${
                      inBox ? "text-destructive bg-destructive/5" : "text-green-700 bg-green-50 dark:bg-green-950/20"
                    }`}
                    disabled={busy}
                    onClick={() => (inBox ? removeFromBox(item.productId) : addToBox(item))}
                  >
                    {inBox ? <MinusCircle className="h-4 w-4" /> : <PlusCircle className="h-4 w-4" />}
                    <span className="text-[10px] font-bold leading-tight text-center">
                      {busy ? "…" : inBox ? "Koliden\nÇıkar" : "Koliye\nEkle"}
                    </span>
                  </Button>
                }
              />
            );
          })}
        </div>

        {activePkg && boxCount > 0 ? (
          <Button className="w-full" onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
            <Lock className="h-4 w-4 mr-2" />
            {closeMutation.isPending ? "Kapatılıyor…" : "Koliyi Kapat ve Barkod Ata"}
          </Button>
        ) : null}

        {closedPkg && (closedPkg.barcodeValue || closedPkg.qrValue) ? (
          <div className="space-y-2">
            <Button variant="outline" className="w-full" onClick={handlePrint}>
              <Printer className="h-4 w-4 mr-2" />
              Barkod Yazdır / PDF
            </Button>
            {!isReady ? (
              <Button variant="outline" className="w-full" onClick={() => setScanOpen(true)}>
                <ScanLine className="h-4 w-4 mr-2" />
                Barkodu Tara
              </Button>
            ) : null}
            {scanMatched && isClosed ? (
              <Button
                className="w-full bg-green-600 hover:bg-green-700"
                onClick={() =>
                  verifyMutation.mutate(closedPkg.barcodeValue || closedPkg.qrValue || "")
                }
                disabled={verifyMutation.isPending}
              >
                <CheckCircle2 className="h-4 w-4 mr-2" />
                {verifyMutation.isPending ? "Hazırlanıyor…" : "Sevkiyata Hazır Yap"}
              </Button>
            ) : null}
            {isReady ? (
              <div className="rounded-md bg-green-50 dark:bg-green-950/20 border border-green-200 p-3 text-center text-green-700 font-medium">
                Koli sevkiyata hazır
              </div>
            ) : null}
          </div>
        ) : null}
      </main>

      <BarcodeScannerModal
        open={scanOpen}
        title="Koli Barkodunu Tara"
        scanMode="package"
        expectedValue={closedPkg?.barcodeValue || closedPkg?.qrValue}
        onClose={() => setScanOpen(false)}
        onScanned={handleScan}
        onScanRejected={(msg) => toast({ title: msg, variant: "destructive" })}
      />
    </div>
  );
}
