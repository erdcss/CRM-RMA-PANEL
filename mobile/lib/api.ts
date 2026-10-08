import { localAuth } from './supabase';

const PRODUCTION_API_URL = 'https://admin.ecalisgan.com';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/$/, '');
export const API_BASE_URL = API_URL;

export function absoluteMediaUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const session = await localAuth.getSession();
  const userId = session?.user?.id;
  if (!userId) return {};
  return {
    'X-Owner-User-Id': userId,
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const authHeaders = await getAuthHeaders();
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      ...init,
      headers: {
        'Content-Type': 'application/json',
        ...authHeaders,
        ...(init?.headers ?? {}),
      },
    });
  } catch (error) {
    const hint =
      API_URL.includes('localhost') || API_URL.includes('127.0.0.1')
        ? ' Bilgisayarda API sunucusunun çalıştığından emin olun (npm run dev).'
        : ' İnternet bağlantınızı ve API adresini kontrol edin.';
    throw new Error(
      `Sunucuya bağlanılamadı (${API_URL}).${hint} ${error instanceof Error ? error.message : ''}`.trim(),
    );
  }

  if (!response.ok) {
    const body = await response.text();
    throw new Error(parseApiError(body, response.status));
  }

  return response.json() as Promise<T>;
}

export type StatusHistoryEntry = {
  id: number;
  status: string;
  notes?: string | null;
  createdAt: string;
};

export type RmaProduct = {
  id: number;
  name: string | null;
  brand: string | null;
  model?: string | null;
  serialNumber?: string | null;
  stockCode?: string | null;
  barcodeNumber?: string | null;
  category: 'iade' | 'degisim' | 'servis' | string;
  status: string;
  description?: string | null;
  quantity?: number | null;
  createdAt?: string;
  statusHistory?: StatusHistoryEntry[];
};

export type RmaTicket = {
  id: number;
  receiptNumber?: string | null;
  createdAt: string;
  updatedAt?: string;
  ownerUserId?: string | null;
  customer: {
    id: number;
    name: string | null;
    phone: string | null;
    accountCode?: string | null;
    email?: string | null;
    address?: string | null;
  };
  products: RmaProduct[];
};

export type RmaCustomer = {
  id: number;
  name: string | null;
  phone: string | null;
  accountCode?: string | null;
  email?: string | null;
  address?: string | null;
  createdAt?: string;
  ticketCount?: number;
};

export type CatalogProduct = {
  id: number;
  stockCode: string;
  stockName: string;
  ownerUserId: string;
  createdAt: string;
};

export type CatalogCustomer = {
  id: number;
  accountCode: string;
  accountName: string;
  ownerUserId: string;
  createdAt: string;
};

export type B2BProduct = {
  id: string | number;
  sku?: string | null;
  name: string;
  price?: string | number | null;
  stock?: number | null;
  min_order_qty?: number | null;
  units_per_box?: number | null;
  image_data?: string | null;
  image_url?: string | null;
  images?: string[] | null;
  barcode?: string | null;
  collection_name?: string | null;
  category?: string | null;
  brand?: string | null;
  description?: string | null;
  features?: string[] | null;
  variants?: Array<Record<string, string>> | null;
};

export type B2BHomepage = {
  categories: string[];
};

export type B2BReel = {
  id: string | number;
  title: string;
  video_url: string;
  thumbnail_url?: string | null;
  product_id?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
};

export type B2BAccount = {
  id: number;
  email?: string | null;
  companyName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyCategory?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  taxVerified?: boolean;
};

export type B2BAddress = {
  id: number;
  title: string;
  recipient?: string | null;
  phone?: string | null;
  city?: string | null;
  district?: string | null;
  address_line: string;
  postal_code?: string | null;
  is_default?: boolean;
};

export type B2BPaymentMethod = {
  id: number;
  provider?: string | null;
  brand?: string | null;
  last4?: string | null;
  holder_name?: string | null;
  is_default?: boolean;
};

export type B2BPaymentSettings = {
  iyzicoConfigured: boolean;
  bankTransfer: {
    enabled: boolean;
    bankName: string;
    accountHolder: string;
    iban: string;
  };
};

export type B2BCheckoutProduct = {
  id: string;
  sku: string;
  name: string;
  category: string;
  price: number;
  stock: number;
  minOrderQty: number;
  unitsPerBox: number;
  maxBoxQty: number;
  image?: string | null;
};

export type B2BCheckoutPreview = {
  product: B2BCheckoutProduct;
  quantity: number;
  totalUnits: number;
  total: number;
  currency: 'TRY';
  iyzicoConfigured: boolean;
};

export type B2BCheckoutLine = {
  product: B2BCheckoutProduct;
  quantity: number;
  totalUnits: number;
  total: number;
};

