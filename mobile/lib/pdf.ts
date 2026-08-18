import * as FileSystem from 'expo-file-system/legacy';
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
  ({ iade: 'Iade', degisim: 'Degisim', servis: 'Servis' } as Record<string, string>)[value] ?? value;

const statusLabel = (value: string) =>
  ({
    beklemede: 'Beklemede',
    serviste: 'Serviste',
    teslim_edildi: 'Teslim Edildi',
    iptal: 'Iptal',
  } as Record<string, string>)[value] ?? value;

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
          <td class="mono">${escapeHtml(product.stockCode || '-')}</td>
          <td>${escapeHtml(product.name)}</td>
          <td>${escapeHtml([product.brand, product.model].filter(Boolean).join(' ') || '-')}</td>
          <td>${escapeHtml(`${categoryLabel(product.category)} - ${statusLabel(product.status)}`)}</td>
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
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <style>
        @page { size: A5 portrait; margin: 10mm 8mm; }
        * { box-sizing: border-box; }
        body {
          font-family: "Courier New", Courier, monospace;
          color: #111827;
          font-size: 8px;
          line-height: 1.25;
          margin: 0;
        }
        .top {
          max-height: 52mm;
          margin-bottom: 4mm;
        }
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          gap: 8px;
          margin-bottom: 3mm;
        }
        .title { font-size: 11px; font-weight: 700; margin: 0; }
        .meta { text-align: right; font-size: 7px; }
        .line { border-top: 1px solid #d1d5db; margin: 2mm 0; }
        .customer {
          display: flex;
          gap: 10px;
          font-size: 7px;
          margin-bottom: 3mm;
        }
        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
          gap: 4px;
          margin-bottom: 2mm;
        }
        .sign-box {
          text-align: center;
          font-size: 6.5px;
          font-weight: 700;
        }
        .sign-line {
          border-top: 1px solid #9ca3af;
          margin-top: 14px;
        }
        .note { font-size: 6px; color: #4b5563; }
        table {
          width: 100%;
          border-collapse: collapse;
          table-layout: fixed;
          font-size: 7px;
        }
        th, td {
          border: 1px solid #d1d5db;
          padding: 2px 3px;
          text-align: left;
          vertical-align: top;
          word-break: break-word;
        }
        th { background: #f3f4f6; font-size: 6.5px; }
        .center { text-align: center; }
        .mono { font-family: inherit; letter-spacing: -0.2px; }
        col.adet { width: 8%; }
        col.kod { width: 16%; }
        col.ad { width: 36%; }
        col.marka { width: 18%; }
        col.durum { width: 22%; }
      </style>
    </head>
    <body>
      <div class="top">
        <div class="header">
          <div>
            <p class="title">CALISKAN GROUP</p>
            <div class="note">Musteri Hizmetleri ve RMA Merkezi</div>
            <div class="note">Tel: (0xxx) xxx xx xx</div>
          </div>
          <div class="meta">
            <strong>SERVIS FISI</strong><br />
            Tarih: ${escapeHtml(dateStr)}<br />
            Saat: ${escapeHtml(timeStr)}<br />
            Fis No: ${escapeHtml(documentNo)}
          </div>
        </div>

        <div class="line"></div>

        <div class="customer">
          <div><strong>Musteri:</strong> ${escapeHtml(ticket.customer.name)}</div>
          <div><strong>Tel:</strong> ${escapeHtml(ticket.customer.phone || '-')}</div>
        </div>

        <div class="signatures">
          <div class="sign-box">Teslim Eden<div class="sign-line"></div></div>
          <div class="sign-box">Teslim Alan<div class="sign-line"></div></div>
          <div class="sign-box">Ucret Durumu<div class="sign-line"></div></div>
        </div>

        <div class="note">Bu belge ${escapeHtml(dateStr)} tarihinde olusturulmustur.</div>
      </div>

      <table>
        <colgroup>
          <col class="adet" />
          <col class="kod" />
          <col class="ad" />
          <col class="marka" />
          <col class="durum" />
        </colgroup>
        <thead>
          <tr>
            <th>Adet</th>
            <th>Urun Kodu</th>
            <th>Urun Adi</th>
            <th>Marka</th>
            <th>Durum</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="5">-</td></tr>'}</tbody>
      </table>
    </body>
  </html>`;
}

export async function createTicketPdf(ticket: RmaTicket) {
  const { uri } = await Print.printToFileAsync({
    html: buildTicketHtml(ticket),
    width: 420,
    height: 595,
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
