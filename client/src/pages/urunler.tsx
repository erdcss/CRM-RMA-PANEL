import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Package } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type CatalogProduct = {
  id: number;
  stockCode: string;
  stockName: string;
  ownerUserId: string;
  createdAt: string;
};

export default function Urunler() {
  const [searchQuery, setSearchQuery] = useState("");

  const queryPath =
    searchQuery.trim().length > 0
      ? `/api/catalog-products?q=${encodeURIComponent(searchQuery.trim())}`
      : "/api/catalog-products";

  const { data: products, isLoading } = useQuery<CatalogProduct[]>({
    queryKey: [queryPath],
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Ürünler</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Stok kodu ve stok adı listesi (hesabınıza özel)
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {products?.length ?? 0} Ürün
          </Badge>
        </div>
      </div>

      <div className="p-6 border-b">
        <Input
          placeholder="Stok kodu veya ürün adı ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
          data-testid="input-search-products"
        />
      </div>

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !products?.length ? (
          <div className="text-center py-12">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "Ürün bulunamadı" : "Stok listeniz boş"}
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Stok Kodu</TableHead>
                  <TableHead>Stok Adı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell className="font-medium text-primary">{product.stockCode}</TableCell>
                    <TableCell>{product.stockName}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </main>
    </div>
  );
}
