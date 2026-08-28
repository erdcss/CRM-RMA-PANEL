import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Supplier {
  id: number;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  notes?: string;
}

const emptyForm = { name: "", phone: "", email: "", address: "", notes: "" };

export default function Tedarikciler() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supplier | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: suppliers = [], isLoading } = useQuery<Supplier[]>({
    queryKey: ["/api/suppliers"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim() || undefined,
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editing) return apiRequest("PATCH", `/api/suppliers/${editing.id}`, payload);
      return apiRequest("POST", "/api/suppliers", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Başarılı", description: "Tedarikçi kaydedildi" });
      setOpen(false);
    },
    onError: (error: Error) => toast({ title: "Hata", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/suppliers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/suppliers"] });
      toast({ title: "Başarılı", description: "Tedarikçi silindi" });
    },
    onError: (error: Error) => toast({ title: "Hata", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tedarikçiler</h1>
          <p className="text-sm text-muted-foreground mt-1">RMA ürünlerinin gönderileceği tedarikçiler</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Yeni Tedarikçi
        </Button>
      </div>
      <main className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {isLoading ? <Skeleton className="h-24" /> : suppliers.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Henüz tedarikçi yok</p>
        ) : suppliers.map((supplier) => (
          <Card key={supplier.id}>
            <CardHeader className="flex flex-row items-start justify-between space-y-0">
              <div className="flex items-center gap-3">
                <Truck className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">{supplier.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{supplier.phone || supplier.email || "İletişim bilgisi yok"}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => {
                  setEditing(supplier);
                  setForm({
                    name: supplier.name,
                    phone: supplier.phone || "",
                    email: supplier.email || "",
                    address: supplier.address || "",
                    notes: supplier.notes || "",
                  });
                  setOpen(true);
                }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => deleteMutation.mutate(supplier.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            {(supplier.address || supplier.notes) && (
              <CardContent className="text-sm text-muted-foreground space-y-1">
                {supplier.address && <p>{supplier.address}</p>}
                {supplier.notes && <p>{supplier.notes}</p>}
              </CardContent>
            )}
          </Card>
        ))}
      </main>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Tedarikçi Düzenle" : "Yeni Tedarikçi"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Ad</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Telefon</Label><Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} /></div>
            <div><Label>E-posta</Label><Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><Label>Adres</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
            <div><Label>Not</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || saveMutation.isPending}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
