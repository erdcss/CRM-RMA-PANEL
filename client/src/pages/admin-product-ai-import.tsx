import { DragEvent, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  CheckCircle2,
  FileImage,
  FileText,
  Globe2,
  ImagePlus,
  Percent,
  Sparkles,
  Trash2,
  UploadCloud,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { fileToCompressedDataUrl } from "@/lib/compress-image";

type ImportVariant = {
  name: string;
  value: string;
  sku: string;
  barcode: string;
  price: number | null;
  stock: number | null;
};

type ImportRow = {
  key: string;
  selected: boolean;
  sku: string;
  barcode: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  sourcePrice: string;
  price: string;
  stock: string;
  minOrderQty: string;
  unitsPerBox: string;
  collectionName: string;
  images: string[];
  variants: ImportVariant[];
};

const allowedTypes = new Set(["application/pdf", "image/png", "image/jpeg"]);

function fileToDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Dosya okunamadı"));
    reader.readAsDataURL(file);
  });
}

function descriptionWithProductCode(description: unknown, sku: unknown) {
  const code = String(sku || "").trim();
  const cleanDescription = String(description || "")
    .split("\n")
    .filter((line) => !/^ürün\s*kodu\s*:/i.test(line.trim()))
    .join("\n")
    .trim();

  if (!code) return cleanDescription;
  return cleanDescription
    ? `Ürün Kodu: ${code}\n${cleanDescription}`
    : `Ürün Kodu: ${code}`;
}

function priceWithProfit(source: unknown, percent: number) {
  const value = Number(source);
  if (!Number.isFinite(value)) return "";
  const safePercent = Math.min(500, Math.max(0, Number(percent) || 0));
  return (Math.round(value * (1 + safePercent / 100) * 100) / 100).toFixed(2);
}

function variantsFromAi(product: any): ImportVariant[] {
  const variants: ImportVariant[] = [];

  if (product?.color) {
    variants.push({
      name: "Renk",
      value: String(product.color),
      sku: "",
      barcode: "",
      price: null,
      stock: null,
    });
  }

  if (product?.size) {
    variants.push({
      name: "Beden / Ölçü",
      value: String(product.size),
      sku: "",
      barcode: "",
      price: null,
      stock: null,
    });
  }

  if (product?.variant && !product?.color && !product?.size) {
    variants.push({
      name: "Varyant",
      value: String(product.variant),
      sku: "",
      barcode: "",
      price: null,
      stock: null,
    });
  }

  return variants;
}

