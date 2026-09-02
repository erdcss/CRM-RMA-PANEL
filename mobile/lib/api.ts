import { supabase } from './supabase';

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

async function getAuthHeaders(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const session = data.session;
  const userId = session?.user?.id;
  if (!userId) return {};
  return {
    'X-Owner-User-Id': userId,
    ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL tanımlı değil.');

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
