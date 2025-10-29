import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, X, UserPlus } from "lucide-react";
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
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
  quantity: z.number().int().min(1, "Adet en az 1 olmalı"),
});

const ticketSchema = z.object({
  receiptNumber: z.string().optional(),
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

interface Customer {
  id: number;
  name: string;
  phone: string;
  email?: string;
  address?: string;
  ticketCount?: number;
}

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
      quantity: 1,
    },
  ]);
  const [activeAccordion, setActiveAccordion] = useState<string>("product-1");
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    enabled: customerDialogOpen,
  });

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      receiptNumber: "",
      customerName: "",
      phone: "",
      email: "",
      address: "",
    },
  });

  const selectCustomer = (customer: Customer) => {
    form.setValue("customerName", customer.name, { shouldValidate: true, shouldDirty: true });
    form.setValue("phone", customer.phone, { shouldValidate: true, shouldDirty: true });
    form.setValue("email", customer.email || "", { shouldValidate: true, shouldDirty: true });
    form.setValue("address", customer.address || "", { shouldValidate: true, shouldDirty: true });
    setCustomerDialogOpen(false);
    setCustomerSearchQuery("");
  };

  const filteredCustomers = customers.filter(
    (customer) =>
      customer.name.toLowerCase().includes(customerSearchQuery.toLowerCase()) ||
      customer.phone.includes(customerSearchQuery)
  );

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
          quantity: 1,
        },
      ]);
      setActiveAccordion("product-1");
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
    const newId = Date.now();
    setProducts([
      ...products,
      {
        id: newId,
        name: "",
        serialNumber: "",
        brand: "",
        model: "",
        category: "",
        description: "",
        quantity: 1,
      },
    ]);
    // Yeni ürünü otomatik olarak aç
    setActiveAccordion(`product-${newId}`);
  };

  const removeProduct = (id: number) => {
    if (products.length > 1) {
      setProducts(products.filter((p) => p.id !== id));
    }
  };

  const updateProduct = (id: number, field: string, value: string | number) => {
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
        quantity: product.quantity,
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
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">Müşteri Bilgileri</h3>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomerDialogOpen(true)}
                  data-testid="button-select-customer"
                >
                  <UserPlus className="h-4 w-4 mr-2" />
                  Müşteri Seç
                </Button>
              </div>
              <FormField
                control={form.control}
                name="receiptNumber"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Fiş Numarası</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="Örn: FIS-2025-001" data-testid="input-receipt-number" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
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

              <Accordion
                type="single"
                collapsible
                value={activeAccordion}
                onValueChange={setActiveAccordion}
              >
                {products.map((product, index) => (
                  <AccordionItem
                    key={product.id}
                    value={`product-${product.id}`}
                  >
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center justify-between w-full pr-4">
                        <span className="font-medium">
                          Ürün {index + 1}
                          {product.name && `: ${product.name}`}
                          {product.brand && ` - ${product.brand}`}
                        </span>
                        {products.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeProduct(product.id);
                            }}
                            data-testid={`button-remove-product-${index}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="pt-4 grid grid-cols-2 gap-4">
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
                    <div>
                      <label className="text-sm font-medium mb-2 block">
                        Adet *
                      </label>
                      <Input
                        type="number"
                        min="1"
                        value={product.quantity}
                        onChange={(e) =>
                          updateProduct(product.id, "quantity", parseInt(e.target.value) || 1)
                        }
                        data-testid={`input-quantity-${index}`}
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
                    </AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
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

      {/* Müşteri Seçimi Dialogu */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>Müşteri Seç</DialogTitle>
            <DialogDescription>
              Kayıtlı müşterilerden birini seçin
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Input
              placeholder="Müşteri adı veya telefon ile ara..."
              value={customerSearchQuery}
              onChange={(e) => setCustomerSearchQuery(e.target.value)}
              data-testid="input-search-customer"
            />
            
            <div className="max-h-96 overflow-y-auto space-y-2">
              {customersLoading ? (
                <div className="space-y-2">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-24 w-full" />
                  ))}
                </div>
              ) : filteredCustomers.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Müşteri bulunamadı
                </p>
              ) : (
                filteredCustomers.map((customer) => (
                  <div
                    key={customer.id}
                    className="p-4 border rounded-lg hover-elevate cursor-pointer"
                    onClick={() => selectCustomer(customer)}
                    data-testid={`customer-item-${customer.id}`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-semibold">{customer.name}</p>
                        <p className="text-sm text-muted-foreground font-mono">
                          {customer.phone}
                        </p>
                        {customer.email && (
                          <p className="text-sm text-muted-foreground">
                            {customer.email}
                          </p>
                        )}
                        {customer.address && (
                          <p className="text-sm text-muted-foreground">
                            {customer.address}
                          </p>
                        )}
                      </div>
                      {customer.ticketCount !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {customer.ticketCount} kayıt
                        </span>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setCustomerDialogOpen(false);
                setCustomerSearchQuery("");
              }}
              data-testid="button-close-customer-dialog"
            >
              İptal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
