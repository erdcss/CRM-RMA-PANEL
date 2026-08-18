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
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `API hatası: ${response.status}`);
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
  category: 'iade' | 'degisim' | 'servis' | string;
  status: string;
  description?: string | null;
  quantity?: number | null;
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
  updateProductStatus: (id: number, status: string) =>
    request<RmaProduct>(`/api/products/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  deleteTicket: (id: number) =>
    request<{ message: string }>(`/api/tickets/${id}`, {
      method: 'DELETE',
    }),
};
