import { useMemo, useState } from "react";
import { Check, ChevronsUpDown, Package, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { campaignProductImage, campaignProductPrice } from "@/lib/campaign-product-picker";

export type ReelCatalogProduct = {
  id: string | number;
  name: string;
  sku?: string | null;
  brand?: string | null;
  category?: string | null;
  barcode?: string | null;
  price?: string | number | null;
  stock?: string | number | null;
  image_data?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  is_active?: boolean | null;
};

function ProductImage({ product }: { product: ReelCatalogProduct }) {
  const [failed, setFailed] = useState(false);
  const image = campaignProductImage(product);
  const classes = "h-16 w-16 shrink-0 rounded-xl border border-border bg-white object-contain p-1";

  if (!image || failed) {
    return (
      <div className={classes + " flex items-center justify-center border-dashed bg-muted/40 text-muted-foreground"}>
        <Package className="h-6 w-6" aria-hidden="true" />
      </div>
    );
  }

  return (
    <img
      src={image}
      alt={product.name}
      className={classes}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

function normalize(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .split("")
    .filter((char) => {
      const code = char.charCodeAt(0);
      return code < 768 || code > 879;
    })
    .join("")
    .replaceAll("ı", "i")
    .trim();
}

export function ReelsProductPicker({
  products,
  value,
  onChange,
  loading,
  error,
}: {
  products: ReelCatalogProduct[];
  value: string;
  onChange: (value: string) => void;
  loading: boolean;
  error: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const selected = useMemo(
    () => products.find((product) => String(product.id) === String(value)) ?? null,
    [products, value],
  );

  const filtered = useMemo(() => {
    const terms = normalize(query).split(" ").filter(Boolean);
    const results: ReelCatalogProduct[] = [];
    let total = 0;
    for (const product of products) {
      const searchText = normalize(
        [product.name, product.sku, product.brand, product.category, product.barcode]
          .filter(Boolean)
          .join(" "),
      );
      if (!terms.every((term) => searchText.includes(term))) continue;
      total += 1;
      if (results.length < 36) results.push(product);
    }
    return { results, total };
  }, [products, query]);

  const choose = (id: string) => {
    onChange(id);
    setQuery("");
    setOpen(false);
  };

  return (
    <div className="space-y-3 rounded-xl border border-border bg-background p-3 shadow-sm">
      <div className="flex items-center gap-2">
        <div className="relative min-w-0 flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="reel-product-search"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
            onKeyDown={(event) => {
              if (event.key === "Escape") setOpen(false);
            }}
            placeholder="Ürün adı, stok kodu, barkod veya marka ara..."
            autoComplete="off"
            aria-controls="reel-product-search-results"
            aria-expanded={open}
            className="pl-9"
          />
        </div>
        <Button
          type="button"
          size="icon"
          variant="outline"
          onClick={() => setOpen((previous) => !previous)}
          aria-label={open ? "Ürün kartlarını gizle" : "Ürün kartlarını göster"}
          aria-expanded={open}
        >
          <ChevronsUpDown className="h-4 w-4" aria-hidden="true" />
        </Button>
      </div>

      {selected ? (
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-primary/30 bg-primary/[0.05] p-2.5">
          <ProductImage key={String(selected.id)} product={selected} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 text-xs font-semibold text-primary">
              <Check className="h-3.5 w-3.5" aria-hidden="true" /> Reels'e bağlı ürün
            </div>
            <p className="truncate text-sm font-semibold text-foreground">{selected.name}</p>
            <p className="truncate text-xs text-muted-foreground">
              {selected.sku || "Stok kodu yok"}
              {selected.brand ? " · " + selected.brand : ""}
            </p>
          </div>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            aria-label="Bağlı ürünü kaldır"
            onClick={() => choose("")}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ) : value && !loading ? (
        <p className="text-xs text-amber-700">Bağlı ürün artık katalogda bulunmuyor. Başka ürün seçebilirsiniz.</p>
      ) : (
        <p className="text-xs text-muted-foreground">
          Videoya ürün bağlamak için arama yapın veya listeyi açın.
        </p>
      )}

      {open ? (
        <div id="reel-product-search-results" className="space-y-2 border-t border-border pt-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>
              {loading ? "Ürünler yükleniyor..." : error ? "Ürünler alınamadı" : filtered.total + " ürün bulundu"}
            </span>
            {!loading && filtered.total > filtered.results.length ? (
              <span>Daha fazlası için aramayı daraltın</span>
            ) : null}
          </div>
          {error ? (
            <div className="rounded-xl bg-destructive/5 p-4 text-sm text-destructive">
              Ürünler yüklenemedi. Sayfayı yenileyerek tekrar deneyin.
            </div>
          ) : loading ? (
            <div className="rounded-xl bg-muted/30 p-4 text-center text-sm text-muted-foreground">
              Ürünler yükleniyor...
            </div>
          ) : filtered.results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-5 text-center text-sm text-muted-foreground">
              Eşleşen ürün bulunamadı.
            </div>
          ) : (
            <div className="grid max-h-[380px] grid-cols-1 gap-2 overflow-y-auto pr-1 sm:grid-cols-2 lg:grid-cols-3" role="group" aria-label="Ürün arama sonuçları">
              {filtered.results.map((product) => {
                const isSelected = String(product.id) === String(value);
                return (
                  <button
                    key={String(product.id)}
                    type="button"
                    aria-pressed={isSelected}
                    onClick={() => choose(String(product.id))}
                    className={
                      "relative flex min-w-0 items-center gap-3 rounded-xl border p-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
                      (isSelected
                        ? "border-primary bg-primary/[0.06] ring-1 ring-primary/20"
                        : "border-border bg-card/40 hover:border-primary/50 hover:bg-accent/50")
                    }
                  >
                    <ProductImage product={product} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11px] font-medium text-muted-foreground">
                        {product.sku || "Stok kodu yok"}
                      </p>
                      <p className="line-clamp-2 text-sm font-semibold leading-snug text-foreground">
                        {product.name}
                      </p>
                      <p className="mt-1 truncate text-xs text-muted-foreground">
                        {product.brand || "Marka belirtilmedi"}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-foreground">
                        {campaignProductPrice(product.price)}
                      </p>
                    </div>
                    {isSelected ? (
                      <Check className="absolute right-2 top-2 h-4 w-4 text-primary" aria-label="Seçili ürün" />
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}
          <div className="flex items-center justify-between gap-3 text-[11px] text-muted-foreground">
            <span>Görseller B2B ürün kataloğundan alınır.</span>
            <button type="button" className="shrink-0 font-medium text-primary hover:underline" onClick={() => setOpen(false)}>
              Listeyi kapat
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
