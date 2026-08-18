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
  customer: {
    id: number;
    name: string | null;
    phone: string | null;
    email?: string | null;
    address?: string | null;
  };
  products: RmaProduct[];
};

export type RmaCustomer = {
  id: number;
  name: string | null;
  phone: string | null;
  email?: string | null;
  address?: string | null;
  createdAt?: string;
  ticketCount?: number;
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
  }>;
};

const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? '').replace(/\/$/, '');

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!API_URL) throw new Error('EXPO_PUBLIC_API_URL tanımlı değil.');

  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || `API hatası: ${response.status}`);
  }

  return response.json() as Promise<T>;
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
