import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Users } from "lucide-react";

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

type CatalogCustomer = {
  id: number;
  accountCode: string;
  accountName: string;
  ownerUserId: string;
  createdAt: string;
};

export default function Musteriler() {
  const [, navigate] = useLocation();
  const [searchQuery, setSearchQuery] = useState("");

  const queryPath =
    searchQuery.trim().length > 0
      ? `/api/catalog-customers?q=${encodeURIComponent(searchQuery.trim())}`
      : "/api/catalog-customers";

  const { data: customers, isLoading } = useQuery<CatalogCustomer[]>({
    queryKey: [queryPath],
  });

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Müşteriler</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Cari kodu ve cari adı listesi (hesabınıza özel)
            </p>
          </div>
          <Badge variant="secondary" className="text-lg px-4 py-2">
            {customers?.length ?? 0} Müşteri
          </Badge>
        </div>
      </div>

      <div className="p-6 border-b">
        <Input
          placeholder="Cari kodu veya cari adı ara..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="max-w-md"
          data-testid="input-search-customers"
        />
      </div>

      <main className="flex-1 overflow-auto p-6">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : !customers?.length ? (
          <div className="text-center py-12">
            <Users className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "Müşteri bulunamadı" : "Cari listeniz boş"}
            </p>
          </div>
        ) : (
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[180px]">Cari Kodu</TableHead>
                  <TableHead>Cari Adı</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => navigate(`/musteri/${customer.id}`)}
                  >
                    <TableCell className="font-medium text-primary">{customer.accountCode}</TableCell>
                    <TableCell>{customer.accountName}</TableCell>
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
