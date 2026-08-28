import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Warehouse } from "lucide-react";
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

interface WarehouseItem {
  id: number;
  name: string;
  code: string;
  address?: string;
}

const emptyForm = { name: "", code: "", address: "" };

export default function Depolar() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<WarehouseItem | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: warehouses = [], isLoading } = useQuery<WarehouseItem[]>({
    queryKey: ["/api/warehouses"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim(),
        code: form.code.trim().toLowerCase(),
        address: form.address.trim() || undefined,
      };
      if (editing) return apiRequest("PATCH", `/api/warehouses/${editing.id}`, payload);
      return apiRequest("POST", "/api/warehouses", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Başarılı", description: "Depo kaydedildi" });
      setOpen(false);
    },
    onError: (error: Error) => toast({ title: "Hata", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/warehouses/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/warehouses"] });
      toast({ title: "Başarılı", description: "Depo silindi" });
    },
    onError: (error: Error) => toast({ title: "Hata", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Depolar</h1>
          <p className="text-sm text-muted-foreground mt-1">RMA, satılabilir stok ve hurda depoları</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Yeni Depo
        </Button>
      </div>
      <main className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {isLoading ? <Skeleton className="h-24" /> : warehouses.map((warehouse) => (
          <Card key={warehouse.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <Warehouse className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base">{warehouse.name}</CardTitle>
                  <p className="text-xs font-mono text-muted-foreground">{warehouse.code}</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => {
                  setEditing(warehouse);
                  setForm({ name: warehouse.name, code: warehouse.code, address: warehouse.address || "" });
                  setOpen(true);
                }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => deleteMutation.mutate(warehouse.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            {warehouse.address && <CardContent className="text-sm text-muted-foreground">{warehouse.address}</CardContent>}
          </Card>
        ))}
      </main>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Depo Düzenle" : "Yeni Depo"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Ad</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></div>
            <div><Label>Kod</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="rma, satilabilir, hurda" /></div>
            <div><Label>Adres</Label><Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.name || !form.code || saveMutation.isPending}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
