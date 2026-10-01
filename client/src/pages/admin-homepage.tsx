import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Home, Plus, Save, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type HomepageConfig = {
  categories: string[];
  detectedCategories: string[];
};

async function loadHomepageConfig(): Promise<HomepageConfig> {
  const response = await fetch("/api/admin/homepage", { credentials: "include" });
  if (!response.ok) throw new Error("Ana sayfa ayarları alınamadı");
  return response.json();
}

export default function AdminHomepage() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery<HomepageConfig>({
    queryKey: ["/api/admin/homepage"],
    queryFn: loadHomepageConfig,
  });

  const [categories, setCategories] = useState<string[]>([]);
  const [newCategory, setNewCategory] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data?.categories) setCategories(data.categories);
  }, [data?.categories]);

  const suggestions = useMemo(() => {
    const selected = new Set(categories.map((item) => item.toLocaleLowerCase("tr-TR")));
    return (data?.detectedCategories || []).filter(
      (item) => !selected.has(item.toLocaleLowerCase("tr-TR")),
    );
  }, [categories, data?.detectedCategories]);

  function addCategory(raw: string) {
    const clean = raw.trim().replace(/\s+/g, " ");
    if (!clean) return;

    if (categories.some((item) => item.toLocaleLowerCase("tr-TR") === clean.toLocaleLowerCase("tr-TR"))) {
      setNewCategory("");
      return;
    }

    setCategories((current) => [...current, clean].slice(0, 30));
    setNewCategory("");
  }

  function move(index: number, direction: -1 | 1) {
    const nextIndex = index + direction;
    if (nextIndex < 0 || nextIndex >= categories.length) return;

    setCategories((current) => {
      const copy = [...current];
      [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
      return copy;
    });
  }

  async function save() {
    setSaving(true);
    try {
      const response = await apiRequest("PUT", "/api/admin/homepage", { categories });
      const result = await response.json() as HomepageConfig;
      setCategories(result.categories || []);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["/api/admin/homepage"] }),
        queryClient.invalidateQueries({ queryKey: ["/api/public/homepage"] }),
      ]);
      toast({
        title: "Ana sayfa güncellendi",
        description: "Kategori alanı B2B ana sayfasında yayınlandı.",
      });
    } catch (error) {
      toast({
        title: "Kaydedilemedi",
        description: error instanceof Error ? error.message : "Ana sayfa ayarları kaydedilemedi",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-muted/20">
      <div className="mx-auto max-w-6xl p-5 sm:p-8">
        <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl border bg-background">
              <Home className="h-5 w-5" />
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight">Ana Sayfa</h1>
              <p className="text-sm text-muted-foreground">
                B2B web sitesinin ana sayfa bölümlerini buradan yönetin.
              </p>
            </div>
          </div>

          <Button onClick={save} disabled={saving || isLoading}>
            <Save className="mr-2 h-4 w-4" />
            {saving ? "Kaydediliyor…" : "Değişiklikleri Kaydet"}
          </Button>
        </div>

        <section className="rounded-2xl border bg-background shadow-sm">
          <div className="border-b p-5">
            <h2 className="font-bold">Kategoriler</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Buradaki sıralama B2B ana sayfasındaki ince kategori kutularına aynen yansır.
            </p>
          </div>

          <div className="p-5">
            <div className="flex max-w-xl gap-2">
              <Input
                value={newCategory}
                onChange={(event) => setNewCategory(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addCategory(newCategory);
                  }
                }}
                placeholder="Yeni kategori adı"
                maxLength={80}
              />
              <Button type="button" variant="outline" onClick={() => addCategory(newCategory)}>
                <Plus className="mr-2 h-4 w-4" />
                Ekle
              </Button>
            </div>

            <div className="mt-5 space-y-2">
              {isLoading ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Kategoriler yükleniyor…
                </div>
              ) : categories.length === 0 ? (
                <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
                  Henüz kategori eklenmedi.
                </div>
              ) : (
                categories.map((category, index) => (
                  <div
                    key={`${category}-${index}`}
                    className="flex items-center gap-2 rounded-xl border bg-muted/10 px-3 py-2"
                  >
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted text-xs font-bold">
                      {index + 1}
                    </div>

                    <Input
                      value={category}
                      onChange={(event) => {
                        const value = event.target.value;
                        setCategories((current) =>
                          current.map((item, itemIndex) => itemIndex === index ? value : item),
                        );
                      }}
                      className="h-9"
                    />

                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === 0}
                      onClick={() => move(index, -1)}
                      aria-label="Yukarı taşı"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      disabled={index === categories.length - 1}
                      onClick={() => move(index, 1)}
                      aria-label="Aşağı taşı"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setCategories((current) => current.filter((_, itemIndex) => itemIndex !== index))
                      }
                      aria-label="Kategoriyi sil"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            {suggestions.length > 0 ? (
              <div className="mt-6 border-t pt-5">
                <div className="text-sm font-semibold">Ürünlerden algılanan kategoriler</div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Ürünlerde kullanılan kategorileri tek tıkla ana sayfaya ekleyebilirsiniz.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {suggestions.map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => addCategory(category)}
                      className="inline-flex h-9 items-center rounded-lg border bg-background px-3 text-sm font-medium transition-colors hover:bg-muted"
                    >
                      <Plus className="mr-1.5 h-3.5 w-3.5" />
                      {category}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-7 rounded-xl border bg-[#f6f7f9] p-4">
              <div className="mb-3 text-sm font-bold">Ana sayfa önizlemesi</div>
              <div className="mb-3 text-lg font-black">Kategoriler</div>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {categories.length ? categories.map((category, index) => (
                  <div
                    key={`preview-${category}-${index}`}
                    className="flex h-10 min-w-[145px] shrink-0 items-center justify-center rounded-lg border bg-white px-4 text-sm font-semibold"
                  >
                    {category || "Kategori"}
                  </div>
                )) : (
                  <div className="text-sm text-muted-foreground">Kategori eklediğinizde burada görünür.</div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
