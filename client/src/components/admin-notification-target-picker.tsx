import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type ProductOption = {
  id: number | string;
  name: string;
  sku?: string | null;
  brand?: string | null;
  category?: string | null;
  is_active?: boolean;
};
type SubcategoryOption = { id: string; name: string };
type CategoryOption = {
  category: string;
  label?: string;
  subcategories?: SubcategoryOption[];
};
type HomepageOptions = {
  categories?: string[];
  categoryCards?: CategoryOption[];
};
type Mode = "page" | "product" | "category" | "subcategory" | "manual";

const STATIC_PAGES: Array<[string, string]> = [
  ["Ana sayfa", "/"],
  ["Ürünler", "/urunler"],
  ["Kategoriler", "/kategoriler"],
  ["Siparişlerim", "/siparislerim"],
  ["Hesabım", "/hesabim"],
  ["Kampanyalar", "/kampanyalar"],
];

function getPath(value: string): string {
  if (!value) return "";
  try {
    const url = new URL(value, "https://b2b.ecalisgan.com");
    return url.origin === "https://b2b.ecalisgan.com" ? url.pathname : "";
  } catch { return ""; }
}

function selectedCategory(path: string): string {
  const match = /^\/kategori\/([^/]+)(?:\/alt\/[^/]+)?\/?$/.exec(path);
  if (!match) return "";
  try { return decodeURIComponent(match[1]); } catch { return ""; }
}

function initialMode(value: string): Mode {
  const path = getPath(value);
  if (/^\/urun\/[^/]+\/?$/.test(path)) return "product";
  if (/^\/kategori\/[^/]+\/alt\/[^/]+\/?$/.test(path)) return "subcategory";
  if (/^\/kategori\/[^/]+\/?$/.test(path)) return "category";
  if (STATIC_PAGES.some(([, url]) => url === path) || !value) return "page";
  return "manual";
}

async function loadProducts(): Promise<ProductOption[]> {
  const response = await fetch("/api/admin/b2b-products", { credentials: "include" });
  if (!response.ok) throw new Error("Ürün listesi yüklenemedi");
  const data: unknown = await response.json();
  return Array.isArray(data) ? data as ProductOption[] : [];
}

async function loadCategories(): Promise<HomepageOptions> {
  const response = await fetch("/api/admin/homepage", { credentials: "include" });
  if (!response.ok) throw new Error("Kategori listesi yüklenemedi");
  return response.json();
}

