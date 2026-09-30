import { DragEvent, useMemo, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { ArrowLeft, CheckCircle2, FileImage, FileText, Sparkles, Trash2, UploadCloud } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type ImportRow = {
  key: string;
  selected: boolean;
  sku: string;
  name: string;
  brand: string;
  category: string;
  description: string;
  price: string;
  stock: string;
  minOrderQty: string;
  unitsPerBox: string;
  collectionName: string;
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

export default function AdminProductAiImport() {
  const { toast } = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [dragging, setDragging] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);

  const selectedRows = useMemo(() => rows.filter((row) => row.selected), [rows]);
  const invalidSelected = selectedRows.some((row) => !row.sku.trim() || !row.name.trim());

  function addFiles(incoming: File[]) {
    const accepted = incoming.filter((file) => allowedTypes.has(file.type) && file.size <= 10 * 1024 * 1024);
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

        for (const product of result.products || []) {
          extracted.push({
            key: crypto.randomUUID(),
            selected: true,
            sku: product.sku || product.barcode || "",
            name: product.name || "",
            brand: product.brand || "",
            category: product.category || "",
            description: product.description || "",
            price: product.salePrice == null ? "" : String(product.salePrice),
            stock: product.stock == null ? "0" : String(product.stock),
            minOrderQty: product.minimumOrderQuantity == null ? "1" : String(product.minimumOrderQuantity),
            unitsPerBox: product.unitsPerBox == null ? "1" : String(product.unitsPerBox),
            collectionName: "",
          });
        }
      }

      setRows(extracted);
      toast({
        title: "AI analizi tamamlandı",
        description: `${extracted.length} ürün bulundu. Kaydetmeden önce listeyi kontrol edip düzenleyebilirsiniz.`,
      });
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

  function updateRow(key: string, field: keyof ImportRow, value: string | boolean) {
    setRows((current) => current.map((row) => row.key === key ? { ...row, [field]: value } : row));
  }

  async function saveApproved() {
    if (!selectedRows.length || invalidSelected) return;
    setSaving(true);
    let saved = 0;

    try {
      for (const row of selectedRows) {
        await apiRequest("POST", "/api/admin/b2b-products", {
          sku: row.sku.trim(),
          name: row.name.trim(),
          brand: row.brand.trim(),
          category: row.category.trim(),
          description: row.description.trim(),
          price: Number(row.price || 0),
          stock: Number(row.stock || 0),
          minOrderQty: Number(row.minOrderQty || 1),
          unitsPerBox: Number(row.unitsPerBox || 1),
          collectionName: row.collectionName.trim(),
        });
        saved += 1;
      }

      await queryClient.invalidateQueries({ queryKey: ["/api/admin/b2b-products"] });
      setRows([]);
      setFiles([]);
      toast({ title: "Ürünler kaydedildi", description: `${saved} ürün B2B kataloğuna aktarıldı.` });
    } catch (error) {
      toast({
        title: `${saved} ürün kaydedildi, işlem durdu`,
        description: error instanceof Error ? error.message : "Ürün kaydetme sırasında hata oluştu",
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
            <Link href="/urunler" className="mb-3 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="mr-2 h-4 w-4" /> Ürünlere dön
            </Link>
            <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight">
              <Sparkles className="h-6 w-6" /> AI ile Ürün İçeri Aktar
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">PDF, PNG veya JPEG dosyalarındaki ürünleri yapay zeka ile çıkarın, kontrol edin ve onaylayın.</p>
          </div>
        </div>

        <div
          onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={() => setDragging(false)}
          onDrop={drop}
          className={`rounded-2xl border-2 border-dashed bg-background p-8 text-center transition-colors ${dragging ? "border-primary bg-primary/5" : "border-muted-foreground/25"}`}
        >
          <UploadCloud className="mx-auto h-10 w-10 text-muted-foreground" />
          <div className="mt-3 font-semibold">Dosyaları buraya sürükleyip bırakın</div>
          <div className="mt-1 text-sm text-muted-foreground">PDF, PNG, JPEG · Dosya başına en fazla 10 MB</div>
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
            <div className="mb-3 flex items-center justify-between">
              <div className="font-semibold">Yüklenecek dosyalar ({files.length})</div>
              <Button onClick={analyze} disabled={analyzing}>
                <Sparkles className="mr-2 h-4 w-4" />
                {analyzing ? "AI analiz ediyor…" : "AI ile Analiz Et"}
              </Button>
            </div>
            <div className="space-y-2">
              {files.map((file, index) => (
                <div key={`${file.name}-${index}`} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div className="flex min-w-0 items-center gap-2">
                    {file.type === "application/pdf" ? <FileText className="h-4 w-4 shrink-0" /> : <FileImage className="h-4 w-4 shrink-0" />}
                    <span className="truncate text-sm">{file.name}</span>
                    <span className="text-xs text-muted-foreground">{(file.size / 1024 / 1024).toFixed(1)} MB</span>
                  </div>
                  <button type="button" onClick={() => setFiles((current) => current.filter((_, i) => i !== index))} className="rounded p-2 hover:bg-muted" aria-label="Dosyayı kaldır">
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
                <div className="text-sm text-muted-foreground">Satırlar manuel düzenlenebilir. Yalnızca işaretli ürünler kaydedilir.</div>
              </div>
              <Button onClick={saveApproved} disabled={saving || !selectedRows.length || invalidSelected}>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                {saving ? "Kaydediliyor…" : `Onaylananları Kaydet (${selectedRows.length})`}
              </Button>
            </div>

            {invalidSelected ? (
              <div className="border-b bg-amber-50 px-4 py-3 text-sm text-amber-800">Seçili ürünlerde ürün adı ve stok kodu zorunludur.</div>
            ) : null}

            <div className="overflow-x-auto">
              <table className="w-full min-w-[1300px] text-sm">
                <thead className="bg-muted/40 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="w-12 px-3 py-3">Onay</th>
                    <th className="px-3 py-3">Stok kodu *</th>
                    <th className="px-3 py-3">Ürün adı *</th>
                    <th className="px-3 py-3">Marka</th>
                    <th className="px-3 py-3">Kategori</th>
                    <th className="px-3 py-3">Fiyat</th>
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
                        <input type="checkbox" checked={row.selected} onChange={(event) => updateRow(row.key, "selected", event.target.checked)} className="h-4 w-4" />
                      </td>
                      <Cell><Input value={row.sku} onChange={(e) => updateRow(row.key, "sku", e.target.value)} /></Cell>
                      <Cell><Input value={row.name} onChange={(e) => updateRow(row.key, "name", e.target.value)} /></Cell>
                      <Cell><Input value={row.brand} onChange={(e) => updateRow(row.key, "brand", e.target.value)} /></Cell>
                      <Cell><Input value={row.category} onChange={(e) => updateRow(row.key, "category", e.target.value)} /></Cell>
                      <Cell><Input type="number" min="0" step="0.01" value={row.price} onChange={(e) => updateRow(row.key, "price", e.target.value)} /></Cell>
                      <Cell><Input type="number" min="0" value={row.stock} onChange={(e) => updateRow(row.key, "stock", e.target.value)} /></Cell>
                      <Cell><Input type="number" min="1" value={row.minOrderQty} onChange={(e) => updateRow(row.key, "minOrderQty", e.target.value)} /></Cell>
                      <Cell><Input type="number" min="1" value={row.unitsPerBox} onChange={(e) => updateRow(row.key, "unitsPerBox", e.target.value)} /></Cell>
                      <Cell><Input value={row.collectionName} onChange={(e) => updateRow(row.key, "collectionName", e.target.value)} /></Cell>
                      <td className="px-3 py-2">
                        <button type="button" onClick={() => setRows((current) => current.filter((item) => item.key !== row.key))} className="rounded p-2 hover:bg-muted" aria-label="Satırı sil">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="border-t p-4">
              <div className="text-xs font-medium text-muted-foreground">Açıklamalar</div>
              <div className="mt-2 space-y-2">
                {rows.map((row) => (
                  <div key={`desc-${row.key}`} className="grid gap-2 sm:grid-cols-[180px_1fr]">
                    <div className="truncate text-xs font-medium">{row.name || row.sku || "Ürün"}</div>
                    <Input value={row.description} onChange={(e) => updateRow(row.key, "description", e.target.value)} placeholder="Ürün açıklaması" />
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