export type B2BCheckoutCartPreview = {
  items: B2BCheckoutLine[];
  total: number;
  itemCount: number;
  boxCount: number;
  currency: 'TRY';
  iyzicoConfigured: boolean;
};

export type B2BBankTransferOrder = {
  orderNumber: string;
  total: number;
  transferCode: string;
  transferDescription: string;
  bankTransfer: {
    enabled: boolean;
    bankName: string;
    accountHolder: string;
    iban: string;
  };
};

export type B2BInstallmentOption = {
  installmentNumber: number;
  installmentPrice: number;
  totalPrice: number;
  commissionRate: number;
};

export type B2BInstallmentLookup = {
  binNumber: string;
  price: number;
  bankName: string;
  bankCode: number | null;
  cardType: string;
  cardAssociation: string;
  cardFamilyName: string;
  commercial: number;
  force3ds: number;
  options: B2BInstallmentOption[];
};

export type B2BThreeDSInitialize = {
  orderNumber: string;
  paymentId: string;
  paidPrice: number;
  installment: number;
  installmentRate: number;
  threeDSHtmlContent: string;
  threeDSHtml?: string;
};

export type B2BReturn = {
  id: number;
  order_number?: string | null;
  status?: string | null;
  reason?: string | null;
  created_at?: string | null;
};

export type B2BInvoice = {
  id: number;
  invoice_number?: string | null;
  order_number?: string | null;
  total_amount?: string | number | null;
  download_url?: string | null;
  created_at?: string | null;
};

export type B2BSupportTicket = {
  id: number;
  subject: string;
  message: string;
  status?: string | null;
  created_at?: string | null;
};

export type SupplierItem = {
  id: number;
  productId: number;
  supplierAccountCode: string;
  supplierName: string;
  ownerUserId: string;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  product: RmaProduct & {
    ticketId?: number;
    ticket?: {
      id: number;
      receiptNumber?: string | null;
      createdAt: string;
      customer: RmaTicket['customer'];
    };
  };
};

export type DashboardStats = {
  totalTickets: number;
  activeReturns: number;
  activeExchanges: number;
  inService: number;
  recentTickets: Array<{
    id: number;
    name: string | null;
    brand: string | null;
    status: string;
    category: string;
    createdAt: string;
    ticket?: {
      id: number;
      receiptNumber?: string | null;
      customer?: RmaTicket['customer'];
    };
  }>;
};

export type CreateTicketPayload = {
  receiptNumber?: string;
  customerName?: string;
  accountCode?: string;
  phone?: string;
  email?: string;
  address?: string;
  products?: Array<{
    name?: string;
    serialNumber?: string;
    brand?: string;
    model?: string;
    category?: 'iade' | 'degisim' | 'servis';
    description?: string;
    quantity?: number;
    stockCode?: string;
  }>;
};

export type UpdateProductPayload = {
  name?: string;
  serialNumber?: string | null;
  stockCode?: string | null;
  brand?: string | null;
  model?: string | null;
  category?: 'iade' | 'degisim' | 'servis';
  description?: string | null;
  quantity?: number;
};

export type RmaPackageItem = {
  id: number;
  packageId: number;
  productId: number;
  quantity: number | null;
  product?: RmaProduct & {
    ticket?: {
      id: number;
      receiptNumber?: string | null;
      createdAt: string;
      customer?: RmaTicket['customer'];
    };
  };
};

export type RmaPackage = {
  id: number;
  packageNumber: string;
  supplierAccountCode: string;
  supplierName: string;
  status: string;
  barcodeValue?: string | null;
  qrValue?: string | null;
  createdAt: string;
  closedAt?: string | null;
  verifiedAt?: string | null;
  shippedAt?: string | null;
  items: RmaPackageItem[];
  productCount?: number;
  totalQuantity?: number;
  labelSequence?: number | null;
  history?: Array<{ eventType?: string | null; metadata?: string | null; createdAt?: string }>;
};

function parseApiError(body: string, status: number) {
  try {
    const parsed = JSON.parse(body) as { error?: string; message?: string };
    return parsed.error || parsed.message || `API hatası: ${status}`;
  } catch {
    return body || `API hatası: ${status}`;
  }
}

