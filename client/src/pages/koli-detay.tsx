import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { ArrowLeft, Download, Lock, PackageCheck, RotateCcw, ScanLine, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { generatePackageLabelPDF } from "@/lib/package-label-export";
import { EDITABLE_PACKAGE_STATUSES, getPackageStatusLabel } from "@shared/package-constants";
import { getRmaOperationLabel } from "@shared/rma-constants";
import { PackageSupplierResults } from "@/components/package-supplier-results";

export default function KoliDetay() {
  const { id } = useParams();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [verifyCode, setVerifyCode] = useState("");
  const [carrierName, setCarrierName] = useState("");
  const [trackingNumber, setTrackingNumber] = useState("");

  const { data: pkg, isLoading } = useQuery<any>({
    queryKey: [`/api/rma/packages/${id}`],
    enabled: Boolean(id),
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: [`/api/rma/packages/${id}`] });
    queryClient.invalidateQueries({ queryKey: ["/api/rma/packages"] });
    queryClient.invalidateQueries({ queryKey: ["/api/rma/packages/metrics"] });
    queryClient.invalidateQueries({ queryKey: ["/api/rma/prep-pool"] });
  };

  const closeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/rma/packages/${id}/close`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Koli kapatildi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const verifyMutation = useMutation({
    mutationFn: () => apiRequest("POST", "/api/rma/packages/verify", { barcodeValue: verifyCode }),
    onSuccess: () => { invalidate(); toast({ title: "Barkod dogrulandi" }); setVerifyCode(""); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const shipMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/rma/packages/${id}/ship`, { carrierName, trackingNumber }),
    onSuccess: () => { invalidate(); toast({ title: "Koli sevk edildi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deliverMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/rma/packages/${id}/deliver-to-supplier`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Tedarikciye ulasildi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const returnMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/rma/packages/${id}/return`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Koli geri dondu" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const completeMutation = useMutation({
    mutationFn: () => apiRequest("POST", `/api/rma/packages/${id}/complete`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Tedarikci islemi tamamlandi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const removeMutation = useMutation({
    mutationFn: (itemId: number) => apiRequest("DELETE", `/api/rma/packages/${id}/items/${itemId}`, {}),
    onSuccess: () => { invalidate(); toast({ title: "Urun cikarildi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="p-6"><Skeleton className="h-64" /></div>
    );
  }

  if (!pkg) {
    return <div className="p-6 text-muted-foreground">Koli bulunamadi</div>;
  }

  const editable = EDITABLE_PACKAGE_STATUSES.includes(pkg.status);

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => navigate("/koliler")}>
            <ArrowLeft className="h-4 w-4 mr-2" />Geri
          </Button>
          <div>
            <h1 className="text-xl font-bold font-mono">{pkg.packageNumber}</h1>
            <div className="flex items-center gap-2 mt-1">
              <Badge>{getPackageStatusLabel(pkg.status)}</Badge>
              <span className="text-sm text-muted-foreground">{pkg.supplierName}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {editable && (
            <Button onClick={() => closeMutation.mutate()} disabled={closeMutation.isPending}>
              <Lock className="h-4 w-4 mr-2" />Koliyi Kapat
            </Button>
          )}
          {pkg.barcodeValue && (
            <Button
              variant="outline"
              onClick={() =>
                generatePackageLabelPDF({
                  packageNumber: pkg.packageNumber,
                  supplierName: pkg.supplierName,
                  supplierAccountCode: pkg.supplierAccountCode,
                  status: pkg.status,
                  barcodeValue: pkg.barcodeValue,
                  qrValue: pkg.qrValue,
                  createdAt: pkg.createdAt,
                  productCount: pkg.productCount,
                  totalQuantity: pkg.totalQuantity,
                })
              }
            >
              <Download className="h-4 w-4 mr-2" />Etiket PDF
            </Button>
          )}
        </div>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-5xl mx-auto space-y-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Koli Ozeti</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <p><span className="text-muted-foreground">Tedarikci Kodu:</span> <span className="font-mono">{pkg.supplierAccountCode}</span></p>
              <p><span className="text-muted-foreground">Olusturulma:</span> {new Date(pkg.createdAt).toLocaleString("tr-TR")}</p>
              <p><span className="text-muted-foreground">Urun / Adet:</span> {pkg.productCount} / {pkg.totalQuantity}</p>
              {pkg.barcodeValue && <p className="font-mono text-xs sm:col-span-2">Barkod: {pkg.barcodeValue}</p>}
              {pkg.shipment && (
                <p className="sm:col-span-2 font-mono text-xs">
                  Sevkiyat: {pkg.shipment.shipmentNumber}
                  {pkg.shipment.trackingNumber ? ` · ${pkg.shipment.trackingNumber}` : ""}
                </p>
              )}
            </CardContent>
          </Card>

          {pkg.status === "kapatildi" && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><ScanLine className="h-4 w-4" />Barkod Dogrulama</CardTitle></CardHeader>
              <CardContent className="flex flex-col sm:flex-row gap-2">
                <Input
                  placeholder="Etiketi okutun..."
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && verifyMutation.mutate()}
                  className="font-mono"
                  autoFocus
                />
                <Button onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
                  Dogrula
                </Button>
              </CardContent>
            </Card>
          )}

          {pkg.status === "sevke_hazir" && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><Truck className="h-4 w-4" />Sevk Et</CardTitle></CardHeader>
              <CardContent className="space-y-2">
                <Input placeholder="Kargo firmasi (opsiyonel)" value={carrierName} onChange={(e) => setCarrierName(e.target.value)} />
                <Input placeholder="Takip no (opsiyonel)" value={trackingNumber} onChange={(e) => setTrackingNumber(e.target.value)} className="font-mono" />
                <Button onClick={() => shipMutation.mutate()} disabled={shipMutation.isPending}>Sevk Et</Button>
              </CardContent>
            </Card>
          )}

          {pkg.status === "sevk_edildi" && (
            <Card>
              <CardHeader><CardTitle className="text-base">Tedarikciye Ulasti</CardTitle></CardHeader>
              <CardContent>
                <Button onClick={() => deliverMutation.mutate()} disabled={deliverMutation.isPending}>
                  TEDARIKCIYE ULASTI
                </Button>
              </CardContent>
            </Card>
          )}

          {pkg.status === "tedarikcide" && (
            <Card>
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><RotateCcw className="h-4 w-4" />Geri Dondu</CardTitle></CardHeader>
              <CardContent>
                <Button onClick={() => returnMutation.mutate()} disabled={returnMutation.isPending}>
                  GERI DONDU
                </Button>
              </CardContent>
            </Card>
          )}

          {(pkg.status === "geri_dondu" || pkg.status === "tamamlandi") && (
            <>
              <PackageSupplierResults
                packageId={Number(id)}
                items={pkg.items ?? []}
                onUpdated={invalidate}
              />
              {pkg.status === "geri_dondu" && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <PackageCheck className="h-4 w-4" />Koli Tamamlama
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {pkg.completionValidation && !pkg.completionValidation.ok && (
                      <ul className="text-xs text-muted-foreground list-disc pl-4">
                        {pkg.completionValidation.errors.map((e: string) => (
                          <li key={e}>{e}</li>
                        ))}
                      </ul>
                    )}
                    <Button
                      onClick={() => completeMutation.mutate()}
                      disabled={completeMutation.isPending || (pkg.completionValidation && !pkg.completionValidation.ok)}
                    >
                      Tedarikci islemini tamamla
                    </Button>
                  </CardContent>
                </Card>
              )}
            </>
          )}

          <div className="space-y-3">
            <h2 className="font-semibold">Koli Urunleri ({pkg.items?.length ?? 0})</h2>
            {(pkg.items ?? []).map((item: any) => (
              <Card key={item.id}>
                <CardContent className="p-4 flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="text-sm space-y-1 flex-1">
                    <p className="font-medium">{item.product?.name}</p>
                    <p className="text-muted-foreground">
                      RMA: {item.product?.ticket?.receiptNumber || `#${item.product?.ticketId}`}
                      {" · "}{getRmaOperationLabel(item.product?.category)}
                      {" · "}{item.quantity} adet
                    </p>
                    <p className="font-mono text-xs">{item.product?.stockCode || "-"}</p>
                    {item.product?.serialNumber && <p className="font-mono text-xs">SN: {item.product.serialNumber}</p>}
                    {item.product?.defectReason && <p className="text-xs">{item.product.defectReason}</p>}
                  </div>
                  {editable && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeMutation.mutate(item.id)}
                      disabled={removeMutation.isPending}
                    >
                      Cikar
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {pkg.history?.length > 0 && (
            <Card>
              <CardHeader><CardTitle className="text-base">Koli Gecmisi</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {pkg.history.map((h: any) => (
                  <div key={h.id} className="border-b pb-2 last:border-0">
                    <p className="font-medium">{h.eventType}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(h.createdAt).toLocaleString("tr-TR")}
                      {h.notes ? ` · ${h.notes}` : ""}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
