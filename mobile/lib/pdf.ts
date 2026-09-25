import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getCategoryLabel, getStatusLabel } from '@/constants/statuses';
import type { RmaTicket } from './api';

const A5_WIDTH = 420;
const A5_HEIGHT = 595;

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const pdfBaseStyles = `
  @page { size: A5 portrait; margin: 10mm 8mm; }
  * { box-sizing: border-box; }
  body {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
    color: #0f172a;
    font-size: 9px;
    line-height: 1.35;
    margin: 0;
  }
  .brand { font-size: 13px; font-weight: 800; letter-spacing: 0.2px; margin: 0; }
  .brand-sub { font-size: 8px; color: #64748b; margin-top: 2px; }
  .header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 8px;
  }
  .doc-meta { text-align: right; font-size: 8px; color: #334155; }
  .doc-title { font-size: 10px; font-weight: 800; color: #1d4ed8; margin-bottom: 2px; }
  .divider { border-top: 1px solid #e2e8f0; margin: 6px 0; }
  .info-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 4px 10px;
    font-size: 8px;
    margin-bottom: 8px;
  }
  .info-grid span { color: #64748b; }
  .info-grid strong { color: #0f172a; font-weight: 700; }
  table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 8px; }
  th, td {
    border: 1px solid #cbd5e1;
    padding: 4px 5px;
    text-align: left;
    vertical-align: top;
    word-break: break-word;
  }
  th { background: #f8fafc; color: #334155; font-size: 7.5px; font-weight: 700; }
  .center { text-align: center; }
  .signatures {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: 8px;
    margin-top: 10px;
    font-size: 7px;
    font-weight: 700;
    text-align: center;
  }
  .sign-line { border-top: 1px solid #94a3b8; margin-top: 18px; padding-top: 4px; }
  .footer { margin-top: 8px; font-size: 7px; color: #64748b; }
`;

export function pdfFileNameForCustomer(customerName?: string | null) {
  const sanitized = String(customerName ?? 'Musteri')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 120);

  return `${sanitized || 'Musteri'}.pdf`;
}

function buildTicketHtml(ticket: RmaTicket) {
  const rows = ticket.products
    .map(
      (product) => `
        <tr>
          <td class="center">${escapeHtml(product.quantity ?? 1)}</td>
          <td>${escapeHtml(product.stockCode || '—')}</td>
          <td>${escapeHtml(product.name)}</td>
          <td>${escapeHtml([product.brand, product.model].filter(Boolean).join(' ') || '—')}</td>
          <td>${escapeHtml(`${getCategoryLabel(product.category)} · ${getStatusLabel(product.status)}`)}</td>
        </tr>`,
    )
    .join('');

  const createdAt = new Date(ticket.createdAt);
  const dateStr = createdAt.toLocaleDateString('tr-TR');
  const timeStr = createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
  const documentNo = ticket.receiptNumber || `#${ticket.id}`;

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <style>${pdfBaseStyles}</style>
    </head>
    <body>
      <div class="header">
        <div>
          <p class="brand">ÇALIŞKAN GROUP</p>
          <div class="brand-sub">Müşteri Hizmetleri ve RMA Merkezi</div>
        </div>
        <div class="doc-meta">
          <div class="doc-title">SERVİS FİŞİ</div>
          Tarih: ${escapeHtml(dateStr)}<br />
          Saat: ${escapeHtml(timeStr)}<br />
          Fiş No: ${escapeHtml(documentNo)}
        </div>
      </div>

      <div class="divider"></div>

      <div class="info-grid">
        <div><span>Müşteri: </span><strong>${escapeHtml(ticket.customer.name)}</strong></div>
        <div><span>Telefon: </span><strong>${escapeHtml(ticket.customer.phone || '—')}</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:8%">Adet</th>
            <th style="width:16%">Stok Kodu</th>
            <th style="width:34%">Ürün Adı</th>
            <th style="width:18%">Marka/Model</th>
            <th style="width:24%">Durum</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">Ürün bulunmuyor.</td></tr>'}</tbody>
      </table>

      <div class="signatures">
        <div>Teslim Eden<div class="sign-line"></div></div>
        <div>Teslim Alan<div class="sign-line"></div></div>
        <div>Ücret Durumu<div class="sign-line"></div></div>
      </div>

      <div class="footer">Bu belge ${escapeHtml(dateStr)} tarihinde oluşturulmuştur.</div>
    </body>
  </html>`;
}

export async function previewTicketPdf(ticket: RmaTicket) {
  await Print.printAsync({ html: buildTicketHtml(ticket) });
}

export async function createTicketPdf(ticket: RmaTicket) {
  const { uri } = await Print.printToFileAsync({
    html: buildTicketHtml(ticket),
    width: A5_WIDTH,
    height: A5_HEIGHT,
  });
  const fileName = pdfFileNameForCustomer(ticket.customer.name);
  const targetUri = `${FileSystem.cacheDirectory}${fileName}`;

  await FileSystem.deleteAsync(targetUri, { idempotent: true });
  await FileSystem.copyAsync({ from: uri, to: targetUri });

  return { uri: targetUri, fileName };
}

export async function shareTicketPdf(ticket: RmaTicket) {
  const { uri, fileName } = await createTicketPdf(ticket);
  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Bu cihazda dosya paylaşımı kullanılamıyor.');

  await Sharing.shareAsync(uri, {
    UTI: 'com.adobe.pdf',
    mimeType: 'application/pdf',
    dialogTitle: fileName.replace(/\.pdf$/i, ''),
  });

  return uri;
}
