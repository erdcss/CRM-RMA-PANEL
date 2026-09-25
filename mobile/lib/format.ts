import { getCategoryLabel, getStatusLabel } from '@/constants/statuses';

export function formatRmaId(ticket: { id: number; receiptNumber?: string | null }) {
  return ticket.receiptNumber || `RMA-${ticket.id}`;
}

export function formatDate(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function formatDateTime(value?: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('tr-TR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function getInitials(name?: string | null) {
  if (!name?.trim()) return '?';
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((part) => part[0]?.toUpperCase() ?? '').join('');
}

export function formatProductSummary(product: {
  name?: string | null;
  brand?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  status: string;
  category: string;
}) {
  return {
    title: product.name || 'Bilinmeyen ürün',
    subtitle: [product.brand, product.model].filter(Boolean).join(' ') || 'Marka belirtilmedi',
    serial: product.serialNumber || '-',
    statusLabel: getStatusLabel(product.status),
    categoryLabel: getCategoryLabel(product.category),
  };
}

export function isTicketOpen(ticket: { products: { status: string }[] }) {
  return ticket.products.some((p) => !['teslim_edildi', 'iptal'].includes(p.status));
}

export function countCompletedProducts(tickets: { products: { status: string }[] }[]) {
  return tickets.reduce(
    (sum, ticket) => sum + ticket.products.filter((p) => p.status === 'teslim_edildi').length,
    0,
  );
}

export function countOpenProducts(tickets: { products: { status: string }[] }[]) {
  return tickets.reduce(
    (sum, ticket) =>
      sum + ticket.products.filter((p) => !['teslim_edildi', 'iptal'].includes(p.status)).length,
    0,
  );
}