export default function AdminProductAiImport() {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [imageSearching, setImageSearching] = useState(false);
  const [profitPercent, setProfitPercent] = useState(0);
  const [saving, setSaving] = useState(false);

  const selectedRows = useMemo(() => rows.filter((row) => row.selected), [rows]);
  const invalidSelected = selectedRows.some(
    (row) =>
      !row.sku.trim() ||
      !row.name.trim() ||
      !Number.isFinite(Number(row.price || 0)) ||
      row.images.length === 0,
  );

  function addFiles(incoming: File[]) {
    const accepted = incoming.filter(
      (file) => allowedTypes.has(file.type) && file.size <= 10 * 1024 * 1024,
    );
    const rejected = incoming.length - accepted.length;
    setFiles((current) => [...current, ...accepted].slice(0, 12));

    if (rejected > 0) {
      toast({
        title: "Bazı dosyalar eklenmedi",
        description: "Yalnızca PDF, PNG ve JPEG; dosya başına en fazla 10 MB desteklenir.",
        variant: "destructive",
      });
    }
  }

  function applyProfitPercent(nextPercent: number) {
    const safePercent = Math.min(500, Math.max(0, Number(nextPercent) || 0));
    setProfitPercent(safePercent);
    setRows((current) =>
      current.map((row) => ({
        ...row,
        price: row.sourcePrice
          ? priceWithProfit(row.sourcePrice, safePercent)
          : row.price,
      })),
    );
  }

  async function findWebImages(targetRows: ImportRow[]) {
    const missing = targetRows
      .filter((row) => row.images.length === 0)
      .slice(0, 40);

    if (!missing.length) return;

    setImageSearching(true);
    try {
      const response = await apiRequest("POST", "/api/product-ai/find-images", {
        products: missing.map((row) => ({
          key: row.key,
          sku: row.sku,
          barcode: row.barcode,
          name: row.name,
          brand: row.brand,
        })),
      });
      const result = await response.json() as {
        found?: number;
        matches?: Array<{
          key: string;
          imageData?: string | null;
          sourceUrl?: string | null;
        }>;
      };
      const matches = new Map(
        (result.matches || [])
          .filter((item) => item.imageData)
          .map((item) => [item.key, item.imageData as string]),
      );

      setRows((current) =>
        current.map((row) => {
          const automaticImage = matches.get(row.key);
          if (!automaticImage || row.images.length > 0) return row;
          return { ...row, images: [automaticImage] };
        }),
      );

      toast({
        title: "Web görsel taraması tamamlandı",
        description: `${Number(result.found || 0)} ürün için doğrulanmış görsel otomatik eklendi.`,
      });
    } catch (error) {
      toast({
        title: "Web görselleri tamamlanamadı",
        description:
          error instanceof Error
            ? error.message
            : "Görselleri manuel olarak eklemeye devam edebilirsiniz.",
        variant: "destructive",
      });
    } finally {
      setImageSearching(false);
    }
  }

  function drop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    addFiles(Array.from(event.dataTransfer.files || []));
  }

  async function analyze() {
    if (!files.length) return;

    setAnalyzing(true);
    const extracted: ImportRow[] = [];

    try {
      for (const file of files) {
        const dataUrl = await fileToDataUrl(file);
        const response = await apiRequest("POST", "/api/product-ai/extract", {
          name: file.name,
          mime: file.type,
          dataUrl,
        });

        const result = await response.json() as { products?: any[] };
        const products = result.products || [];

        let automaticImage: string | null = null;
        if (file.type.startsWith("image/") && products.length === 1) {
          automaticImage = await fileToCompressedDataUrl(file);
        }

        for (const product of products) {
          const sku = product.sku || product.barcode || "";
          const rawPrice =
            product.salePrice == null
              ? product.purchasePrice
              : product.salePrice;
          const sourcePrice = rawPrice == null ? "" : String(rawPrice);
          extracted.push({
            key: crypto.randomUUID(),
            selected: true,
            sku,
            barcode: product.barcode || "",
            name: product.name || "",
            brand: product.brand || "",
            category: product.category || "",
            description: descriptionWithProductCode(product.description, sku),
            sourcePrice,
            price: sourcePrice ? priceWithProfit(sourcePrice, profitPercent) : "",
            stock: product.stock == null ? "0" : String(product.stock),
            minOrderQty:
              product.minimumOrderQuantity == null
                ? "1"
                : String(product.minimumOrderQuantity),
            unitsPerBox:
              product.unitsPerBox == null ? "1" : String(product.unitsPerBox),
            collectionName: "",
            images: automaticImage ? [automaticImage] : [],
            variants: variantsFromAi(product),
          });
        }
      }

      setRows(extracted);
      toast({
        title: "AI analizi tamamlandı",
        description:
          `${extracted.length} ürün bulundu. Eksik ürün görselleri webde otomatik aranıyor.`,
      });

      void findWebImages(extracted);
    } catch (error) {
      toast({
        title: "Belge analiz edilemedi",
        description: error instanceof Error ? error.message : "Bilinmeyen hata",
        variant: "destructive",
      });
    } finally {
      setAnalyzing(false);
    }
  }

  function updateRow<K extends keyof ImportRow>(
    key: string,
    field: K,
    value: ImportRow[K],
  ) {
    setRows((current) =>
      current.map((row) => (row.key === key ? { ...row, [field]: value } : row)),
    );
  }

  async function setRowImage(key: string, file?: File) {
    if (!file) return;

    try {
      const image = await fileToCompressedDataUrl(file);
      updateRow(key, "images", [image]);
    } catch (error) {
      toast({
        title: "Ürün görseli eklenemedi",
        description: error instanceof Error ? error.message : "Görsel işlenemedi",
        variant: "destructive",
      });
    }
  }

  async function saveApproved() {
    if (!selectedRows.length) return;

    if (invalidSelected) {
      toast({
        title: "Eksik ürün bilgisi var",
        description: "Seçili tüm ürünlerde stok kodu, ürün adı, fiyat ve en az bir görsel zorunludur.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const response = await apiRequest("POST", "/api/admin/b2b-products/bulk", {
        products: selectedRows.map((row) => ({
          sku: row.sku.trim(),
          barcode: row.barcode.trim(),
          name: row.name.trim(),
          brand: row.brand.trim(),
          category: row.category.trim(),
          description: descriptionWithProductCode(row.description, row.sku),
          price: Number(row.price || 0),
          stock: Number(row.stock || 0),
          minOrderQty: Number(row.minOrderQty || 1),
          unitsPerBox: Number(row.unitsPerBox || 1),
          collectionName: row.collectionName.trim(),
          images: row.images,
          variants: row.variants,
        })),
      });

      const result = await response.json() as { count?: number };
      const saved = Number(result.count || selectedRows.length);

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/b2b-products"] });
      setRows([]);
      setFiles([]);

      toast({
        title: "Ürünler kaydedildi",
        description: `${saved} ürün B2B kataloğuna eksiksiz olarak aktarıldı.`,
      });
    } catch (error) {
      toast({
        title: "Ürün aktarımı tamamlanamadı",
        description:
          error instanceof Error ? error.message : "Ürün kaydetme sırasında hata oluştu",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-7xl p-5 sm:p-8">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <Link
              href="/urunler"
              className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="mr-2 h-4 w-4" /> Ürünlere dön
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
              <Sparkles className="h-6 w-6" /> AI ile Ürün İçeri Aktar
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">
              PDF, PNG veya JPEG dosyalarındaki ürünleri çıkarın, görselleri tamamlayın ve toplu olarak onaylayın.
            </p>
          </div>
        </div>

        <div
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={`rounded-2xl border-2 border-dashed bg-background p-8 text-center transition-colors ${
            dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"
          }`}
        >
          <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
          <div className="mt-3 font-semibold">Dosyaları buraya sürükleyip bırakın</div>
          <div className="mt-1 text-sm text-muted-foreground">
            PDF, PNG, JPEG · Dosya başına en fazla 10 MB
          </div>

          <label className="mt-4 inline-block">
            <input
              type="file"
              multiple
              accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg"
              className="hidden"
              onChange={(event) => addFiles(Array.from(event.target.files || []))}
            />
            <span className="inline-flex h-10 cursor-pointer items-center rounded-md border bg-background px-4 text-sm font-medium hover:bg-muted">
              Dosya Seç
            </span>
          </label>
        </div>

        {files.length > 0 ? (
          <div className="mt-4 rounded-2xl border bg-background p-4">
            <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="font-semibold">Yüklenecek dosyalar ({files.length})</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Dosyadaki birim fiyatlara uygulanacak kâr oranını analizden önce seçin.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2 rounded-lg border bg-muted/20 px-3 py-2">
                  <Percent className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold">Kâr</span>
                  <Input
                    type="number"
                    min="0"
                    max="500"
                    step="1"
                    value={profitPercent}
                    onChange={(event) =>
                      applyProfitPercent(Number(event.target.value || 0))
                    }
                    className="h-8 w-20 bg-background text-right"
                  />
                  <span className="text-xs font-semibold">%</span>
                </div>

                {[0, 10, 15, 20, 25, 30, 40, 50].map((percent) => (
                  <button
                    key={percent}
                    type="button"
                    onClick={() => applyProfitPercent(percent)}
                    className={`h-8 rounded-md border px-2.5 text-xs font-semibold ${
                      profitPercent === percent
                        ? "border-primary bg-primary text-primary-foreground"
                        : "bg-background hover:bg-muted"
                    }`}
                  >
                    %{percent}
                  </button>
                ))}

                <Button onClick={analyze} disabled={analyzing}>
                  <Sparkles className="mr-2 h-4 w-4" />
                  {analyzing ? "AI analiz ediyor…" : "AI ile Analiz Et"}
                </Button>
              </div>
            </div>

            <div className="mb-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              Örnek: dosyadaki fiyat 100,00 ₺ ve kâr oranı %20 ise satış birim fiyatı otomatik 120,00 ₺ olur.
            </div>

            <div className="space-y-2">
              {files.map((file, index) => (
                <div
                  key={`${file.name}-${index}`}
                  className="flex items-center justify-between rounded-lg border px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    {file.type === "application/pdf" ? (
                      <FileText className="h-4 w-4 shrink-0" />
                    ) : (
                      <FileImage className="h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {(file.size / 1024 / 1024).toFixed(1)} MB
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      setFiles((current) => current.filter((_, i) => i !== index))
                    }
                    className="rounded p-2 hover:bg-muted"
                    aria-label="Dosyayı kaldır"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {rows.length > 0 ? (
          <div className="mt-6 rounded-2xl border bg-background shadow-sm">
            <div className="flex flex-col gap-3 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <div className="font-bold">AI tarafından bulunan ürünler</div>
                <div className="text-sm text-muted-foreground">
                  Satırlar manuel düzenlenebilir. Görseli olmayan seçili ürün kaydedilemez.
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  variant="outline"
                  onClick={() => void findWebImages(rows)}
                  disabled={imageSearching || rows.every((row) => row.images.length > 0)}
                >
                  <Globe2 className="mr-2 h-4 w-4" />
                  {imageSearching ? "Webde görsel aranıyor…" : "Eksik Görselleri Webde Tara"}
                </Button>
                <Button
                  onClick={saveApproved}
                  disabled={saving || !selectedRows.length || invalidSelected}
                >
                  <CheckCircle2 className="mr-2 h-4 w-4" />
                  {saving
                    ? "Kaydediliyor…"
                    : `Onaylananları Kaydet (${selectedRows.length})`}
                </Button>
              </div>
            </div>

            {invalidSelected ? (
              <div className="border-b bg-amber-50 px-4 py-3 text-sm text-amber-800">
                Seçili tüm ürünlerde stok kodu, ürün adı, fiyat ve ürün görseli zorunludur.
              </div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[2260px] text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-12 px-3 py-3">Onay</th>
                    <th className="w-24 px-3 py-3">Görsel *</th>
                    <th className="w-[190px] px-3 py-3">Stok kodu *</th>
                    <th className="w-[210px] px-3 py-3">Barkod</th>
                    <th className="w-[390px] px-3 py-3">Ürün adı *</th>
                    <th className="w-[240px] px-3 py-3">Marka</th>
                    <th className="px-3 py-3">Kategori</th>
                    <th className="px-3 py-3">Fiyat *</th>
                    <th className="px-3 py-3">Stok</th>
                    <th className="px-3 py-3">Min.</th>
                    <th className="px-3 py-3">Koli içi</th>
                    <th className="px-3 py-3">Koleksiyon</th>
                    <th className="w-12 px-3 py-3"></th>
                  </tr>
                </thead>

                <tbody className="divide-y">
                  {rows.map((row) => (
                    <tr key={row.key} className={row.selected ? "" : "opacity-50"}>
                      <td className="px-3 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={row.selected}
                          onChange={(event) =>
                            updateRow(row.key, "selected", event.target.checked)
                          }
                          className="h-4 w-4"
                        />
                      </td>

                      <td className="px-3 py-2">
                        <label className="block cursor-pointer">
                          <input
                            type="file"
                            accept="image/png,image/jpeg,image/webp"
                            className="hidden"
                            onChange={(event) => {
                              void setRowImage(row.key, event.target.files?.[0]);
                              event.currentTarget.value = "";
                            }}
                          />
                          {row.images[0] ? (
                            <img
                              src={row.images[0]}
                              alt=""
                              className="h-14 w-14 rounded-lg border bg-white object-contain"
                            />
                          ) : (
                            <span className="flex h-14 w-14 items-center justify-center rounded-lg border border-dashed border-amber-300 bg-amber-50 text-amber-700">
                              <ImagePlus className="h-4 w-4" />
                            </span>
                          )}
                        </label>
                      </td>

                      <Cell>
                        <Input
                          value={row.sku}
                          title={row.sku}
                          className="min-w-[170px]"
                          onChange={(e) => {
                            const nextSku = e.target.value;
                            setRows((current) =>
                              current.map((item) =>
                                item.key === row.key
                                  ? {
                                      ...item,
                                      sku: nextSku,
                                      description: descriptionWithProductCode(
                                        item.description,
                                        nextSku,
                                      ),
                                    }
                                  : item,
                              ),
                            );
                          }}
                        />
                      </Cell>
                      <Cell>
                        <Input
                          value={row.barcode}
                          title={row.barcode}
                          className="min-w-[190px]"
                          onChange={(e) => updateRow(row.key, "barcode", e.target.value)}
                        />
                      </Cell>
                      <Cell>
                        <Input
                          value={row.name}
                          title={row.name}
                          className="min-w-[360px]"
                          onChange={(e) => updateRow(row.key, "name", e.target.value)}
                        />
                      </Cell>
                      <Cell>
                        <Input
                          value={row.brand}
                          title={row.brand}
                          className="min-w-[220px]"
                          onChange={(e) => updateRow(row.key, "brand", e.target.value)}
                        />
                      </Cell>
                      <Cell>
                        <Input
                          value={row.category}
                          onChange={(e) => updateRow(row.key, "category", e.target.value)}
                        />
                      </Cell>
                      <Cell>
                        <div className="min-w-[130px]">
                          <Input
                            type="number"
                            min="0"
                            step="0.01"
                            value={row.price}
                            onChange={(e) => updateRow(row.key, "price", e.target.value)}
                          />
                          {row.sourcePrice ? (
                            <div className="mt-1 whitespace-nowrap text-[10px] text-muted-foreground">
                              Kaynak {Number(row.sourcePrice).toLocaleString("tr-TR", {
                                minimumFractionDigits: 2,
                                maximumFractionDigits: 2,
                              })} ₺ · +%{profitPercent}
                            </div>
                          ) : null}
                        </div>
                      </Cell>
                      <Cell>
                        <Input
                          type="number"
                          min="0"
                          value={row.stock}
                          onChange={(e) => updateRow(row.key, "stock", e.target.value)}
                        />
                      </Cell>
                      <Cell>
                        <Input
                          type="number"
                          min="1"
                          value={row.minOrderQty}
                          onChange={(e) =>
                            updateRow(row.key, "minOrderQty", e.target.value)
                          }
                        />
                      </Cell>
                      <Cell>
                        <Input
                          type="number"
                          min="1"
                          value={row.unitsPerBox}
                          onChange={(e) =>
                            updateRow(row.key, "unitsPerBox", e.target.value)
                          }
                        />
                      </Cell>
                      <Cell>
                        <Input
                          value={row.collectionName}
                          onChange={(e) =>
                            updateRow(row.key, "collectionName", e.target.value)
                          }
                        />
                      </Cell>

                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() =>
                            setRows((current) =>
                              current.filter((item) => item.key !== row.key),
                            )
                          }
                          className="rounded p-2 hover:bg-muted"
                          aria-label="Satırı sil"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t p-4">
              <div className="text-xs font-medium text-muted-foreground">
                Açıklamalar
              </div>
              <div className="mt-2 space-y-2">
                {rows.map((row) => (
                  <div
                    key={`desc-${row.key}`}
                    className="grid gap-2 sm:grid-cols-[180px_1fr]"
                  >
                    <div className="truncate text-xs font-medium">
                      {row.name || row.sku || "Ürün"}
                    </div>
                    <Input
                      value={row.description}
                      onChange={(e) =>
                        updateRow(row.key, "description", e.target.value)
                      }
                      placeholder="Ürün açıklaması · ürün kodu otomatik eklenir"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function Cell({ children }: { children: ReactNode }) {
  return <td className="px-3 py-2">{children}</td>;
}
