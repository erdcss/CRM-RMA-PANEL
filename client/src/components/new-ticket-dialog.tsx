import { useState, useEffect, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { keepPreviousData, useMutation, useQuery } from "@tanstack/react-query";
import { Plus, Trash2, UserPlus, ChevronDown, Package, Loader2, ListPlus, X } from "lucide-react";
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
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  RMA_OPERATION_TYPES,
  RMA_DEFAULT_OPERATION_TYPE,
} from "@shared/rma-constants";

function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);
  return debounced;
}

function PickerResults({
  loading,
  isEmpty,
  emptyMessage,
  countLabel,
  children,
}: {
  loading: boolean;
  isEmpty: boolean;
  emptyMessage: string;
  countLabel?: string;
  children: ReactNode;
}) {
  return (
    <div className="relative flex-1 min-h-[220px] max-h-[min(420px,52dvh)] shrink-0 overflow-hidden rounded-md border bg-background">
      {loading ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/70">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : null}
      {countLabel && !loading && !isEmpty ? (
        <div className="absolute top-0 inset-x-0 z-[1] border-b bg-background/95 px-3 py-1.5 text-xs text-muted-foreground">
          {countLabel}
        </div>
      ) : null}
      <div className={`h-full overflow-y-auto overscroll-contain p-2 space-y-2 ${countLabel && !isEmpty ? "pt-9" : ""}`}>
        {isEmpty ? (
          <p className="text-center text-muted-foreground py-12 px-4 text-sm">{emptyMessage}</p>
        ) : (
          children
        )}
      </div>
    </div>
  );
}

const pickerDialogClass =
  "w-[calc(100vw-1.5rem)] max-w-2xl h-[min(560px,92dvh)] max-h-[92dvh] flex flex-col overflow-hidden gap-0 p-4 sm:p-6";

const mainDialogClass =
  "w-[calc(100vw-1.5rem)] max-w-3xl h-[min(900px,92dvh)] max-h-[92dvh] flex flex-col overflow-hidden gap-0 p-4 sm:p-6";

const productSchema = z.object({
  catalogProductId: z.number().int().optional(),
  name: z.string().optional(),
  serialNumber: z.string().optional(),
  stockCode: z.string().optional(),
  barcode: z.string().optional(),
  brand: z.string().optional(),
  model: z.string().optional(),
  category: z.enum(["iade", "degisim", "servis"]).optional(),
  defectReason: z.string().optional(),
  description: z.string().optional(),
  quantity: z.number().int().optional(),
});

const ticketSchema = z.object({
  receiptNumber: z.string().optional(),
  operationType: z.enum(["iade", "degisim", "servis"]),
  customerName: z.string().optional(),
  accountCode: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email("Geçerli e-posta adresi girin").optional().or(z.literal("")),
  address: z.string().optional(),
  invoiceNumber: z.string().optional(),
  salesId: z.string().optional(),
});

type TicketFormData = z.infer<typeof ticketSchema>;

// Type for the full ticket submission including validated products
type TicketSubmission = TicketFormData & {
  catalogCustomerId?: number;
  products: z.infer<typeof productSchema>[];
};

interface CatalogCustomer {
  id: number;
  accountCode: string;
  accountName: string;
}

interface CatalogProduct {
  id: number;
  stockCode: string;
  stockName: string;
  stock_code?: string;
  stock_name?: string;
}

function normalizeCatalogProduct(item: CatalogProduct) {
  return {
    stockCode: String(item.stockCode ?? item.stock_code ?? "").trim(),
    stockName: String(item.stockName ?? item.stock_name ?? "").trim(),
  };
}

type ProductRow = {
  id: number;
  catalogProductId?: number;
  name: string;
  serialNumber: string;
  stockCode: string;
  barcode: string;
  brand: string;
  model: string;
  category: "iade" | "degisim" | "servis" | "";
  defectReason: string;
  description: string;
  quantity: number;
};

type BulkStagingItem = {
  catalogId: number;
  stockCode: string;
  name: string;
  quantity: number;
};

function getProductAccordionTitle(product: ProductRow, index: number) {
  const name = product.name.trim();
  const stockCode = product.stockCode.trim();
  if (name) return name;
  if (stockCode) return stockCode;
  return `Ürün ${index + 1}`;
}

function isEmptyProductRow(product: ProductRow) {
  return (
    !product.name.trim() &&
    !product.stockCode.trim() &&
    !product.serialNumber.trim() &&
    !product.brand.trim() &&
    !product.model.trim() &&
    !product.description.trim()
  );
}

interface NewTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function NewTicketDialog({ open, onOpenChange }: NewTicketDialogProps) {
  const { toast } = useToast();
  const [products, setProducts] = useState<ProductRow[]>([
    {
      id: 1,
      catalogProductId: undefined,
      name: "",
      serialNumber: "",
      stockCode: "",
      barcode: "",
      brand: "",
      model: "",
      category: "" as "iade" | "degisim" | "servis" | "",
      defectReason: "",
      description: "",
      quantity: 1,
    },
  ]);
  const [activeAccordion, setActiveAccordion] = useState<string>("product-1");
  const [customerDialogOpen, setCustomerDialogOpen] = useState(false);
  const [customerSearchQuery, setCustomerSearchQuery] = useState("");
  const debouncedCustomerQuery = useDebouncedValue(customerSearchQuery.trim(), 300);
  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [productSearchQuery, setProductSearchQuery] = useState("");
  const debouncedProductQuery = useDebouncedValue(productSearchQuery.trim(), 300);
  const [productPickerTargetId, setProductPickerTargetId] = useState<number | null>(null);
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
  const [bulkSearchQuery, setBulkSearchQuery] = useState("");
  const debouncedBulkQuery = useDebouncedValue(bulkSearchQuery.trim(), 300);
  const [bulkStaging, setBulkStaging] = useState<BulkStagingItem[]>([]);
  const [pendingBulkProduct, setPendingBulkProduct] = useState<CatalogProduct | null>(null);
  const [pendingBulkQuantity, setPendingBulkQuantity] = useState("1");
  const [catalogCustomerId, setCatalogCustomerId] = useState<number | null>(null);
  const [customerInfoOpen, setCustomerInfoOpen] = useState(true);

  const customerQueryPath =
    debouncedCustomerQuery.length > 0
      ? `/api/catalog-customers?q=${encodeURIComponent(debouncedCustomerQuery)}`
      : "/api/catalog-customers";

  const {
    data: catalogCustomers = [],
    isFetching: customersFetching,
    isLoading: customersLoading,
  } = useQuery<CatalogCustomer[]>({
    queryKey: [customerQueryPath],
    enabled: customerDialogOpen,
    placeholderData: keepPreviousData,
  });

  const productQueryPath =
    debouncedProductQuery.length > 0
      ? `/api/catalog-products?q=${encodeURIComponent(debouncedProductQuery)}`
      : "/api/catalog-products";

  const {
    data: catalogProducts = [],
    isFetching: productsFetching,
    isLoading: productsLoading,
  } = useQuery<CatalogProduct[]>({
    queryKey: [productQueryPath],
    enabled: productDialogOpen,
    placeholderData: keepPreviousData,
  });

  const customersBusy = customersLoading || customersFetching;
  const productsBusy = productsLoading || productsFetching;

  const bulkQueryPath =
    debouncedBulkQuery.length > 0
      ? `/api/catalog-products?q=${encodeURIComponent(debouncedBulkQuery)}`
      : "/api/catalog-products";

  const {
    data: bulkCatalogProducts = [],
    isFetching: bulkProductsFetching,
    isLoading: bulkProductsLoading,
  } = useQuery<CatalogProduct[]>({
    queryKey: [bulkQueryPath],
    enabled: bulkDialogOpen,
    placeholderData: keepPreviousData,
  });

  const bulkProductsBusy = bulkProductsLoading || bulkProductsFetching;

  const form = useForm<TicketFormData>({
    resolver: zodResolver(ticketSchema),
    defaultValues: {
      receiptNumber: "",
      operationType: RMA_DEFAULT_OPERATION_TYPE,
      customerName: "",
      accountCode: "",
      phone: "",
      email: "",
      address: "",
      invoiceNumber: "",
      salesId: "",
    },
  });

  const operationType = form.watch("operationType");

  const selectCustomer = (customer: CatalogCustomer) => {
    form.setValue("customerName", customer.accountName, { shouldValidate: true, shouldDirty: true });
    form.setValue("accountCode", customer.accountCode, { shouldValidate: true, shouldDirty: true });
    form.setValue("phone", "", { shouldValidate: true, shouldDirty: true });
    form.setValue("email", "", { shouldValidate: true, shouldDirty: true });
    form.setValue("address", "", { shouldValidate: true, shouldDirty: true });
    setCatalogCustomerId(customer.id);
    setCustomerDialogOpen(false);
    setCustomerSearchQuery("");
  };

  const openProductPicker = (productId: number) => {
    setProductPickerTargetId(productId);
    setActiveAccordion(`product-${productId}`);
    setProductSearchQuery("");
    setProductDialogOpen(true);
  };

  const openCustomerPicker = () => {
    setCustomerSearchQuery("");
    setCustomerDialogOpen(true);
  };

  const openBulkProductPicker = () => {
    setBulkSearchQuery("");
    setBulkStaging([]);
    setPendingBulkProduct(null);
    setPendingBulkQuantity("1");
    setBulkDialogOpen(true);
  };

  const closeBulkProductPicker = () => {
    setBulkDialogOpen(false);
    setBulkSearchQuery("");
    setBulkStaging([]);
    setPendingBulkProduct(null);
    setPendingBulkQuantity("1");
  };

  const pickBulkProduct = (item: CatalogProduct) => {
    setPendingBulkProduct(item);
    setPendingBulkQuantity("1");
  };

  const addToBulkStaging = () => {
    if (!pendingBulkProduct) return;

    const quantity = Math.max(1, parseInt(pendingBulkQuantity, 10) || 1);
    const { stockCode, stockName } = normalizeCatalogProduct(pendingBulkProduct);

    setBulkStaging((current) => {
      const existingIndex = current.findIndex((item) => item.catalogId === pendingBulkProduct.id);
      if (existingIndex >= 0) {
        return current.map((item, index) =>
          index === existingIndex
            ? { ...item, quantity: item.quantity + quantity }
            : item,
        );
      }
      return [
        ...current,
        {
          catalogId: pendingBulkProduct.id,
          stockCode,
          name: stockName || stockCode,
          quantity,
        },
      ];
    });

    setPendingBulkProduct(null);
    setPendingBulkQuantity("1");
  };

  const removeFromBulkStaging = (catalogId: number) => {
    setBulkStaging((current) => current.filter((item) => item.catalogId !== catalogId));
  };

  const commitBulkProducts = () => {
    if (bulkStaging.length === 0) return;

    const baseId = Date.now();
    const newRows: ProductRow[] = bulkStaging.map((item, index) => ({
      id: baseId + index,
      catalogProductId: item.catalogId,
      name: item.name,
      stockCode: item.stockCode,
      serialNumber: "",
      barcode: "",
      brand: "",
      model: "",
      category: operationType || "",
      defectReason: "",
      description: "",
      quantity: item.quantity,
    }));

    const onlyEmptyDefault = products.length === 1 && isEmptyProductRow(products[0]);
    setProducts(onlyEmptyDefault ? newRows : [...products, ...newRows]);
    setActiveAccordion(`product-${newRows[0].id}`);
    closeBulkProductPicker();

    toast({
      title: "Ürünler eklendi",
      description: `${newRows.length} ürün kayda eklendi`,
    });
  };

  const selectProduct = (item: CatalogProduct) => {
    const targetId = productPickerTargetId;
    if (targetId === null) return;

    const { stockCode, stockName } = normalizeCatalogProduct(item);

    setProducts((current) =>
      current.map((p) =>
        p.id === targetId
          ? { ...p, catalogProductId: item.id, stockCode, name: stockName || p.name }
          : p,
      ),
    );
    setActiveAccordion(`product-${targetId}`);
    setProductDialogOpen(false);
    setProductSearchQuery("");
    setProductPickerTargetId(null);
  };

  const createTicketMutation = useMutation({
    mutationFn: async (data: TicketSubmission) => {
      return await apiRequest("POST", "/api/tickets", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tickets"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats/dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stats"] });
      toast({
        title: "Başarılı",
        description: "Kayıt başarıyla oluşturuldu",
      });
      onOpenChange(false);
      form.reset();
      setProducts([
        {
          id: 1,
          catalogProductId: undefined,
          name: "",
          serialNumber: "",
          stockCode: "",
          barcode: "",
          brand: "",
          model: "",
          category: "",
          defectReason: "",
          description: "",
          quantity: 1,
        },
      ]);
      setCatalogCustomerId(null);
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
        catalogProductId: undefined,
        name: "",
        serialNumber: "",
        stockCode: "",
        barcode: "",
        brand: "",
        model: "",
        category: operationType || "",
        defectReason: "",
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
    // Prepare products - convert empty strings to undefined
    const validatedProducts = products.map((product) => {
      return {
        catalogProductId: product.catalogProductId,
        name: product.name || undefined,
        serialNumber: product.serialNumber || undefined,
        stockCode: product.stockCode || undefined,
        barcode: product.barcode || undefined,
        brand: product.brand || undefined,
        model: product.model || undefined,
        category: product.category || data.operationType,
        defectReason: product.defectReason || undefined,
        description: product.description || undefined,
        quantity: product.quantity || undefined,
      };
    }).filter((p) =>
      p.name || p.serialNumber || p.stockCode || p.barcode || p.brand || p.model || p.category || p.defectReason || p.description || p.quantity
    );

    const formData: TicketSubmission = {
      ...data,
      catalogCustomerId: catalogCustomerId ?? undefined,
      customerName: data.customerName || undefined,
      accountCode: data.accountCode || undefined,
      phone: data.phone || undefined,
      email: data.email || undefined,
      address: data.address || undefined,
      invoiceNumber: data.invoiceNumber || undefined,
      salesId: data.salesId || undefined,
      products: validatedProducts,
    };

    createTicketMutation.mutate(formData);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={mainDialogClass}>
        <DialogHeader className="shrink-0 pr-8">
          <DialogTitle className="text-base sm:text-lg">Yeni Kayıt Oluştur</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Müşteri ve ürün bilgilerini girin
          </DialogDescription>
        </DialogHeader>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="flex flex-col flex-1 min-h-0 gap-5 overflow-y-auto overscroll-contain pr-1">
            <Collapsible
              open={customerInfoOpen}
              onOpenChange={setCustomerInfoOpen}
              className="space-y-3"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <CollapsibleTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="p-0 h-auto hover:bg-transparent justify-start"
                    data-testid="button-toggle-customer-info"
                  >
                    <h3 className="font-semibold flex items-center gap-2 text-sm sm:text-base">
                      Müşteri Bilgileri
                      <ChevronDown
                        className={`h-4 w-4 shrink-0 transition-transform ${
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
                  className="w-full sm:w-auto shrink-0"
                  onClick={openCustomerPicker}
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
                <FormField
                  control={form.control}
                  name="operationType"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>RMA İşlem Tipi *</FormLabel>
                      <Select onValueChange={field.onChange} value={field.value}>
                        <FormControl>
                          <SelectTrigger data-testid="select-operation-type">
                            <SelectValue placeholder="İşlem tipi seçin" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {RMA_OPERATION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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
                    name="accountCode"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Cari Hesap Kodu</FormLabel>
                        <FormControl>
                          <Input {...field} className="font-mono" data-testid="input-account-code" />
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
                          <Input {...field} type="tel" placeholder="05xx xxx xx xx" data-testid="input-phone" />
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
                      <FormItem className="sm:col-span-2">
                        <FormLabel>Adres</FormLabel>
                        <FormControl>
                          <Input {...field} data-testid="input-address" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2 border-t">
                  <FormField
                    control={form.control}
                    name="invoiceNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Fatura No (Opsiyonel)</FormLabel>
                        <FormControl>
                          <Input {...field} className="font-mono" data-testid="input-invoice-number" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="salesId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Satış ID (Opsiyonel)</FormLabel>
                        <FormControl>
                          <Input {...field} className="font-mono" data-testid="input-sales-id" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </CollapsibleContent>
            </Collapsible>

            <div className="space-y-3">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h3 className="font-semibold text-sm sm:text-base">Ürün Bilgileri</h3>
                <div className="flex flex-col gap-2 sm:flex-row sm:shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto shrink-0"
                    onClick={openBulkProductPicker}
                    data-testid="button-bulk-add-products"
                  >
                    <ListPlus className="h-4 w-4 mr-2" />
                    Toplu Ekle
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="w-full sm:w-auto shrink-0"
                    onClick={addProduct}
                    data-testid="button-add-product"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Ürün Ekle
                  </Button>
                </div>
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
                    <AccordionTrigger className="hover:no-underline py-3">
                      <div className="flex items-center justify-between w-full gap-2 pr-2 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2 min-w-0 text-left">
                          <span className="font-medium text-sm sm:text-base truncate">
                            {getProductAccordionTitle(product, index)}
                          </span>
                          {product.name.trim() && product.stockCode.trim() ? (
                            <span className="text-xs text-muted-foreground font-mono truncate">
                              {product.stockCode}
                            </span>
                          ) : null}
                          {product.quantity > 1 ? (
                            <span className="text-xs text-muted-foreground shrink-0">
                              × {product.quantity} adet
                            </span>
                          ) : null}
                        </div>
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
                      <div className="pt-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2 flex flex-col sm:flex-row sm:items-end gap-2">
                      <div className="flex-1 min-w-0">
                        <label className="text-sm font-medium mb-2 block">
                          Stok Kodu
                        </label>
                        <Input
                          value={product.stockCode}
                          onChange={(e) =>
                            updateProduct(product.id, "stockCode", e.target.value)
                          }
                          placeholder="Stok kodu"
                          className="font-mono"
                          data-testid={`input-stock-code-${index}`}
                        />
                      </div>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="w-full sm:w-auto shrink-0"
                        onClick={() => openProductPicker(product.id)}
                        data-testid={`button-select-product-${index}`}
                      >
                        <Package className="h-4 w-4 mr-2" />
                        Ürün Seç
                      </Button>
                    </div>
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
                        Barkod
                      </label>
                      <Input
                        value={product.barcode}
                        onChange={(e) =>
                          updateProduct(product.id, "barcode", e.target.value)
                        }
                        className="font-mono"
                        data-testid={`input-barcode-${index}`}
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
                        value={product.quantity}
                        onChange={(e) =>
                          updateProduct(product.id, "quantity", parseInt(e.target.value) || 1)
                        }
                        data-testid={`input-quantity-${index}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-2 block">
                        Ariza / Iade Nedeni
                      </label>
                      <Textarea
                        value={product.defectReason}
                        onChange={(e) =>
                          updateProduct(product.id, "defectReason", e.target.value)
                        }
                        rows={2}
                        data-testid={`input-defect-reason-${index}`}
                      />
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-sm font-medium mb-2 block">
                        Urun Islem Tipi
                      </label>
                      <Select
                        value={product.category || operationType}
                        onValueChange={(value) =>
                          updateProduct(product.id, "category", value)
                        }
                      >
                        <SelectTrigger data-testid={`select-category-${index}`}>
                          <SelectValue placeholder="Islem tipi" />
                        </SelectTrigger>
                        <SelectContent>
                          {RMA_OPERATION_TYPES.map((type) => (
                            <SelectItem key={type.value} value={type.value}>
                              {type.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
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

            <DialogFooter className="shrink-0 pt-2 gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                className="w-full sm:w-auto"
                onClick={() => onOpenChange(false)}
              >
                İptal
              </Button>
              <Button
                type="submit"
                className="w-full sm:w-auto"
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

      {/* Müşteri Seçimi Dialogu */}
      <Dialog open={customerDialogOpen} onOpenChange={setCustomerDialogOpen}>
        <DialogContent className={pickerDialogClass}>
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle className="text-base sm:text-lg">Müşteri Seç</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Cari listenizden bir müşteri seçin veya arama yapın
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex flex-col flex-1 min-h-0 gap-3">
            <Input
              className="shrink-0"
              placeholder="Cari kodu veya cari adı ile ara..."
              value={customerSearchQuery}
              onChange={(e) => setCustomerSearchQuery(e.target.value)}
              data-testid="input-search-customer"
            />
            
            <PickerResults
              loading={customersBusy}
              isEmpty={!customersBusy && catalogCustomers.length === 0}
              emptyMessage="Müşteri bulunamadı"
              countLabel={
                catalogCustomers.length > 0
                  ? `${catalogCustomers.length} müşteri listeleniyor`
                  : undefined
              }
            >
              {catalogCustomers.map((customer) => (
                <button
                  key={customer.id}
                  type="button"
                  className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  onClick={() => selectCustomer(customer)}
                  data-testid={`customer-item-${customer.id}`}
                >
                  <p className="font-semibold leading-snug text-sm sm:text-base break-words">
                    {customer.accountName}
                  </p>
                  <p className="text-xs sm:text-sm text-muted-foreground font-mono mt-1 break-all">
                    {customer.accountCode}
                  </p>
                </button>
              ))}
            </PickerResults>
          </div>
          
          <DialogFooter className="shrink-0 pt-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
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

      {/* Toplu Ürün Ekleme Dialogu */}
      <Dialog
        open={bulkDialogOpen}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) closeBulkProductPicker();
          else setBulkDialogOpen(true);
        }}
      >
        <DialogContent className={pickerDialogClass}>
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle className="text-base sm:text-lg">Toplu Ürün Ekle</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Listeden ürün seçin, adet girin ve ekleyin
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 min-h-0 gap-3">
            <Input
              className="shrink-0"
              placeholder="Stok kodu veya ürün adı ile ara..."
              value={bulkSearchQuery}
              onChange={(e) => setBulkSearchQuery(e.target.value)}
              data-testid="input-search-bulk-product"
            />

            {pendingBulkProduct ? (
              <div className="shrink-0 rounded-lg border bg-muted/30 p-3 space-y-3">
                {(() => {
                  const normalized = normalizeCatalogProduct(pendingBulkProduct);
                  return (
                    <>
                      <div>
                        <p className="font-medium text-sm sm:text-base break-words">
                          {normalized.stockName || normalized.stockCode}
                        </p>
                        {normalized.stockName && normalized.stockCode ? (
                          <p className="text-xs sm:text-sm text-muted-foreground font-mono mt-1 break-all">
                            {normalized.stockCode}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2 sm:items-end">
                        <div className="flex-1 min-w-0">
                          <label className="text-sm font-medium mb-2 block">Adet</label>
                          <Input
                            type="number"
                            min={1}
                            value={pendingBulkQuantity}
                            onChange={(e) => setPendingBulkQuantity(e.target.value)}
                            data-testid="input-bulk-quantity"
                          />
                        </div>
                        <Button
                          type="button"
                          className="w-full sm:w-auto shrink-0"
                          onClick={addToBulkStaging}
                          data-testid="button-confirm-bulk-item"
                        >
                          Ekle
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="w-full sm:w-auto shrink-0"
                          onClick={() => {
                            setPendingBulkProduct(null);
                            setPendingBulkQuantity("1");
                          }}
                          data-testid="button-cancel-bulk-item"
                        >
                          İptal
                        </Button>
                      </div>
                    </>
                  );
                })()}
              </div>
            ) : null}

            <PickerResults
              loading={bulkProductsBusy}
              isEmpty={!bulkProductsBusy && bulkCatalogProducts.length === 0}
              emptyMessage="Ürün bulunamadı"
              countLabel={
                bulkCatalogProducts.length > 0
                  ? `${bulkCatalogProducts.length} ürün listeleniyor`
                  : undefined
              }
            >
              {bulkCatalogProducts.map((item) => {
                const normalized = normalizeCatalogProduct(item);
                const isStaged = bulkStaging.some((staged) => staged.catalogId === item.id);
                const isPending = pendingBulkProduct?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`w-full text-left p-3 border rounded-lg transition-colors ${
                      isPending
                        ? "border-primary bg-primary/5"
                        : isStaged
                          ? "border-primary/40 bg-muted/40"
                          : "hover:bg-muted/50"
                    }`}
                    onClick={() => pickBulkProduct(item)}
                    data-testid={`bulk-product-item-${item.id}`}
                  >
                    <p className="font-medium leading-snug text-sm sm:text-base break-words">
                      {normalized.stockName || normalized.stockCode}
                    </p>
                    {normalized.stockName && normalized.stockCode ? (
                      <p className="text-xs sm:text-sm text-muted-foreground font-mono mt-1 break-all">
                        {normalized.stockCode}
                      </p>
                    ) : null}
                    {isStaged ? (
                      <p className="text-xs text-primary mt-1">
                        Seçildi · {bulkStaging.find((s) => s.catalogId === item.id)?.quantity} adet
                      </p>
                    ) : null}
                  </button>
                );
              })}
            </PickerResults>

            {bulkStaging.length > 0 ? (
              <div className="shrink-0 rounded-lg border p-3 space-y-2 max-h-[140px] overflow-y-auto">
                <p className="text-sm font-medium">
                  Seçilen ürünler ({bulkStaging.length})
                </p>
                <div className="space-y-2">
                  {bulkStaging.map((item) => (
                    <div
                      key={item.catalogId}
                      className="flex items-start justify-between gap-2 text-sm"
                    >
                      <div className="min-w-0">
                        <p className="font-medium truncate">{item.name}</p>
                        <p className="text-xs text-muted-foreground font-mono truncate">
                          {item.stockCode} · {item.quantity} adet
                        </p>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="shrink-0 h-8 w-8"
                        onClick={() => removeFromBulkStaging(item.catalogId)}
                        data-testid={`button-remove-bulk-item-${item.catalogId}`}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <DialogFooter className="shrink-0 pt-2 gap-2 sm:gap-0">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={closeBulkProductPicker}
              data-testid="button-close-bulk-dialog"
            >
              İptal
            </Button>
            <Button
              className="w-full sm:w-auto"
              disabled={bulkStaging.length === 0}
              onClick={commitBulkProducts}
              data-testid="button-commit-bulk-products"
            >
              {bulkStaging.length > 0
                ? `${bulkStaging.length} Ürünü Kayda Ekle`
                : "Kayda Ekle"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Ürün Seçimi Dialogu */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className={pickerDialogClass}>
          <DialogHeader className="shrink-0 pr-8">
            <DialogTitle className="text-base sm:text-lg">Ürün Seç</DialogTitle>
            <DialogDescription className="text-xs sm:text-sm">
              Stok listenizden bir ürün seçin veya arama yapın
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col flex-1 min-h-0 gap-3">
            <Input
              className="shrink-0"
              placeholder="Stok kodu veya ürün adı ile ara..."
              value={productSearchQuery}
              onChange={(e) => setProductSearchQuery(e.target.value)}
              data-testid="input-search-product"
            />

            <PickerResults
              loading={productsBusy}
              isEmpty={!productsBusy && catalogProducts.length === 0}
              emptyMessage="Ürün bulunamadı"
              countLabel={
                catalogProducts.length > 0
                  ? `${catalogProducts.length} ürün listeleniyor`
                  : undefined
              }
            >
              {catalogProducts.map((item) => {
                const normalized = normalizeCatalogProduct(item);
                return (
                <button
                  key={item.id}
                  type="button"
                  className="w-full text-left p-3 border rounded-lg hover:bg-muted/50 transition-colors"
                  onClick={() => selectProduct(item)}
                  data-testid={`product-item-${item.id}`}
                >
                  <p className="font-mono text-xs sm:text-sm text-primary break-all">{normalized.stockCode}</p>
                  <p className="font-medium leading-snug mt-1 text-sm sm:text-base break-words">{normalized.stockName}</p>
                </button>
              )})}
            </PickerResults>
          </div>

          <DialogFooter className="shrink-0 pt-2">
            <Button
              variant="outline"
              className="w-full sm:w-auto"
              onClick={() => {
                setProductDialogOpen(false);
                setProductSearchQuery("");
                setProductPickerTargetId(null);
              }}
              data-testid="button-close-product-dialog"
            >
              İptal
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
