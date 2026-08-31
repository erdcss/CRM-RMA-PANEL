import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Box, ScanLine, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { getPackageStatusLabel, PACKAGE_STATUSES } from "@shared/package-constants";

interface PackageRow {
  id: number;
  packageNumber: string;
  supplierName: string;
  supplierAccountCode: string;
  status: string;
  createdAt: string;
  productCount?: number;
  totalQuantity?: number;
  shipment?: { shipmentNumber: string; status: string } | null;
}

interface PackageMetrics {
  hazirlanan: number;
  dogrulamaBekleyen: number;
  sevkeHazir: number;
  tedarikcide: number;
  tamamlanan: number;
}

export default function Koliler() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("all");
  const [supplier, setSupplier] = useState("");

  const queryPath =
    `/api/rma/packages?` +
    new URLSearchParams({
      ...(search ? { search } : {}),
      ...(status !== "all" ? { status } : {}),
      ...(supplier ? { supplier } : {}),
    }).toString();

  const { data: packages = [], isLoading } = useQuery<PackageRow[]>({
    queryKey: [queryPath],
  });

  const { data: metrics } = useQuery<PackageMetrics>({
    queryKey: ["/api/rma/packages/metrics"],
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-4 sm:p-6 border-b flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <Box className="h-6 w-6" />Koli Yonetimi
          </h1>
          <p className="text-sm text-muted-foreground">RMA kolileri ve sevkiyat durumu</p>
        </div>
        <Link href="/koli-tara">
          <Button variant="outline">
            <ScanLine className="h-4 w-4 mr-2" />Barkod Tara
          </Button>
        </Link>
      </div>

      <main className="flex-1 overflow-auto p-4 sm:p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
            {[
              ["Hazirlanan", metrics?.hazirlanan ?? 0],
              ["Dogrulama Bekleyen", metrics?.dogrulamaBekleyen ?? 0],
              ["Sevke Hazir", metrics?.sevkeHazir ?? 0],
              ["Tedarikcide", metrics?.tedarikcide ?? 0],
              ["Tamamlanan", metrics?.tamamlanan ?? 0],
            ].map(([label, value]) => (
              <Card key={label as string}>
                <CardContent className="p-3">
                  <p className="text-xs text-muted-foreground">{label}</p>
                  <p className="text-2xl font-bold">{value as number}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="relative sm:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Koli no, barkod, RMA, urun, seri no..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <Input
              placeholder="Tedarikci filtre..."
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            />
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue placeholder="Durum" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tum Durumlar</SelectItem>
                {PACKAGE_STATUSES.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <Skeleton className="h-48" />
          ) : packages.length === 0 ? (
            <p className="text-center text-muted-foreground py-12">Koli bulunamadi</p>
          ) : (
            <div className="space-y-3">
              {packages.map((pkg) => (
                <Link key={pkg.id} href={`/koliler/${pkg.id}`}>
                  <Card className="hover:bg-muted/30 cursor-pointer transition-colors">
                    <CardHeader className="py-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <CardTitle className="text-base font-mono">{pkg.packageNumber}</CardTitle>
                        <Badge variant="outline">{getPackageStatusLabel(pkg.status)}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-0 text-sm text-muted-foreground grid grid-cols-1 sm:grid-cols-3 gap-1">
                      <p>{pkg.supplierName} ({pkg.supplierAccountCode})</p>
                      <p>{pkg.productCount ?? 0} urun · {pkg.totalQuantity ?? 0} adet</p>
                      <p>{new Date(pkg.createdAt).toLocaleString("tr-TR")}</p>
                      {pkg.shipment && (
                        <p className="sm:col-span-3 font-mono text-xs">
                          Sevkiyat: {pkg.shipment.shipmentNumber}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
