import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Plus, Filter, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NewTicketDialog } from "@/components/new-ticket-dialog";
import { ProductCard } from "@/components/product-card";
import { Skeleton } from "@/components/ui/skeleton";

interface Product {
  id: number;
  name: string;
  brand: string;
  model?: string;
  serialNumber?: string;
  category: string;
  status: string;
  createdAt: string;
  ticket?: {
    id: number;
    customer?: {
      name: string;
    };
  };
}

export default function Kayitlar() {
  const [showNewTicket, setShowNewTicket] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const { data: products, isLoading } = useQuery<Product[]>({
    queryKey: ["/api/products"],
  });

  const filterProducts = (products: Product[], category?: string) => {
    if (!products) return [];

    return products.filter((product) => {
      const matchesCategory = !category || product.category === category;
      const matchesStatus =
        statusFilter === "all" || product.status === statusFilter;
      const matchesBrand =
        brandFilter === "all" || product.brand === brandFilter;
      const matchesSearch =
        !searchQuery ||
        product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.serialNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        product.ticket?.customer?.name?.toLowerCase().includes(searchQuery.toLowerCase());

      return matchesCategory && matchesStatus && matchesBrand && matchesSearch;
    });
  };

  const iadeProducts = filterProducts(products || [], "iade");
  const degisimProducts = filterProducts(products || [], "degisim");
  const servisProducts = filterProducts(products || [], "servis");
  const allProducts = filterProducts(products || []);

  const brands = Array.from(
    new Set((products || []).map((p) => p.brand))
  ).sort();

  return (
    <div className="flex flex-col h-full">
      <div className="p-6 border-b">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">Kayıtlar</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tüm ürün kayıtlarını görüntüleyin ve yönetin
            </p>
          </div>
          <Button onClick={() => setShowNewTicket(true)} data-testid="button-new-ticket">
            <Plus className="h-4 w-4 mr-2" />
            Yeni Kayıt
          </Button>
        </div>
        <div className="flex flex-col md:flex-row gap-4">
          <Input
            placeholder="Ara..."
            className="md:max-w-sm"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            data-testid="input-search-records"
          />
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="md:w-48" data-testid="select-status-filter">
              <SelectValue placeholder="Durum" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Durumlar</SelectItem>
              <SelectItem value="beklemede">Beklemede</SelectItem>
              <SelectItem value="serviste">Serviste</SelectItem>
              <SelectItem value="teslim_edildi">Teslim Edildi</SelectItem>
              <SelectItem value="iptal">İptal</SelectItem>
            </SelectContent>
          </Select>
          <Select value={brandFilter} onValueChange={setBrandFilter}>
            <SelectTrigger className="md:w-48" data-testid="select-brand-filter">
              <SelectValue placeholder="Marka" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Tüm Markalar</SelectItem>
              {brands.map((brand) => (
                <SelectItem key={brand} value={brand}>
                  {brand}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <main className="flex-1 overflow-auto p-6">
        <Tabs defaultValue="all" className="w-full">
          <TabsList className="mb-6">
            <TabsTrigger value="all" data-testid="tab-all">
              Tümü ({allProducts.length})
            </TabsTrigger>
            <TabsTrigger value="iade" data-testid="tab-iade">
              İade ({iadeProducts.length})
            </TabsTrigger>
            <TabsTrigger value="degisim" data-testid="tab-degisim">
              Değişim ({degisimProducts.length})
            </TabsTrigger>
            <TabsTrigger value="servis" data-testid="tab-servis">
              Servis ({servisProducts.length})
            </TabsTrigger>
          </TabsList>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-40" />
              ))}
            </div>
          ) : (
            <>
              <TabsContent value="all">
                {allProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">Kayıt bulunamadı</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {allProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="iade">
                {iadeProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      İade ürünü bulunamadı
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {iadeProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="degisim">
                {degisimProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      Değişim ürünü bulunamadı
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {degisimProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="servis">
                {servisProducts.length === 0 ? (
                  <div className="text-center py-12">
                    <p className="text-muted-foreground">
                      Servis ürünü bulunamadı
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {servisProducts.map((product) => (
                      <ProductCard key={product.id} product={product} />
                    ))}
                  </div>
                )}
              </TabsContent>
            </>
          )}
        </Tabs>
      </main>

      <NewTicketDialog open={showNewTicket} onOpenChange={setShowNewTicket} />
    </div>
  );
}
