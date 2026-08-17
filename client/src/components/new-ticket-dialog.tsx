import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, UserPlus, ChevronDown, ChevronLeft } from "lucide-react";
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
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { ProductImagePicker } from "@/components/product-image-picker";

const ticketSchema = z.object({
  receiptNumber: z.string().optional(),
  customerName: z.string().optional(),
  phone: z.string().optional(),
  email: z
    .string()
    .optional()
    .refine(
      (val) => !val || val.trim() === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val.trim()),
      "Geçerli e-posta adresi girin"
    ),
  address: z.string().optional(),
});

type TicketFormData = z.infer<typeof ticketSchema>;

type ProductDraft = {
  id: number;
  name: string;
  serialNumber: string;
  brand: string;
  model: string;
  category: "iade" | "degisim" | "servis" | "";
  description: string;
  quantity: number;
  imageUrl?: string;
};

type TicketSubmission = TicketFormData & {
  products: Array<{
    name?: string;
    serialNumber?: string;
    brand?: string;
    model?: string;
    category?: "iade" | "degisim" | "servis";
    description?: string;
    quantity?: number;
    imageUrl?: string;
  }>;
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

const emptyProduct = (id: number): ProductDraft => ({
  id,
  name: "",
  serialNumber: "",
  brand: "",
  model: "",
  category: "",
  description: "",
  quantity: 1,
  imageUrl: undefined,
});

export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductDraft[]>([emptyProduct(1)]);
  const [activeAccordion, setActiveAccordion] = useState<string>("product-1");
  const [customerPickerOpen, setCustomerPickerOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const [customerInfoOpen, setCustomerInfoOpen] = useState(true);

  const { data: customers = [], isLoading: customersLoading } = useQuery<Customer[]>({
    queryKey: ["/api/customers"],
    enabled: open && customerPickerOpen,
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

  const resetForm = () => {
    form.reset();
    setProducts([emptyProduct(1)]);
    setActiveAccordion("product-1");
    setCustomerPickerOpen(false);
    setCustomerSearchQuery("");
    setCustomerInfoOpen(true);
  };

  const selectCustomer = (customer: Customer) => {
    form.setValue("customerName", customer.name, { shouldValidate: true, shouldDirty: true });
    form.setValue("phone", customer.phone === "-" ? "" : customer.phone, { shouldValidate: true, shouldDirty: true });
    form.setValue("email", customer.email || "", { shouldValidate: true, shouldDirty: true });
    form.setValue("address", customer.address || "", { shouldValidate: true, shouldDirty: true });
    setCustomerPickerOpen(false);
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
      queryClient.invalidateQueries({ queryKey: ["/api/customers"] });
      toast({
        title: "Başarılı",
        description: "Fiş başarıyla kaydedildi",
      });
      onOpenChange(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast({
        title: "Hata",
        description: error.message || "Kayıt oluşturulamadı",
        variant: "destructive",
      });
    },
  });

  const addProduct = () => {
    const newId = Date.now();
    setProducts((prev) => [...prev, emptyProduct(newId)]);
    setActiveAccordion(`product-${newId}`);
  };

  const removeProduct = (id: number) => {
    setProducts((prev) => {
      if (prev.length <= 1) return prev;
      return prev.filter((p) => p.id !== id);
    });
  };

  const updateProduct = (id: number, field: keyof ProductDraft, value: string | number | undefined) => {
    setProducts((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [field]: value } : p))
    );
  };

  const onInvalid = () => {
    setCustomerInfoOpen(true);
    toast({
      title: "Form hatası",
      description: "Lütfen e-posta alanını kontrol edin veya boş bırakın",
      variant: "destructive",
    });
  };

  const onSubmit = (data: TicketFormData) => {
    const validatedProducts = products
      .map((product) => ({
        name: product.name.trim() || undefined,
        serialNumber: product.serialNumber.trim() || undefined,
        brand: product.brand.trim() || undefined,
        model: product.model.trim() || undefined,
        category: product.category || undefined,
        description: product.description.trim() || undefined,
        quantity: product.quantity || undefined,
        imageUrl: product.imageUrl || undefined,
      }))
      .filter((p) =>
        p.name || p.serialNumber || p.brand || p.model || p.category || p.description || p.imageUrl
      );

    createTicketMutation.mutate({
      ...data,
      customerName: data.customerName?.trim() || undefined,
      phone: data.phone?.trim() || undefined,
      email: typeof data.email === "string" ? data.email.trim() || undefined : undefined,
      address: data.address?.trim() || undefined,
      products: validatedProducts,
    });
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setCustomerPickerOpen(false);
      setCustomerSearchQuery("");
    }
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-3xl flex flex-col gap-0 p-0 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0 px-4 pt-4 pr-12 sm:px-0 sm:pt-0 sm:pr-8">
          <DialogTitle>{customerPickerOpen ? "Müşteri Seç" : "Yeni Fiş Oluştur"}</DialogTitle>
          <DialogDescription>
            {customerPickerOpen
              ? "Kayıtlı müşterilerden birini seçin"
              : "Müşteri ve ürün bilgilerini girin"}
          </DialogDescription>
        </DialogHeader>

        {customerPickerOpen ? (
          <div className="flex-1 min-h-0 flex flex-col px-4 sm:px-0 pt-4">
            <Input
              placeholder="Müşteri adı veya telefon ile ara..."
              value={customerSearchQuery}
              onChange={(e) => setCustomerSearchQuery(e.target.value)}
              data-testid="input-search-customer"
              className="shrink-0"
            />
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain mt-4 space-y-2 pb-4">
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
                  <button
                    type="button"
                    key={customer.id}
                    className="w-full text-left p-4 border rounded-lg hover-elevate"
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
                  </button>
                ))
              )}
            </div>
            <DialogFooter className="shrink-0 border-t pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:border-0 sm:pb-0">
              <Button
                variant="outline"
                onClick={() => {
                  setCustomerPickerOpen(false);
                  setCustomerSearchQuery("");
                }}
                data-testid="button-close-customer-dialog"
              >
                <ChevronLeft className="h-4 w-4 mr-2" />
                Geri
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit, onInvalid)}
              className="flex-1 min-h-0 flex flex-col"
              autoComplete="off"
            >
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 sm:px-0 pt-4 space-y-6">
                <Collapsible
                  open={customerInfoOpen}
                  onOpenChange={setCustomerInfoOpen}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between gap-2">
                    <CollapsibleTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="p-0 hover:bg-transparent"
                        data-testid="button-toggle-customer-info"
                      >
                        <h3 className="font-semibold flex items-center gap-2">
                          Müşteri Bilgileri
                          <ChevronDown
                            className={`h-4 w-4 transition-transform ${
                              customerInfoOpen ? "" : "-rotate-90"
                            }`}
                          />
                        </h3>
                      </Button>
                    </CollapsibleTrigger>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomerPickerOpen(true)}
                      data-testid="button-select-customer"
                    >
                      <UserPlus className="h-4 w-4 mr-2" />
                      Müşteri Seç
                    </Button>
                  </div>
                  <CollapsibleContent className="space-y-4">
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
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <FormField
                        control={form.control}
                        name="customerName"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Müşteri Adı</FormLabel>
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
                            <FormLabel>Telefon</FormLabel>
                            <FormControl>
                              <Input {...field} inputMode="tel" data-testid="input-phone" />
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
                              <Input type="email" {...field} value={field.value ?? ""} data-testid="input-email" />
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
                  </CollapsibleContent>
                </Collapsible>

                <div className="space-y-4 pb-2">
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
                          <div className="flex items-center justify-between w-full pr-4 gap-2">
                            <span className="font-medium truncate">
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
                          <div className="pt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div>
                              <label className="text-sm font-medium mb-2 block">
                                Ürün Adı
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
                                Marka
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
                                Adet
                              </label>
                              <Input
                                type="number"
                                min="1"
                                inputMode="numeric"
                                value={product.quantity}
                                onChange={(e) =>
                                  updateProduct(product.id, "quantity", parseInt(e.target.value) || 1)
                                }
                                data-testid={`input-quantity-${index}`}
                              />
                            </div>
                            <div>
                              <label className="text-sm font-medium mb-2 block">
                                Durum
                              </label>
                              <Select
                                value={product.category || undefined}
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
                            <ProductImagePicker
                              imageUrl={product.imageUrl}
                              onChange={(url) => updateProduct(product.id, "imageUrl", url)}
                              testId={`input-product-image-${index}`}
                            />
                            <div className="sm:col-span-2">
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
              </div>

              <DialogFooter className="shrink-0 border-t mx-4 sm:mx-0 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-0 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleOpenChange(false)}
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
        )}
      </DialogContent>
    </Dialog>
  );
}
