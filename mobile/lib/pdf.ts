import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import type { RmaTicket } from './api';

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const categoryLabel = (value: string) =>
  ({ iade: 'İade', degisim: 'Değişim', servis: 'Servis' } as Record<string, string>)[value] ?? value;

function buildTicketHtml(ticket: RmaTicket) {
  const rows = ticket.products
    .map(
      (product) => `
        <tr>
          <td>${escapeHtml(product.quantity ?? 1)}</td>
          <td>${escapeHtml(product.name)}</td>
          <td>${escapeHtml([product.brand, product.model].filter(Boolean).join(' '))}</td>
          <td>${escapeHtml(product.serialNumber)}</td>
          <td>${escapeHtml(categoryLabel(product.category))}</td>
          <td>${escapeHtml(product.status)}</td>
        </tr>`,
    )
    .join('');

  const createdAt = new Date(ticket.createdAt).toLocaleString('tr-TR');
  const documentNo = ticket.receiptNumber || `RMA-${ticket.id}`;

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { margin: 28px; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; color:#111827; font-size:12px; }
        .header { display:flex; justify-content:space-between; align-items:flex-start; border-bottom:2px solid #2563eb; padding-bottom:12px; margin-bottom:16px; }
        h1 { font-size:20px; margin:0 0 4px; }
        .muted { color:#6b7280; }
        .box { border:1px solid #e5e7eb; border-radius:8px; padding:12px; margin-bottom:14px; }
        .grid { display:grid; grid-template-columns:1fr 1fr; gap:6px 20px; }
        table { width:100%; border-collapse:collapse; margin-top:8px; }
        th, td { border:1px solid #d1d5db; padding:7px; text-align:left; vertical-align:top; }
        th { background:#f3f4f6; font-size:11px; }
        .footer { margin-top:28px; display:grid; grid-template-columns:1fr 1fr; gap:32px; }
        .signature { border-top:1px solid #9ca3af; padding-top:6px; text-align:center; margin-top:36px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>ÇALIŞKAN GROUP</h1>
          <div class="muted">Müşteri Hizmetleri ve RMA Merkezi</div>
        </div>
        <div style="text-align:right">
          <strong>${escapeHtml(documentNo)}</strong><br />
          <span class="muted">${escapeHtml(createdAt)}</span>
        </div>
      </div>

      <div class="box">
        <strong>Müşteri Bilgileri</strong>
        <div class="grid" style="margin-top:8px">
          <div>Ad Soyad / Firma: ${escapeHtml(ticket.customer.name)}</div>
          <div>Telefon: ${escapeHtml(ticket.customer.phone)}</div>
          <div>E-posta: ${escapeHtml(ticket.customer.email)}</div>
          <div>Adres: ${escapeHtml(ticket.customer.address)}</div>
        </div>
      </div>

      <strong>RMA Ürünleri</strong>
      <table>
        <thead>
          <tr><th>Adet</th><th>Ürün</th><th>Marka / Model</th><th>Seri No</th><th>İşlem</th><th>Durum</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="footer">
        <div class="signature">Teslim Eden</div>
        <div class="signature">Teslim Alan</div>
      </div>
    </body>
  </html>`;
}

export async function createTicketPdf(ticket: RmaTicket) {
  return Print.printToFileAsync({ html: buildTicketHtml(ticket) });
}

export async function shareTicketPdf(ticket: RmaTicket) {
  const { uri } = await createTicketPdf(ticket);
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Bu cihazda dosya paylaşımı kullanılamıyor.');

  await Sharing.shareAsync(uri, {
    UTI: '.pdf',
    mimeType: 'application/pdf',
    dialogTitle: `${ticket.receiptNumber || `RMA-${ticket.id}`} PDF`,
  });

  return uri;
}
