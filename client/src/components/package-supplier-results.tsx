import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { getRmaOperationLabel, getRmaStatusLabel } from "@shared/rma-constants";
import {
  SUPPLIER_RESULT_TYPES,
  getSupplierResultLabel,
  requiresNewSerial,
} from "@shared/supplier-result-constants";

type PackageItem = {
  id: number;
  productId: number;
  product?: {
    id: number;
    name?: string;
    serialNumber?: string;
    stockCode?: string;
    category?: string;
    status?: string;
    defectReason?: string;
    ticket?: { receiptNumber?: string };
  };
  supplierResult?: {
    resultType: string;
    resultDescription?: string;
    newSerialNumber?: string;
    oldSerialNumber?: string;
  } | null;
};

export function PackageSupplierResults({
  packageId,
  items,
  onUpdated,
}: {
  packageId: number;
  items: PackageItem[];
  onUpdated: () => void;
}) {
  const { toast } = useToast();
  const [selected, setSelected] = useState<number[]>([]);
  const [bulkType, setBulkType] = useState("");
  const [bulkDesc, setBulkDesc] = useState("");
  const [drafts, setDrafts] = useState<
    Record<number, { resultType: string; desc: string; newSerial: string; newBarcode: string }>
  >({});

  const saveMutation = useMutation({
    mutationFn: (payload: { productId: number; resultType: string; resultDescription?: string; newSerialNumber?: string; newBarcode?: string }) =>
      apiRequest("POST", `/api/rma/products/${payload.productId}/supplier-result`, {
        packageId,
        resultType: payload.resultType,
        resultDescription: payload.resultDescription,
        newSerialNumber: payload.newSerialNumber,
        newBarcode: payload.newBarcode,
      }),
    onSuccess: () => { onUpdated(); toast({ title: "Sonuc kaydedildi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const bulkMutation = useMutation({
    mutationFn: () =>
      apiRequest("POST", `/api/rma/packages/${packageId}/supplier-results/bulk`, {
        productIds: selected,
        resultType: bulkType,
        resultDescription: bulkDesc,
      }),
    onSuccess: () => { onUpdated(); setSelected([]); toast({ title: "Toplu sonuc kaydedildi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const sellableMutation = useMutation({
    mutationFn: (productId: number) => apiRequest("POST", `/api/rma/products/${productId}/sellable-stock`, {}),
    onSuccess: () => { onUpdated(); toast({ title: "Satilabilir stoga alindi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const scrapMutation = useMutation({
    mutationFn: (productId: number) =>
      apiRequest("POST", `/api/rma/products/${productId}/scrap`, { scrapReason: "Tedarikci/iade sonrasi hurda" }),
    onSuccess: () => { onUpdated(); toast({ title: "Hurdaya ayrildi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const deliveryMutation = useMutation({
    mutationFn: (productId: number) =>
      apiRequest("POST", `/api/rma/products/${productId}/customer-delivery`, {
        receiverName: "Musteri",
      }),
    onSuccess: () => { onUpdated(); toast({ title: "Musteriye teslim edildi" }); },
    onError: (e: Error) => toast({ title: "Hata", description: e.message, variant: "destructive" }),
  });

  const resultOptions = SUPPLIER_RESULT_TYPES.filter((t) => t.value !== "sonuc_bekliyor");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Tedarikci Sonuclari</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {selected.length > 0 && (
          <div className="rounded-md border p-3 space-y-2 bg-muted/30">
            <p className="text-sm font-medium">Toplu Sonuc ({selected.length} urun)</p>
            <Select value={bulkType} onValueChange={setBulkType}>
              <SelectTrigger><SelectValue placeholder="Sonuc tipi" /></SelectTrigger>
              <SelectContent>
                {resultOptions.map((o) => (
                  <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Input placeholder="Aciklama" value={bulkDesc} onChange={(e) => setBulkDesc(e.target.value)} />
            <Button
              size="sm"
              disabled={!bulkType || bulkMutation.isPending}
              onClick={() => bulkMutation.mutate()}
            >
              Toplu Uygula
            </Button>
          </div>
        )}

        {items.map((item) => {
          const p = item.product;
          const draft = drafts[item.productId] || { resultType: "", desc: "", newSerial: "", newBarcode: "" };
          const sr = item.supplierResult;
          const op = p?.category || "servis";

          return (
            <div key={item.id} className="border rounded-md p-3 space-y-2">
              <div className="flex items-start gap-2">
                <Checkbox
                  checked={selected.includes(item.productId)}
                  onCheckedChange={(v) =>
                    setSelected((prev) =>
                      v ? [...prev, item.productId] : prev.filter((id) => id !== item.productId),
                    )
                  }
                />
                <div className="flex-1 space-y-1 text-sm">
                  <div className="flex flex-wrap gap-2 items-center">
                    <span className="font-medium">{p?.name}</span>
                    <Badge variant="outline">{getRmaOperationLabel(op)}</Badge>
                    <Badge variant="secondary">{getRmaStatusLabel(p?.status || "")}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    RMA: {p?.ticket?.receiptNumber || "-"} · SN: {p?.serialNumber || "-"}
                  </p>
                  {p?.defectReason && <p className="text-xs">{p.defectReason}</p>}
                  {sr && (
                    <p className="text-xs">
                      Sonuc: <strong>{getSupplierResultLabel(sr.resultType)}</strong>
                      {sr.resultDescription ? ` · ${sr.resultDescription}` : ""}
                      {sr.newSerialNumber ? ` · Yeni SN: ${sr.newSerialNumber}` : ""}
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Select
                  value={draft.resultType}
                  onValueChange={(v) =>
                    setDrafts((prev) => ({ ...prev, [item.productId]: { ...draft, resultType: v } }))
                  }
                >
                  <SelectTrigger className="h-8"><SelectValue placeholder="Sonuc tipi" /></SelectTrigger>
                  <SelectContent>
                    {resultOptions.map((o) => (
                      <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Input
                  className="h-8"
                  placeholder="Aciklama"
                  value={draft.desc}
                  onChange={(e) =>
                    setDrafts((prev) => ({ ...prev, [item.productId]: { ...draft, desc: e.target.value } }))
                  }
                />
                {requiresNewSerial(draft.resultType) && (
                  <>
                    <Input
                      className="h-8 font-mono"
                      placeholder="Yeni seri no *"
                      value={draft.newSerial}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [item.productId]: { ...draft, newSerial: e.target.value } }))
                      }
                    />
                    <Input
                      className="h-8 font-mono"
                      placeholder="Yeni barkod"
                      value={draft.newBarcode}
                      onChange={(e) =>
                        setDrafts((prev) => ({ ...prev, [item.productId]: { ...draft, newBarcode: e.target.value } }))
                      }
                    />
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={!draft.resultType || saveMutation.isPending}
                  onClick={() =>
                    saveMutation.mutate({
                      productId: item.productId,
                      resultType: draft.resultType,
                      resultDescription: draft.desc,
                      newSerialNumber: draft.newSerial,
                      newBarcode: draft.newBarcode,
                    })
                  }
                >
                  Sonuc Kaydet
                </Button>
                {op !== "servis" && sr && ["degistirildi", "iade_kabul", "tamir_edildi"].includes(sr.resultType) && (
                  <Button size="sm" variant="secondary" onClick={() => sellableMutation.mutate(item.productId)}>
                    Satilabilir Stoga Al
                  </Button>
                )}
                {op === "servis" && sr && ["tamir_edildi", "degistirildi"].includes(sr.resultType) && (
                  <Button size="sm" variant="secondary" onClick={() => deliveryMutation.mutate(item.productId)}>
                    Musteriye Teslim Et
                  </Button>
                )}
                {sr && ["reddedildi", "iade_red"].includes(sr.resultType) && (
                  <>
                    <Button size="sm" variant="destructive" onClick={() => scrapMutation.mutate(item.productId)}>
                      Hurda
                    </Button>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
