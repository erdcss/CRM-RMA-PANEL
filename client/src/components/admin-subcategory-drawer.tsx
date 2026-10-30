import { useState } from "react";
import { ChevronDown, ChevronUp, Image as ImageIcon, Plus, Tags, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export type HomeSubcategory = {
  id: string;
  name: string;
  imageId: string;
  tags: string[];
};

const normalized = (value: string) => value.trim().replace(/\s+/g, " ");
const keyFor = (value: string) => normalized(value).toLocaleLowerCase("tr-TR");

export function AdminSubcategoryDrawer({
  category, subcategories, availableTags, onChange, uploading, setUploading,
}: {
  category: string;
  subcategories: HomeSubcategory[];
  availableTags: string[];
  onChange: (updated: HomeSubcategory[]) => void;
  uploading: boolean;
  setUploading: (value: boolean) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");

  function patch(id: string, change: Partial<HomeSubcategory>) {
    onChange(subcategories.map(item => item.id === id ? { ...item, ...change } : item));
  }

  function add() {
    const name = normalized(newName).slice(0, 80);
    if (!name) {
      toast({ title: "Alt kategori adını girin", variant: "destructive" });
      return;
    }
    if (subcategories.some(item => keyFor(item.name) === keyFor(name))) {
      toast({ title: "Bu alt kategori zaten mevcut", variant: "destructive" });
      return;
    }
    if (subcategories.length >= 24) return;
    const id = Array.from(crypto.getRandomValues(new Uint8Array(12)))
      .map(value => value.toString(16).padStart(2, "0")).join("");
    onChange([...subcategories, { id, name, imageId: "", tags: [] }]);
    setNewName("");
    setOpen(true);
  }

  function updateTags(id: string, raw: string) {
    const tags: string[] = [];
    const seen = new Set<string>();
    for (const item of raw.split(",")) {
      const tag = normalized(item).slice(0, 60);
      if (!tag || seen.has(keyFor(tag))) continue;
      seen.add(keyFor(tag));
      tags.push(tag);
      if (tags.length === 30) break;
    }
    patch(id, { tags });
  }

  function toggleTag(item: HomeSubcategory, tag: string) {
    const isSelected = item.tags.some(value => keyFor(value) === keyFor(tag));
    updateTags(item.id, [...item.tags.filter(value => keyFor(value) !== keyFor(tag)), ...(isSelected ? [] : [tag])].join(", "));
  }

  async function uploadImage(id: string, file: File) {
    if (!["image/png", "image/jpeg", "image/webp", "image/gif"].includes(file.type) || file.size > 3 * 1024 * 1024) {
      toast({ title: "En fazla 3 MB PNG, JPG, WebP veya GIF yükleyin", variant: "destructive" });
      return;
    }
    setUploading(true);
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result || ""));
        reader.onerror = () => reject(new Error("Görsel okunamadı"));
        reader.readAsDataURL(file);
      });
      const response = await fetch("/api/admin/homepage/media", {
        method: "POST", credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dataUrl }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Görsel yüklenemedi");
      patch(id, { imageId: String(result.id) });
      toast({ title: "Görsel yüklendi", description: "Yayımlamak için Değişiklikleri Kaydet'e tıklayın." });
    } catch (error) {
      toast({ title: "Görsel yüklenemedi", description: error instanceof Error ? error.message : "Tekrar deneyin", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-slate-200 bg-background">
      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}
        aria-label={category + " alt kategorilerini " + (open ? "kapat" : "aç")}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-semibold hover:bg-muted/50">
        <span className="flex items-center gap-2"><Tags className="h-4 w-4" /> Alt kategoriler <span className="rounded-md bg-muted px-2 py-0.5 text-xs">{subcategories.length}</span></span>
        {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
      </button>
      {open && <div className="space-y-4 border-t p-4">
        <p className="text-xs text-muted-foreground">Alt kategori görseli ve ürün etiketlerini tanımlayın. Ürün bu etiketlerden en az birine sahipse webde otomatik görünür.</p>
        <div className="flex flex-wrap gap-2">
          <Input value={newName} onChange={event => setNewName(event.target.value)}
            onKeyDown={event => { if (event.key === "Enter") { event.preventDefault(); add(); } }}
            placeholder="Örn. Uydu Alıcıları" maxLength={80} className="min-w-0 flex-1" />
          <Button type="button" variant="outline" onClick={add} disabled={subcategories.length >= 24}>
            <Plus className="mr-1.5 h-4 w-4" /> Alt Kategori Ekle
          </Button>
        </div>
        {subcategories.length === 0 && <p className="rounded-lg border border-dashed p-5 text-center text-sm text-muted-foreground">Henüz alt kategori eklenmedi.</p>}
        {subcategories.map((item, index) => (
          <section key={item.id} className="space-y-3 rounded-xl border bg-muted/20 p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <strong className="text-sm">{index + 1}. {item.name}</strong>
              <Button type="button" size="sm" variant="ghost" className="text-destructive"
                onClick={() => onChange(subcategories.filter(other => other.id !== item.id))}>
                <Trash2 className="mr-1 h-4 w-4" /> Sil
              </Button>
            </div>
            <label className="block space-y-1 text-xs font-semibold">
              Alt kategori adı
              <Input value={item.name} maxLength={80} onChange={event => patch(item.id, { name: event.target.value })} />
            </label>
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-xl border bg-white">
                {item.imageId
                  ? <img src={"/api/public/homepage/media/" + item.imageId} alt={item.name} className="h-full w-full object-contain" />
                  : <ImageIcon className="h-7 w-7 text-slate-400" />}
              </div>
              <div className="flex flex-wrap gap-2">
                <label className="inline-flex cursor-pointer items-center rounded-lg border bg-background px-3 py-2 text-xs font-semibold hover:bg-muted">
                  {uploading ? "Yükleniyor..." : item.imageId ? "Görseli Değiştir" : "Görsel Ekle"}
                  <input className="hidden" type="file" accept="image/png,image/jpeg,image/webp,image/gif" disabled={uploading}
                    onChange={event => { const file = event.target.files?.[0]; if (file) void uploadImage(item.id, file); event.target.value = ""; }} />
                </label>
                {item.imageId && <Button type="button" size="sm" variant="ghost" onClick={() => patch(item.id, { imageId: "" })}>Görseli kaldır</Button>}
              </div>
            </div>
            <label className="block space-y-1 text-xs font-semibold">
              Ürün etiketleri (virgülle ayırın)
              <Input value={item.tags.join(", ")} onChange={event => updateTags(item.id, event.target.value)}
                placeholder="Örn. uydu alıcısı, mini uydu" />
            </label>
            {availableTags.length > 0 && <div>
              <p className="mb-2 text-xs text-muted-foreground">Ürünlerde mevcut etiketler — eklemek veya kaldırmak için seçin</p>
              <div className="flex max-h-36 flex-wrap gap-1.5 overflow-y-auto">
                {availableTags.map(tag => {
                  const selected = item.tags.some(value => keyFor(value) === keyFor(tag));
                  return <button key={tag} type="button" onClick={() => toggleTag(item, tag)}
                    aria-pressed={selected} className={"rounded-lg border px-2.5 py-1 text-xs transition-colors " +
                    (selected ? "border-slate-900 bg-slate-900 text-white" : "bg-background hover:bg-muted")}>{tag}</button>;
                })}
              </div>
            </div>}
          </section>
        ))}
      </div>}
    </div>
  );
}
