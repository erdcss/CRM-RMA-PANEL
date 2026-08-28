import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Pencil, Trash2, Receipt } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Invoice {
  id: number;
  invoiceNumber: string;
  invoiceDate: string;
  notes?: string;
  customerId?: number;
  customer?: { id: number; name: string };
}

interface Customer {
  id: number;
  name: string;
}

const emptyForm = { invoiceNumber: "", customerId: "", invoiceDate: "", notes: "" };

export default function Faturalar() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: invoices = [], isLoading } = useQuery<Invoice[]>({
    queryKey: ["/api/invoices"],
  });
  const { data: customers = [] } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        invoiceNumber: form.invoiceNumber.trim(),
        customerId: form.customerId ? parseInt(form.customerId) : undefined,
        invoiceDate: form.invoiceDate || undefined,
        notes: form.notes.trim() || undefined,
      };
      if (editing) return apiRequest("PATCH", `/api/invoices/${editing.id}`, payload);
      return apiRequest("POST", "/api/invoices", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Başarılı", description: "Fatura kaydedildi" });
      setOpen(false);
    },
    onError: (error: Error) => toast({ title: "Hata", description: error.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/invoices/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/invoices"] });
      toast({ title: "Başarılı", description: "Fatura silindi" });
    },
    onError: (error: Error) => toast({ title: "Hata", description: error.message, variant: "destructive" }),
  });

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Faturalar</h1>
          <p className="text-sm text-muted-foreground mt-1">RMA kayıtlarına bağlanacak satış/fatura bilgileri</p>
        </div>
        <Button onClick={() => { setEditing(null); setForm(emptyForm); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Yeni Fatura
        </Button>
      </div>
      <main className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3">
        {isLoading ? <Skeleton className="h-24" /> : invoices.length === 0 ? (
          <p className="text-center text-muted-foreground py-12">Henüz fatura yok</p>
        ) : invoices.map((invoice) => (
          <Card key={invoice.id}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div className="flex items-center gap-3">
                <Receipt className="h-5 w-5 text-muted-foreground" />
                <div>
                  <CardTitle className="text-base font-mono">{invoice.invoiceNumber}</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    {invoice.customer?.name || "Müşteri seçilmedi"}
                    {" · "}
                    {new Date(invoice.invoiceDate).toLocaleDateString("tr-TR")}
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="icon" onClick={() => {
                  setEditing(invoice);
                  setForm({
                    invoiceNumber: invoice.invoiceNumber,
                    customerId: invoice.customerId ? String(invoice.customerId) : "",
                    invoiceDate: invoice.invoiceDate?.slice(0, 10) || "",
                    notes: invoice.notes || "",
                  });
                  setOpen(true);
                }}>
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="icon" onClick={() => deleteMutation.mutate(invoice.id)}>
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
          </Card>
        ))}
      </main>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Fatura Düzenle" : "Yeni Fatura"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label>Fatura No</Label><Input value={form.invoiceNumber} onChange={(e) => setForm({ ...form, invoiceNumber: e.target.value })} /></div>
            <div>
              <Label>Müşteri</Label>
              <Select value={form.customerId || "none"} onValueChange={(value) => setForm({ ...form, customerId: value === "none" ? "" : value })}>
                <SelectTrigger><SelectValue placeholder="Müşteri seçin" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Seçilmedi</SelectItem>
                  {customers.map((customer) => (
                    <SelectItem key={customer.id} value={String(customer.id)}>{customer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Tarih</Label><Input type="date" value={form.invoiceDate} onChange={(e) => setForm({ ...form, invoiceDate: e.target.value })} /></div>
            <div><Label>Not</Label><Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>İptal</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.invoiceNumber || saveMutation.isPending}>Kaydet</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
