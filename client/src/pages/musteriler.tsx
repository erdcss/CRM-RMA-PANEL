import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { User, Mail, Phone, MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  ticketCount?: number;
  createdAt: string;
}

const emptyForm = { name: "", phone: "", email: "", address: "" };

export default function Musteriler() {
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const { data: customers, isLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        name: form.name.trim() || "Bilinmeyen",
        phone: form.phone.trim() || "-",
        email: form.email.trim() || undefined,
        address: form.address.trim() || undefined,
      };
      if (editing) {
        return apiRequest("PATCH", `/api/customers/${editing.id}`, payload);
      }
      return apiRequest("POST", "/api/customers", payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Başarılı", description: editing ? "Müşteri güncellendi" : "Müşteri eklendi" });
      setDialogOpen(false);
    },
    onError: (error: Error) => {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => apiRequest("DELETE", `/api/customers/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({ title: "Başarılı", description: "Müşteri silindi" });
      setDeleteId(null);
    },
    onError: (error: Error) => {
      toast({ title: "Hata", description: error.message, variant: "destructive" });
    },
  });

  const filteredCustomers = (customers || []).filter((customer) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.phone.toLowerCase().includes(query) ||
      customer.email?.toLowerCase().includes(query)
    );
  });

  const openCreate = () => {
    setEditing(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (customer: Customer) => {
    setEditing(customer);
    setForm({
      name: customer.name || "",
      phone: customer.phone === "-" ? "" : customer.phone || "",
      email: customer.email || "",
      address: customer.address || "",
    });
    setDialogOpen(true);
  };

  return (
    <div className="flex flex-col h-full min-h-0">
      <div className="p-4 border-b">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Müşteriler</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Tüm müşteri kayıtları
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-lg px-4 py-2">
              {customers?.length || 0} Müşteri
            </Badge>
            <Button onClick={openCreate} data-testid="button-new-customer">
              <Plus className="h-4 w-4 mr-2" />
              Yeni Müşteri
            </Button>
          </div>
        </div>
      </div>

      <div className="p-6 border-b">
        <Input
          placeholder="Müşteri ara (isim, telefon, e-posta)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full"
          data-testid="input-search-customers"
        />
      </div>

      <main className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-6">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-48" />
            ))}
          </div>
        ) : filteredCustomers.length === 0 ? (
          <div className="text-center py-12">
            <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">
              {searchQuery ? "Müşteri bulunamadı" : "Henüz müşteri kaydı yok"}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6">
            {filteredCustomers.map((customer) => (
              <Card key={customer.id} className="hover-elevate">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                        <User className="h-6 w-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg" data-testid={`text-customer-name-${customer.id}`}>
                          {customer.name}
                        </CardTitle>
                        <CardDescription className="text-xs">
                          {new Date(customer.createdAt).toLocaleDateString("tr-TR")}
                        </CardDescription>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {customer.ticketCount !== undefined && customer.ticketCount > 0 && (
                        <Badge variant="secondary">
                          {customer.ticketCount} kayıt
                        </Badge>
                      )}
                      <Button variant="outline" size="icon" onClick={() => openEdit(customer)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="icon" onClick={() => setDeleteId(customer.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-mono">{customer.phone}</span>
                  </div>
                  {customer.email && (
                    <div className="flex items-center gap-2 text-sm">
                      <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate">{customer.email}</span>
                    </div>
                  )}
                  {customer.address && (
                    <div className="flex items-start gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                      <span className="text-muted-foreground line-clamp-2">
                        {customer.address}
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Müşteri Düzenle" : "Yeni Müşteri"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Ad Soyad</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div>
              <Label>Telefon</Label>
              <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </div>
            <div>
              <Label>E-posta</Label>
              <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div>
              <Label>Adres</Label>
              <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>İptal</Button>
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
              Kaydet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Müşteriyi sil?</AlertDialogTitle>
            <AlertDialogDescription>
              Fişi olan müşteriler silinemez.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>İptal</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>
              Sil
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