export function AdminNotificationTargetPicker({
  value, onChange, id,
}: {
  value: string;
  onChange: (path: string) => void;
  id: string;
}) {
  const [mode, setMode] = useState<Mode>(() => initialMode(value));
  const [productQuery, setProductQuery] = useState("");
  const [category, setCategory] = useState(() => selectedCategory(getPath(value)));
  const { data: products = [], isLoading: productsLoading, isError: productsError } =
    useQuery<ProductOption[]>({
      queryKey: ["/api/admin/b2b-products"],
      queryFn: loadProducts,
      staleTime: 60_000,
      enabled: mode === "product",
    });
  const { data: homepage, isLoading: categoriesLoading, isError: categoriesError } =
    useQuery<HomepageOptions>({
      queryKey: ["/api/admin/homepage"],
      queryFn: loadCategories,
      staleTime: 60_000,
      enabled: mode === "category" || mode === "subcategory",
    });

  const categories = useMemo(() => {
    const found = new Map<string, CategoryOption>();
    for (const name of homepage?.categories || []) {
      if (typeof name === "string" && name.trim()) found.set(name, { category: name });
    }
    for (const card of homepage?.categoryCards || []) {
      if (card?.category) found.set(card.category, card);
    }
    return [...found.values()];
  }, [homepage]);

  const activeCategory = categories.find(item => item.category === category);
  const subcategories = activeCategory?.subcategories || [];
  const currentSubId = (() => {
    const match = /^\/kategori\/[^/]+\/alt\/([^/]+)\/?$/.exec(getPath(value));
    if (!match) return "";
    try { return decodeURIComponent(match[1]); } catch { return ""; }
  })();

  const visibleProducts = useMemo(() => {
    const query = productQuery.trim().toLocaleLowerCase("tr-TR");
    return products.filter(item => item && item.is_active !== false &&
      (!query || [item.name, item.sku, item.brand, item.category, String(item.id)]
        .filter(Boolean).some(word => String(word).toLocaleLowerCase("tr-TR").includes(query))))
      .slice(0, 25);
  }, [products, productQuery]);

  function chooseMode(next: Mode) {
    setMode(next);
    setProductQuery("");
    setCategory("");
    onChange("");
  }
  function chooseCategory(name: string) {
    setCategory(name);
    onChange(name && mode === "category" ? "/kategori/" + encodeURIComponent(name) : "");
  }

  return (
    <div className="space-y-2 rounded-xl border bg-background p-3">
      <label htmlFor={id} className="block text-sm font-semibold">
        Bildirime tıklanınca açılacak hedef (isteğe bağlı)
      </label>
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Bildirim hedef türü">
        {([
          ["page", "Sayfa"],
          ["product", "Ürün seç"],
          ["category", "Kategori seç"],
          ["subcategory", "Alt kategori seç"],
          ["manual", "Bağlantı gir"],
        ] as Array<[Mode, string]>).map(([kind, title]) => (
          <Button key={kind} size="sm" type="button"
            variant={mode === kind ? "default" : "outline"}
            onClick={() => chooseMode(kind)}>{title}</Button>
        ))}
      </div>

      {mode === "page" ? (
        <div className="flex flex-wrap gap-2">
          {STATIC_PAGES.map(([title, path]) => (
            <Button key={path} size="sm" type="button"
              variant={getPath(value) === path && value ? "secondary" : "outline"}
              onClick={() => onChange(path)}>{title}</Button>
          ))}
        </div>
      ) : null}

      {mode === "product" ? (
        <div className="space-y-2">
          <Input id={id} value={productQuery} onChange={event => setProductQuery(event.target.value)}
            placeholder="Ürün adı, kodu, markası veya ID ile ara..." aria-label="Bildirimin açacağı ürünü ara" />
          {productsLoading ? <p className="text-xs text-muted-foreground">Ürünler yükleniyor...</p> : null}
          {productsError ? <p className="text-xs text-destructive">Ürünler alınamadı. Tekrar deneyin.</p> : null}
          {!productsLoading && !productsError ? (
            <div className="max-h-56 overflow-y-auto rounded-lg border">
              {visibleProducts.length ? visibleProducts.map(product => {
                const path = "/urun/" + encodeURIComponent(String(product.id));
                return (
                  <button key={String(product.id)} type="button"
                    className={"w-full border-b px-3 py-2 text-left text-sm last:border-b-0 hover:bg-muted " +
                      (getPath(value) === path ? "bg-muted font-semibold" : "")}
                    onClick={() => { onChange(path); setProductQuery(product.name); }}>
                    <span className="block truncate">{product.name}</span>
                    <span className="block text-xs text-muted-foreground">
                      {product.sku || "Ürün"} · ID {product.id}{product.category ? " · " + product.category : ""}
                    </span>
                  </button>
                );
              }) : <p className="p-3 text-xs text-muted-foreground">Eşleşen aktif ürün bulunamadı.</p>}
            </div>
          ) : null}
        </div>
      ) : null}

      {mode === "category" || mode === "subcategory" ? (
        <div className="space-y-2">
          <select id={id} value={category} onChange={event => chooseCategory(event.target.value)}
            className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label="Kategori seç">
            <option value="">Kategori seçiniz...</option>
            {categories.map(item => (
              <option key={item.category} value={item.category}>{item.label || item.category}</option>
            ))}
          </select>
          {mode === "subcategory" ? (
            <select value={currentSubId}
              disabled={!category || !subcategories.length}
              onChange={event => onChange(event.target.value
                ? "/kategori/" + encodeURIComponent(category) + "/alt/" + encodeURIComponent(event.target.value)
                : "")}
              className="h-10 w-full rounded-md border bg-background px-3 text-sm"
              aria-label="Alt kategori seç">
              <option value="">Alt kategori seçiniz...</option>
              {subcategories.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}
            </select>
          ) : null}
          {categoriesLoading ? <p className="text-xs text-muted-foreground">Kategoriler yükleniyor...</p> : null}
          {categoriesError ? <p className="text-xs text-destructive">Kategoriler yüklenemedi. Tekrar deneyin.</p> : null}
          {mode === "subcategory" && category && !subcategories.length && !categoriesLoading ?
            <p className="text-xs text-muted-foreground">Bu kategoride henüz alt kategori yok.</p> : null}
        </div>
      ) : null}

      {mode === "manual" ? (
        <Input id={id} type="text" inputMode="url" maxLength={500} value={value}
          onChange={event => onChange(event.target.value)}
          placeholder="/urun/145 veya https://b2b.ecalisgan.com/kategori/..." />
      ) : null}

      {value ? (
        <div className="flex items-center justify-between gap-2 rounded-md bg-muted/40 p-2">
          <p className="min-w-0 break-all text-xs text-muted-foreground">
            <strong className="text-foreground">Seçilen hedef:</strong> {value}
          </p>
          <Button size="sm" type="button" variant="ghost" onClick={() => onChange("")}>Temizle</Button>
        </div>
      ) : <p className="text-xs text-muted-foreground">Hedef seçilmezse mevcut bildirim davranışı korunur.</p>}
      <p className="text-xs text-muted-foreground">
        Bildirime dokunulduğunda seçilen ürün, kategori veya alt kategori uygulamada açılır.
        Yalnızca Çalışkan B2B adresleri ve site içi yollar kabul edilir.
      </p>
    </div>
  );
}
