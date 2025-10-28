import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { Plus, Trash2, X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

const productSchema = z.object({
  name: z.string().min(1, "Ürün adı gerekli"),
  serialNumber: z.string().optional(),
  brand: z.string().min(1, "Marka gerekli"),
  model: z.string().optional(),
  category: z.enum(["iade", "degisim", "servis"], {
    required_error: "Durum seçimi gerekli",
  }),
  description: z.string().optional(),
});

const ticketSchema = z.object({
  customerName: z.string().min(1, "Müşteri adı gerekli"),
  phone: z.string().min(1, "Telefon gerekli"),
  email: z.string().email("Geçerli e-posta adresi girin").optional().or(z.literal("")),
  address: z.string().optional(),
});

type TicketFormData = z.infer<typeof ticketSchema>;

// Type for the full ticket submission including validated products
type TicketSubmission = TicketFormData & {
  products: z.infer<typeof productSchema>[];
};

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState([
    {
      id: 1,
      name: "",
      serialNumber: "",
      brand: "",
      model: "",
      category: "" as "iade" | "degisim" | "servis" | "",
      description: "",
    },
  ]);

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      customerName: "",
      phone: "",
      email: "",
      address: "",
    },
  });

  const createTicketMutation = useMutation({
    mutationFn: async (data: TicketSubmission) => {
      return await apiRequest("POST", "/api/tickets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/dashboard"] });
      toast({
        title: "Başarılı",
        description: "Kayıt başarıyla oluşturuldu",
      });
      onOpenChange(false);
      form.reset();
      setProducts([
        {
          id: 1,
          name: "",
          serialNumber: "",
          brand: "",
          model: "",
          category: "",
          description: "",
        },
      ]);
    },
    onError: () => {
      toast({
        title: "Hata",
        description: "Kayıt oluşturulamadı",
        variant: "destructive",
      });
    },
  });

  const addProduct = () => {
    setProducts([
      ...products,
      {
        id: Date.now(),
        name: "",
        serialNumber: "",
        brand: "",
        model: "",
        category: "",
        description: "",
      },
    ]);
  };

  const removeProduct = (id: number) => {
    if (products.length > 1) {
      setProducts(products.filter((p) => p.id !== id));
    }
  };

  const updateProduct = (id: number, field: string, value: string) => {
    setProducts(
      products.map((p) =>
        p.id === id ? { ...p, [field]: value } : p
      )
    );
  };

  const onSubmit = (data: TicketFormData) => {
    // Validate products manually since they're in separate state
    if (products.length === 0 || products.every(p => !p.name && !p.brand && !p.category)) {
      toast({
        title: "Hata",
        description: "En az bir ürün bilgisi doldurun",
        variant: "destructive",
      });
      return;
    }

    // Validate each product using the schema
    const validationErrors: string[] = [];
    const validatedProducts = products.map((product, index) => {
      const productData = {
        name: product.name,
        serialNumber: product.serialNumber || undefined,
        brand: product.brand,
        model: product.model || undefined,
        category: product.category,
        description: product.description || undefined,
      };

      const result = productSchema.safeParse(productData);
      if (!result.success) {
        const errors = result.error.errors.map(e => e.message).join(", ");
        validationErrors.push(`Ürün ${index + 1}: ${errors}`);
        return null;
      }
      return result.data;
    }).filter((p): p is NonNullable<typeof p> => p !== null);

    if (validationErrors.length > 0) {
      toast({
        title: "Ürün Bilgileri Eksik",
        description: validationErrors.join(" | "),
        variant: "destructive",
      });
      return;
    }

    if (validatedProducts.length === 0) {
      toast({
        title: "Hata",
        description: "En az bir geçerli ürün ekleyin",
        variant: "destructive",
      });
      return;
    }

    const formData = {
      ...data,
      products: validatedProducts,
    };

    createTicketMutation.mutate(formData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Kayıt Oluştur</DialogTitle>
          <DialogDescription>
            Müşteri ve ürün bilgilerini girin
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="space-y-4">
              <h3 className="font-semibold">Müşteri Bilgileri</h3>
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="customerName"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Müşteri Adı *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-customer-name" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Telefon *</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-phone" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>E-posta</FormLabel>
                      <FormControl>
                        <Input type="email" {...field} data-testid="input-email" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="address"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Adres</FormLabel>
                      <FormControl>
                        <Input {...field} data-testid="input-address" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Ürün Bilgileri</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addProduct}
                  data-testid="button-add-product"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Ürün Ekle
                </Button>
              </div>

              {products.map((product, index) => (
                <div
                  key={product.id}
                  className="p-4 border rounded-lg space-y-4 relative"
                >
                  {products.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="absolute top-2 right-2"
                      onClick={() => removeProduct(product.id)}
                      data-testid={`button-remove-product-${index}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Ürün Adı *
                      </label>
                      <Input
                        value={product.name}
                        onChange={(e) =>
                          updateProduct(product.id, "name", e.target.value)
                        }
                        data-testid={`input-product-name-${index}`}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Seri Numarası
                      </label>
                      <Input
                        value={product.serialNumber}
                        onChange={(e) =>
                          updateProduct(product.id, "serialNumber", e.target.value)
                        }
                        className="font-mono"
                        data-testid={`input-serial-${index}`}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Marka *
                      </label>
                      <Input
                        value={product.brand}
                        onChange={(e) =>
                          updateProduct(product.id, "brand", e.target.value)
                        }
                        data-testid={`input-brand-${index}`}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Model
                      </label>
                      <Input
                        value={product.model}
                        onChange={(e) =>
                          updateProduct(product.id, "model", e.target.value)
                        }
                        data-testid={`input-model-${index}`}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium mb-2 block">
                        Durum *
                      </label>
                      <Select
                        value={product.category}
                        onValueChange={(value) =>
                          updateProduct(product.id, "category", value)
                        }
                      >
                        <SelectTrigger data-testid={`select-category-${index}`}>
                          <SelectValue placeholder="Durum seçin" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="iade">İade</SelectItem>
                          <SelectItem value="degisim">Değişim</SelectItem>
                          <SelectItem value="servis">Servise Gidecek</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="col-span-2">
                      <label className="text-sm font-medium mb-2 block">
                        Açıklama
                      </label>
                      <Textarea
                        value={product.description}
                        onChange={(e) =>
                          updateProduct(product.id, "description", e.target.value)
                        }
                        rows={3}
                        data-testid={`input-description-${index}`}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
              >
                İptal
              </Button>
              <Button
                type="submit"
                disabled={createTicketMutation.isPending}
                data-testid="button-submit-ticket"
              >
                {createTicketMutation.isPending ? "Kaydediliyor..." : "Kaydet"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
