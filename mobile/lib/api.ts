import { localAuth } from './supabase';

const PRODUCTION_API_URL = 'https://b2b.ecalisgan.com';
const API_URL = (process.env.EXPO_PUBLIC_API_URL || PRODUCTION_API_URL).replace(/\/$/, '');
export const API_BASE_URL = API_URL;
// Admin is the source of truth for banner/category configuration and media.
const ADMIN_CONTENT_URL = (process.env.EXPO_PUBLIC_BRANDING_API_URL || 'https://admin.ecalisgan.com').replace(/\/$/, '');

export function homepageMediaUrl(imageId?: string | null): string | null {
  if (!imageId || !/^[a-f0-9]{32}$/.test(imageId)) return null;
  return `${ADMIN_CONTENT_URL}/api/public/homepage/media/${imageId}`;
}

export function absoluteMediaUrl(value?: string | null) {
  if (!value) return null;
  if (/^https?:\/\//i.test(value) || value.startsWith('data:')) return value;
  if (value.startsWith('/api/public/homepage/media/')) return `${ADMIN_CONTENT_URL}${value}`;
  return `${API_URL}${value.startsWith('/') ? value : `/${value}`}`;
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  // Revalidating /api/auth/session for every product/order request serializes
  // otherwise parallel requests and adds an unnecessary network roundtrip.
  const { token, userId } = await localAuth.getRequestCredentials();
  return {
    ...(userId ? { 'X-Owner-User-Id': userId } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
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
  tags?: string[] | null;
  category?: string | null;
  brand?: string | null;
  description?: string | null;
  features?: string[] | null;
  variants?: Array<Record<string, string>> | null;
  marketplace?: boolean;
  marketplace_product_id?: string;
  seller_slug?: string;
  seller_name?: string;
  seller_logo_url?: string | null;
};

// Approved marketplace products use their own IDs and must never be mixed with b2b_products IDs.
export type MarketplaceProduct = {
  id: string | number;
  sku: string;
  stock: number;
  seller_slug: string;
  seller_name: string;
  seller_logo_url?: string | null;
  content: {
    name: string;
    description?: string;
    imageUrl?: string;
    price?: string | number | null;
    category?: string;
    brand?: string;
    unitsPerBox?: number;
    minBoxes?: number;
  };
};

export type MarketplaceStore = {
  id:number;slug:string;company_name:string;description?:string;followers:number;
  content:{bannerUrl?:string;logoUrl?:string;title?:string;tagline?:string;accent?:string};
};
export type MarketplaceConversation = {id:number;company_name:string;slug:string;buyer_user_id:number;latest_message:string};
export type MarketplaceMessage = {id:number;author_user_id:number;text:string;created_at:string};
export type MarketplaceCart = {
  items:Array<{id:number;product_id:number;boxes:number;valid:boolean;total:number;unitsPerBox:number;price:number;company_name:string;sku:string;content:{name:string;imageUrl?:string}}>,
  subtotal:number;currency:string;paymentEnabled:false;notice:string;
};

export type HomeBanner = { id: string; title: string; subtitle: string; buttonText: string; imageId: string };
export type HomeCategoryCard = { category: string; label: string; imageId: string; tags?: string[] };
export type B2BHomepage = {
  categories: string[];
  banners?: HomeBanner[];
  categoryCards?: HomeCategoryCard[];
  ledgerTileImageId?: string;
  sliderAutoPlay?: boolean;
  sliderIntervalMs?: number;
};

export type B2BShortageItem = { id: string; name: string; completed: boolean };
export type B2BShortageSupplier = { id: string; name: string; items: B2BShortageItem[] };
export type B2BShortageList = { suppliers: B2BShortageSupplier[]; revision: number };

export type LedgerOperationType = 'sale'|'collection'|'purchase'|'payment'|'transfer';
export type LedgerOperation = {
  id:string;type:LedgerOperationType;amount_cents:string;effective_on:string;
  category:string;description:string;wallet_name?:string|null;wallet_id?:string|null;
  target_name?:string|null;source_name?:string|null;target_contact_id?:string|null;created_at:string;
  voided_at?:string|null;void_reason?:string|null;
};
export type LedgerReport = {
  today_in:string;today_out:string;month_in:string;month_out:string;all_out:string;
  cash_cents:string;bank_cents:string;cash_in:string;cash_out:string;contacts:number;wallets:number;
};
export type LedgerCategory = {id:string;name:string};
export type LedgerStatementRow = {
  id:string;type:string;amount_cents:string;effective_on:string;description:string;
  voided_at?:string|null;void_reason?:string|null;operation_type?:string|null;
  category?:string|null;wallet_name?:string|null;target_name?:string|null;
  target_contact_id?:string|null;source_name?:string|null;
};

export type B2BLedgerKind = 'supplier' | 'customer' | 'other';
export type B2BLedgerMovementType = 'debt' | 'payment' | 'receivable' | 'collection';
export type B2BLedgerContact = {
  id: string;
  name: string;
  kind: B2BLedgerKind;
  phone?: string | null;
  address?: string | null;
  description?: string | null;
  is_archived?: boolean;
  debt_balance_cents: string;
  receivable_balance_cents: string;
  movement_count: number;
  created_at?: string;
  updated_at?: string;
};
export type B2BLedgerEntry = {
  id: string;
  type: B2BLedgerMovementType;
  amount_cents: string;
  description: string;
  effective_on: string;
  created_at: string;
  voided_at?: string | null;
  void_reason?: string | null;
  operation_id?: string | null;
};
export type B2BLedgerNote = {
  id: string;
  content: string;
  created_at: string;
  updated_at: string;
};
export type B2BLedgerDetail = B2BLedgerContact & {
  entries: B2BLedgerEntry[];
  notes: B2BLedgerNote[];
};
export type B2BLedgerOverview = {
  contact_count: number;
  debt_balance_cents: string;
  receivable_balance_cents: string;
};
export type B2BLedgerPdfRow = { index:number; section:'cash'|'bank'|'cari'; name:string; signedCents:string; exists:boolean };
export type B2BLedgerPdfPreview = {
  previewId:string;sourceLabel:string;reportDate:string|null;verified:boolean;
  totals: Record<'cash'|'bank'|'cari',{count:number;totalCents:string}>;
  rows:B2BLedgerPdfRow[];
};
export type B2BLedgerImportResult = {
  createdContacts:number;createdWallets:number;skippedExisting:number;skippedByUser:number;
};
export type B2BLedgerWallet = {
  id:string;name:string;kind:'cash'|'bank';opening_cents:string;balance_cents:string;movement_count:number;
};
export type B2BLedgerWalletMovement = {
  id:string;direction:'in'|'out';amount_cents:string;description:string;
  effective_on:string;created_at:string;voided_at:string|null;
};
export type B2BLedgerWalletDetail = B2BLedgerWallet & {movements:B2BLedgerWalletMovement[]};

export type B2BLedgerContactInput = {
  name: string;
  kind: B2BLedgerKind;
  phone?: string;
  address?: string;
  description?: string;
};


export type B2BReel = {
  id: string | number;
  title: string;
  video_url: string;
  thumbnail_url?: string | null;
  product_id?: string | null;
  sort_order?: number | null;
  created_at?: string | null;
  seller_name?: string | null;
  seller_slug?: string | null;
  seller_logo_url?: string | null;
  marketplace?: boolean;
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
  paymentLogos?: Array<{id:string;label:string;imageId:string}>;
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

export type B2BBankTransferReference = {
  reservationId: string;
  transferCode: string;
  transferDescription: string;
  expiresAt: string;
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

export type B2BOrderAddress = {
  recipient?: string | null;
  phone?: string | null;
  companyName?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  addressLine?: string | null;
  city?: string | null;
  district?: string | null;
  postalCode?: string | null;
  pickupTime?: string | null;
  carrier?: string | null;
  freightCompany?: string | null;
  freightPhone?: string | null;
};
export type B2BOrderDetail = B2BOrderSummary & {
  items?: Array<{
    productId?: string | number;
    name?: string;
    sku?: string;
    image?: string | null;
    quantity?: number;
    unitsPerBox?: number;
    totalUnits?: number;
    pricePerBox?: number;
    total?: number;
  }>;
  shipping_details?: {
    carrier?: string;
    companyName?: string;
    phone?: string;
    address?: string;
    pickupTime?: string;
  } | null;
  shipping_address?: B2BOrderAddress | null;
  billing_details?: B2BOrderAddress | null;
  card_last4?: string | null;
  card_association?: string | null;
  payment_provider?: string | null;
  cancel_requested_at?: string | null;
};
export type B2BOrderSummary = {
  id: string | number;
  order_number?: string | null;
  status?: string | null;
  item_count?: number | null;
  total_amount?: string | number | null;
  payment_method?: string | null;
  payment_status?: string | null;
  shipping_method?: string | null;
  created_at?: string | null;
};

export type B2BReturn = {
  id: number;
  order_number?: string | null;
  status?: string | null;
  reason?: string | null;
  created_at?: string | null;
};

export type B2BNotification = {
  id: number;
  title: string;
  body: string;
  source: 'manual' | 'automatic';
  event_key?: string | null;
  read_at?: string | null;
  created_at: string;
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

// Multiple tabs can request the same catalog at once. Share the in-flight
// request and reuse the result briefly; force refresh bypasses the cache.
const CATALOG_CACHE_MS = 30_000;
let catalogCache: { key: string; loadedAt: number; rows: B2BProduct[] } | null = null;
let catalogPending: { key: string; promise: Promise<B2BProduct[]> } | null = null;

async function loadMobileCatalog(forceRefresh = false): Promise<B2BProduct[]> {
  const { token } = await localAuth.getRequestCredentials();
  const key = token || 'guest';
  if (!forceRefresh && catalogCache?.key === key && Date.now() - catalogCache.loadedAt < CATALOG_CACHE_MS) {
    return catalogCache.rows;
  }
  if (catalogPending?.key === key) return catalogPending.promise;

  const promise = request<B2BProduct[]>(`/api/b2b/products?mobile=1&t=${Date.now()}`, { headers: { 'Cache-Control': 'no-store', Pragma: 'no-cache' } })
    .then((rows) => {
      const result = Array.isArray(rows) ? rows : [];
      catalogCache = { key, loadedAt: Date.now(), rows: result };
      return result;
    })
    .finally(() => {
      if (catalogPending?.promise === promise) catalogPending = null;
    });
  catalogPending = { key, promise };
  return promise;
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
  listB2BProducts: (forceRefresh = false) => loadMobileCatalog(forceRefresh),
  listMarketplaceProducts: () => request<MarketplaceProduct[]>('/api/marketplace/products'),
  getMarketplaceStore: (slug:string) => request<MarketplaceStore>(`/api/marketplace/stores/${encodeURIComponent(slug)}`),
  listMarketplaceStoreProducts: (slug:string) => request<MarketplaceProduct[]>(`/api/marketplace/stores/${encodeURIComponent(slug)}/products`),
  listMarketplaceFollows: () => request<Array<{slug:string;company_name:string}>>('/api/marketplace/follows'),
  followMarketplaceStore: (slug:string) => request<{following:boolean}>(`/api/marketplace/stores/${encodeURIComponent(slug)}/follow`,{method:'POST',body:'{}'}),
  unfollowMarketplaceStore: (slug:string) => request<{following:boolean}>(`/api/marketplace/stores/${encodeURIComponent(slug)}/follow`,{method:'DELETE'}),
  listMarketplaceConversations: () => request<MarketplaceConversation[]>('/api/marketplace/conversations'),
  startMarketplaceConversation: (slug:string,text:string) => request<{id:number}>('/api/marketplace/conversations',{method:'POST',body:JSON.stringify({slug,text})}),
  listMarketplaceMessages: (id:number) => request<MarketplaceMessage[]>(`/api/marketplace/conversations/${id}/messages`),
  sendMarketplaceMessage: (id:number,text:string) => request<MarketplaceMessage>(`/api/marketplace/conversations/${id}/messages`,{method:'POST',body:JSON.stringify({text})}),
  requestMarketplaceQuote: (conversationId:number,boxes:number,details:string,productId?:number) => request<{id:number}>('/api/marketplace/quotes',{method:'POST',body:JSON.stringify({conversationId,boxes,details,productId:productId||null})}),
  getMarketplaceCart: () => request<MarketplaceCart>('/api/marketplace/cart'),
  addMarketplaceCart: (productId:number,boxes:number) => request<{id:number}>('/api/marketplace/cart',{method:'POST',body:JSON.stringify({productId,boxes,deliveryMode:'direct'})}),
  removeMarketplaceCart: (lineId:number) => request<{ok:boolean}>(`/api/marketplace/cart/${lineId}`,{method:'DELETE'}),
  createMarketplaceOrderDraft: (requestKey:string) => request<{id:number;paymentEnabled:false;message:string}>('/api/marketplace/order-drafts',{method:'POST',body:JSON.stringify({requestKey})}),
  getMarketplaceProduct: (slug:string,id:string|number) =>
    request<MarketplaceProduct>(`/api/marketplace/stores/${encodeURIComponent(slug)}/products/${encodeURIComponent(String(id))}`),
  getB2BProduct: (id: string | number) =>
    request<B2BProduct>(`/api/b2b/products/${encodeURIComponent(String(id))}`),
  getB2BHomepage: async (): Promise<B2BHomepage> => {
    // Read the same public configuration that Admin → Ana Sayfa writes.
    // A separate B2B server can be on an older deployment; fall back only
    // when the admin content API cannot be reached.
    try {
      const response = await fetch(`${ADMIN_CONTENT_URL}/api/public/homepage?t=${Date.now()}`, {
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) throw new Error(`Homepage API HTTP ${response.status}`);
      const data = await response.json();
      if (!data || !Array.isArray(data.categories)) throw new Error('Invalid homepage configuration');
      return data as B2BHomepage;
    } catch {
      return request<B2BHomepage>('/api/public/homepage');
    }
  },
  findB2BProductByBarcode: (barcode: string) =>
    request<{ id: string; name: string; barcode: string }>(
      `/api/b2b/products/by-barcode/${encodeURIComponent(barcode.trim())}`
    ),
  listB2BReels: async () => {
    // Reels and their covers are administered on the admin service.
    try {
      const response = await fetch(`${ADMIN_CONTENT_URL}/api/public/reels?t=${Date.now()}`, {
        headers: { Accept: 'application/json', 'Cache-Control': 'no-cache' },
      });
      if (!response.ok) throw new Error('Reels cannot be loaded');
      const rows: unknown = await response.json();
      if (!Array.isArray(rows)) throw new Error('Invalid reels response');
      return rows as B2BReel[];
    } catch {
      return request<B2BReel[]>('/api/public/reels');
    }
  },
  listMarketplaceReels: async (): Promise<B2BReel[]> => {
    // Only supplier-approved, live videos are returned by this public endpoint.
    const rows = await request<B2BReel[]>('/api/marketplace/reels');
    return Array.isArray(rows) ? rows.map(row => ({...row,id:`marketplace-${row.id}`,marketplace:true})) : [];
  },
  previewB2BLedgerPdf: (fileName:string,dataBase64:string) =>
    request<B2BLedgerPdfPreview>('/api/b2b/ledger/import/pdf/preview', {method:'POST',body:JSON.stringify({fileName,dataBase64})}),
  confirmB2BLedgerPdf: (previewId:string,positiveMeans:'debt'|'receivable',skipIndices:number[]) =>
    request<B2BLedgerImportResult>('/api/b2b/ledger/import/pdf/confirm', {method:'POST',body:JSON.stringify({previewId,positiveMeans,skipIndices})}),
  listB2BLedgerWallets: () => request<B2BLedgerWallet[]>('/api/b2b/ledger/wallets'),
  getB2BLedgerWallet: (id:string) =>
    request<B2BLedgerWalletDetail>(`/api/b2b/ledger/wallets/${encodeURIComponent(id)}`),
  addB2BLedgerWalletMovement: (id:string,payload:{direction:'in'|'out';amount:string;description:string;effectiveOn:string;requestKey:string}) =>
    request<{id:string}>(`/api/b2b/ledger/wallets/${encodeURIComponent(id)}/movements`,{method:'POST',body:JSON.stringify(payload)}),
  getLedgerReports: () => request<LedgerReport>('/api/b2b/ledger/reports'),
  getLedgerCategories: () => request<LedgerCategory[]>('/api/b2b/ledger/categories'),
  addLedgerCategory: (name:string) => request<LedgerCategory>('/api/b2b/ledger/categories',{method:'POST',body:JSON.stringify({name})}),
  createLedgerWallet: (name:string,kind:'cash'|'bank') =>
    request<B2BLedgerWallet>('/api/b2b/ledger/wallets',{method:'POST',body:JSON.stringify({name,kind})}),
  getLedgerOperations: (id:string) =>
    request<LedgerOperation[]>(`/api/b2b/ledger/contacts/${encodeURIComponent(id)}/operations`),
  getLedgerStatementPage: (id:string,offset:number) =>
    request<{items:LedgerStatementRow[];hasMore:boolean}>(`/api/b2b/ledger/contacts/${encodeURIComponent(id)}/statement?offset=${offset}`),
  voidLedgerOperation: (id:string,reason:string) => request<{voided:boolean}>(`/api/b2b/ledger/operations/${encodeURIComponent(id)}/void`,{method:'POST',body:JSON.stringify({reason})}),
  postLedgerOperation: (payload:{
    contactId:string;type:LedgerOperationType;amount:string;effectiveOn:string;
    description:string;category:string;walletId?:string;targetContactId?:string;requestKey:string;
  })=>request<{id:string;alreadySaved:boolean}>('/api/b2b/ledger/operations',{method:'POST',body:JSON.stringify(payload)}),
  getLedgerGlobalNotes: () => request<B2BLedgerNote[]>('/api/b2b/ledger/notes/global'),
  addLedgerGlobalNote: (content:string) => request<B2BLedgerNote>('/api/b2b/ledger/notes/global',{method:'POST',body:JSON.stringify({content})}),
  deleteLedgerContact: (id:string) =>
    request<{deleted:boolean}>(`/api/b2b/ledger/contacts/${encodeURIComponent(id)}`,{method:'DELETE'}),
  listB2BLedgerContacts: () => request<B2BLedgerContact[]>('/api/b2b/ledger/contacts'),
  getB2BLedgerOverview: () => request<B2BLedgerOverview>('/api/b2b/ledger/overview'),
  getB2BLedgerContact: (id: string) => request<B2BLedgerDetail>(`/api/b2b/ledger/contacts/${encodeURIComponent(id)}`),
  createB2BLedgerContact: (payload: B2BLedgerContactInput) =>
    request<B2BLedgerContact>('/api/b2b/ledger/contacts', { method: 'POST', body: JSON.stringify(payload) }),
  editB2BLedgerContact: (id: string, payload: B2BLedgerContactInput) =>
    request<B2BLedgerContact>(`/api/b2b/ledger/contacts/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(payload) }),
  archiveB2BLedgerContact: (id: string) =>
    request<{ archived: boolean }>(`/api/b2b/ledger/contacts/${encodeURIComponent(id)}/archive`, { method: 'POST', body: '{}' }),
  addB2BLedgerEntry: (id: string, payload: { type: B2BLedgerMovementType; amount: string; description: string; effectiveOn: string; requestKey: string }) =>
    request<B2BLedgerEntry>(`/api/b2b/ledger/contacts/${encodeURIComponent(id)}/entries`, { method: 'POST', body: JSON.stringify(payload) }),
  voidB2BLedgerEntry: (id: string, reason: string) =>
    request<{ id: string; voided_at: string }>(`/api/b2b/ledger/entries/${encodeURIComponent(id)}/void`, { method: 'POST', body: JSON.stringify({ reason }) }),
  addB2BLedgerNote: (contactId: string, content: string) =>
    request<B2BLedgerNote>('/api/b2b/ledger/notes', { method: 'POST', body: JSON.stringify({ contactId, content }) }),
  editB2BLedgerNote: (id: string, content: string) =>
    request<B2BLedgerNote>(`/api/b2b/ledger/notes/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify({ content }) }),
  deleteB2BLedgerNote: (id: string) =>
    request<{ deleted: boolean }>(`/api/b2b/ledger/notes/${encodeURIComponent(id)}`, { method: 'DELETE' }),
  getB2BShortages: () => request<B2BShortageList>('/api/b2b/shortages'),
  saveB2BShortages: (payload: B2BShortageList) => request<B2BShortageList>('/api/b2b/shortages', {
    method: 'PUT', body: JSON.stringify(payload),
  }),
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
  reserveB2BBankTransferCode: () =>
    request<B2BBankTransferReference>('/api/b2b/payments/bank-transfer/preview-code', {
      method: 'POST',
      body: JSON.stringify({}),
    }),
  createB2BBankTransferOrder: (payload: {
    reservationId?: string;
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
    reservationId?: string;
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
  listB2BOrders: () => request<B2BOrderSummary[]>('/api/b2b/my-orders'),
  getB2BOrderDetail: (id: string | number) =>
    request<B2BOrderDetail>(`/api/b2b/my-orders/${encodeURIComponent(String(id))}`),
  listB2BReturns: () => request<B2BReturn[]>('/api/b2b/my-returns'),
  listB2BInvoices: () => request<B2BInvoice[]>('/api/b2b/my-invoices'),
  listB2BNotifications: () => request<B2BNotification[]>('/api/b2b/notifications'),
  markB2BNotificationRead: (id: number) => request<{id:number;read_at:string}>(
    `/api/b2b/notifications/${id}/read`,{method:'PATCH'}
  ),
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