export const rmaApi = {
  listTickets: () => request<RmaTicket[]>('/api/tickets'),
  getTicket: (id: number) => request<RmaTicket>(`/api/tickets/${id}`),
  createTicket: (payload: CreateTicketPayload) =>
    request<RmaTicket>('/api/tickets', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  listCustomers: () => request<RmaCustomer[]>('/api/customers'),
  getCustomer: (id: number) => request<RmaCustomer>(`/api/customers/${id}`),
  listCatalogProducts: (q?: string) =>
    request<CatalogProduct[]>(`/api/catalog-products${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  listCatalogCustomers: (q?: string) =>
    request<CatalogCustomer[]>(`/api/catalog-customers${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  listB2BProducts: () => request<B2BProduct[]>('/api/b2b/products'),
  getB2BProduct: (id: string | number) =>
    request<B2BProduct>(`/api/b2b/products/${encodeURIComponent(String(id))}`),
  getB2BHomepage: () => request<B2BHomepage>('/api/public/homepage'),
  listB2BReels: () => request<B2BReel[]>('/api/public/reels'),
  getB2BAccount: () => request<B2BAccount>('/api/b2b/account'),
  listB2BAddresses: () => request<B2BAddress[]>('/api/b2b/addresses'),
  listB2BPaymentMethods: () => request<B2BPaymentMethod[]>('/api/b2b/payment-methods'),
  getB2BPaymentSettings: () =>
    request<B2BPaymentSettings>('/api/public/payment-settings'),
  getB2BCheckoutPreview: (productId: string | number, quantity: number) =>
    request<B2BCheckoutPreview>(
      `/api/b2b/checkout/preview?productId=${encodeURIComponent(String(productId))}&qty=${Math.max(1, Math.trunc(quantity))}`,
    ),
  getB2BCheckoutCartPreview: (items: Array<{ productId: string | number; quantity: number }>) =>
    request<B2BCheckoutCartPreview>('/api/b2b/checkout/preview', {
      method: 'POST',
      body: JSON.stringify({ items }),
    }),
  createB2BAddress: (payload: {
    title: string;
    recipient: string;
    phone: string;
    city: string;
    district: string;
    addressLine: string;
    postalCode: string;
  }) =>
    request<B2BAddress>('/api/b2b/addresses', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  initializeB2BIyzicoCheckout: (payload: {
    productId: string | number;
    quantity: number;
    addressId: string | number;
    shipping: Record<string, unknown>;
    checkoutContext?: Record<string, unknown>;
    mobileReturnUrl?: string;
  }) =>
    request<{ orderNumber: string; paymentPageUrl: string; tokenExpireTime?: number | null }>(
      '/api/b2b/payments/iyzico/initialize',
      { method: 'POST', body: JSON.stringify(payload) },
    ),
  getB2BInstallments: (payload: {
    productId: string | number;
    quantity: number;
    binNumber: string;
  }) =>
    request<B2BInstallmentLookup>('/api/b2b/payments/iyzico/installments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  getB2BInstallmentsForItems: (payload: {
    items: Array<{ productId: string | number; quantity: number }>;
    binNumber: string;
  }) =>
    request<B2BInstallmentLookup>('/api/b2b/payments/iyzico/installments', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  initializeB2BThreeDS: (payload: {
    productId: string | number;
    quantity: number;
    addressId: string | number;
    shipping: Record<string, unknown>;
    card: {
      cardHolderName: string;
      cardNumber: string;
      expireMonth: string;
      expireYear: string;
      cvc: string;
    };
    installment: number;
    checkoutContext?: Record<string, unknown>;
    mobileReturnUrl?: string;
  }) =>
    request<B2BThreeDSInitialize>('/api/b2b/payments/iyzico/3ds/initialize', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  initializeB2BThreeDSForItems: (payload: {
    items: Array<{ productId: string | number; quantity: number }>;
    addressId: string | number;
    shipping: Record<string, unknown>;
    card: {
      cardHolderName: string;
      cardNumber: string;
      expireMonth: string;
      expireYear: string;
      cvc: string;
    };
    installment: number;
    checkoutContext?: Record<string, unknown>;
    mobileReturnUrl?: string;
  }) =>
    request<B2BThreeDSInitialize>('/api/b2b/payments/iyzico/3ds/initialize', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createB2BBankTransferOrder: (payload: {
    productId: string | number;
    quantity: number;
    addressId: string | number;
    shipping: Record<string, unknown>;
    checkoutContext?: Record<string, unknown>;
  }) =>
    request<B2BBankTransferOrder>('/api/b2b/payments/bank-transfer', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  createB2BBankTransferOrderForItems: (payload: {
    items: Array<{ productId: string | number; quantity: number }>;
    addressId: string | number;
    shipping: Record<string, unknown>;
    checkoutContext?: Record<string, unknown>;
  }) =>
    request<B2BBankTransferOrder>('/api/b2b/payments/bank-transfer', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  confirmB2BBankTransfer: (orderNumber: string) =>
    request<{ id: string | number; order_number: string; status: string; payment_status: string }>(
      `/api/b2b/payments/bank-transfer/${encodeURIComponent(orderNumber)}/confirm`,
      { method: 'POST', body: JSON.stringify({}) },
    ),
  listB2BReturns: () => request<B2BReturn[]>('/api/b2b/my-returns'),
  listB2BInvoices: () => request<B2BInvoice[]>('/api/b2b/my-invoices'),
  listB2BSupport: () => request<B2BSupportTicket[]>('/api/b2b/support'),
  createB2BSupport: (subject: string, message: string) =>
    request<B2BSupportTicket>('/api/b2b/support', {
      method: 'POST',
      body: JSON.stringify({ subject, message }),
    }),
  getDashboardStats: () => request<DashboardStats>('/api/stats/dashboard'),
  updateProduct: (id: number, payload: UpdateProductPayload) =>
    request<RmaProduct>(`/api/products/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  updateProductStatus: (id: number, status: string) =>
    request<RmaProduct>(`/api/products/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  listSupplierItems: () => request<SupplierItem[]>('/api/supplier-items'),
  addSupplierItem: (payload: {
    productId: number;
    supplierAccountCode: string;
    supplierName: string;
    notes?: string;
  }) =>
    request<SupplierItem>('/api/supplier-items', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),
  updateSupplierItem: (
    id: number,
    payload: { supplierAccountCode?: string; supplierName?: string; notes?: string | null },
  ) =>
    request<SupplierItem>(`/api/supplier-items/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(payload),
    }),
  deleteSupplierItem: (id: number) =>
    request<{ message: string }>(`/api/supplier-items/${id}`, {
      method: 'DELETE',
    }),
  deleteTicket: (id: number) =>
    request<{ message: string }>(`/api/tickets/${id}`, {
      method: 'DELETE',
    }),
  deleteAccount: () =>
    request<{ message: string }>('/api/account', {
      method: 'DELETE',
    }),

  lookupPackage: (q: string) =>
    request<RmaPackage>(`/api/rma/packages/lookup?q=${encodeURIComponent(q)}`),

  listPackages: (params?: { supplier?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.supplier) query.set('supplier', params.supplier);
    if (params?.status) query.set('status', params.status);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request<RmaPackage[]>(`/api/rma/packages${suffix}`);
  },

  getPackage: (id: number) => request<RmaPackage>(`/api/rma/packages/${id}`),

  createPackage: (payload: {
    supplierAccountCode: string;
    supplierName: string;
    productIds: number[];
    notes?: string;
  }) =>
    request<RmaPackage>('/api/rma/packages', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  addPackageItems: (packageId: number, productIds: number[]) =>
    request<RmaPackage>(`/api/rma/packages/${packageId}/items`, {
      method: 'POST',
      body: JSON.stringify({ productIds }),
    }),

  removePackageItem: (packageId: number, itemId: number) =>
    request<RmaPackage>(`/api/rma/packages/${packageId}/items/${itemId}`, {
      method: 'DELETE',
    }),

  closePackage: (packageId: number) =>
    request<RmaPackage>(`/api/rma/packages/${packageId}/close`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  verifyPackageBarcode: (barcodeValue: string) =>
    request<RmaPackage>('/api/rma/packages/verify', {
      method: 'POST',
      body: JSON.stringify({ barcodeValue }),
    }),

  shipPackage: (packageId: number, payload?: { carrierName?: string; trackingNumber?: string; notes?: string }) =>
    request<RmaPackage>(`/api/rma/packages/${packageId}/ship`, {
      method: 'POST',
      body: JSON.stringify(payload ?? {}),
    }),

  markDeliveredToSupplier: (id: number, deliveryNote?: string) =>
    request<any>(`/api/rma/packages/${id}/deliver-to-supplier`, {
      method: 'POST',
      body: JSON.stringify({ deliveryNote }),
    }),

  markPackageReturned: (id: number, returnNote?: string) =>
    request<any>(`/api/rma/packages/${id}/return`, {
      method: 'POST',
      body: JSON.stringify({ returnNote }),
    }),

  saveSupplierResult: (
    productId: number,
    payload: {
      packageId?: number;
      resultType: string;
      resultDescription?: string;
      newSerialNumber?: string;
      newBarcode?: string;
    },
  ) =>
    request<any>(`/api/rma/products/${productId}/supplier-result`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  deliverToCustomer: (
    productId: number,
    payload: { receiverName: string; receiverPhone?: string; deliveryNote?: string },
  ) =>
    request<any>(`/api/rma/products/${productId}/customer-delivery`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getClosureStatus: (ticketId: number) => request<any>(`/api/rma/tickets/${ticketId}/closure-status`),

  ensureShipmentBarcode: (productId: number) =>
    request<{ barcodeNumber: string }>(`/api/products/${productId}/shipment-barcode`, {
      method: 'POST',
      body: JSON.stringify({}),
    }),

  ensureShipmentBarcodes: (productIds: number[]) =>
    request<{ barcodes: Record<number, string> }>('/api/products/shipment-barcodes/ensure', {
      method: 'POST',
      body: JSON.stringify({ productIds }),
    }),
};
