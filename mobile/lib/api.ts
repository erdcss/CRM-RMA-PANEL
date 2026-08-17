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
  updateProductStatus: (id: number, status: string) =>
    request<RmaProduct>(`/api/products/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
};
