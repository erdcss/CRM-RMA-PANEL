import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getCategoryLabel, getStatusLabel } from '@/constants/statuses';
import type { SupplierItem } from './api';

const A5_WIDTH = 420;
const A5_HEIGHT = 595;

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

function safeFileName(value: string) {
  return value
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 100) || 'Tedarikci';
}

function buildSupplierHtml(supplierName: string, supplierCode: string, items: SupplierItem[]) {
  const now = new Date();
  const totalQty = items.reduce((sum, item) => sum + Number(item.product.quantity ?? 1), 0);

  const rows = items
    .map((item, index) => {
      const product = item.product;
      const ticket = product.ticket;
      const customer = ticket?.customer;
      const receivedAt = ticket?.createdAt || item.createdAt;
      return `
        <tr>
          <td class="center">${index + 1}</td>
          <td>${escapeHtml(product.stockCode || '—')}</td>
          <td>${escapeHtml(product.name || '—')}</td>
          <td class="center">${escapeHtml(product.quantity ?? 1)}</td>
          <td>${escapeHtml(getCategoryLabel(product.category))}</td>
          <td>${escapeHtml(getStatusLabel(product.status))}</td>
          <td>${escapeHtml(customer?.name || '—')}</td>
          <td>${escapeHtml(new Date(receivedAt).toLocaleDateString('tr-TR'))}</td>
        </tr>`;
    })
    .join('');

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A5 portrait; margin: 10mm 8mm; }
        * { box-sizing: border-box; }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
          color: #0f172a;
          font-size: 8.5px;
          line-height: 1.35;
          margin: 0;
        }
        .header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px; }
        .brand { font-size: 13px; font-weight: 800; margin: 0; }
        .brand-sub { font-size: 8px; color: #64748b; margin-top: 2px; }
        .doc-meta { text-align: right; font-size: 8px; color: #334155; }
        .doc-title { font-size: 10px; font-weight: 800; color: #1d4ed8; margin-bottom: 2px; }
        .summary {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 4px 10px;
          padding: 8px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #f8fafc;
          margin-bottom: 8px;
          font-size: 8px;
        }
        .summary span { color: #64748b; }
        .summary strong { color: #0f172a; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; font-size: 7.5px; }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 3px 4px;
          vertical-align: top;
          word-break: break-word;
        }
        th { background: #f1f5f9; font-weight: 700; color: #334155; }
        .center { text-align: center; }
        .signatures {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 40px;
          margin-top: 16px;
          font-size: 8px;
          font-weight: 700;
          text-align: center;
        }
        .sign-line { border-top: 1px solid #94a3b8; margin-top: 22px; padding-top: 4px; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <p class="brand">ÇALIŞKAN GROUP</p>
          <div class="brand-sub">Tedarikçi Sevkiyat Listesi</div>
        </div>
        <div class="doc-meta">
          <div class="doc-title">TESLİM LİSTESİ</div>
          ${escapeHtml(now.toLocaleDateString('tr-TR'))}<br />
          ${escapeHtml(now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))}
        </div>
      </div>

      <div class="summary">
        <div><span>Tedarikçi: </span><strong>${escapeHtml(supplierName)}</strong></div>
        <div><span>Cari Kodu: </span><strong>${escapeHtml(supplierCode || '—')}</strong></div>
        <div><span>Satır: </span><strong>${items.length}</strong></div>
        <div><span>Toplam Adet: </span><strong>${totalQty}</strong></div>
      </div>

      <table>
        <thead>
          <tr>
            <th style="width:5%">#</th>
            <th style="width:14%">Stok</th>
            <th style="width:24%">Ürün</th>
            <th style="width:7%">Adet</th>
            <th style="width:12%">İşlem</th>
            <th style="width:14%">Durum</th>
            <th style="width:14%">Müşteri</th>
            <th style="width:10%">Tarih</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="8">Ürün bulunmuyor.</td></tr>'}</tbody>
      </table>

      <div class="signatures">
        <div>Teslim Eden<div class="sign-line"></div></div>
        <div>Teslim Alan<div class="sign-line"></div></div>
      </div>
    </body>
  </html>`;
}

export async function previewSupplierPdf(supplierName: string, supplierCode: string, items: SupplierItem[]) {
  if (items.length === 0) throw new Error('PDF görüntülemek için tedarikçi listesinde ürün bulunmuyor.');
  await Print.printAsync({ html: buildSupplierHtml(supplierName, supplierCode, items) });
}

export async function createSupplierPdf(supplierName: string, supplierCode: string, items: SupplierItem[]) {
  if (items.length === 0) throw new Error('PDF oluşturmak için tedarikçi listesinde ürün bulunmuyor.');

  const { uri } = await Print.printToFileAsync({
    html: buildSupplierHtml(supplierName, supplierCode, items),
    width: A5_WIDTH,
    height: A5_HEIGHT,
  });

  const fileName = `${safeFileName(supplierName)}-RMA.pdf`;
  const targetUri = `${FileSystem.cacheDirectory}${fileName}`;
  await FileSystem.deleteAsync(targetUri, { idempotent: true });
  await FileSystem.copyAsync({ from: uri, to: targetUri });

  return { uri: targetUri, fileName };
}

export async function shareSupplierPdf(supplierName: string, supplierCode: string, items: SupplierItem[]) {
  const { uri, fileName } = await createSupplierPdf(supplierName, supplierCode, items);

  const available = await Sharing.isAvailableAsync();
  if (!available) throw new Error('Bu cihazda PDF paylaşımı kullanılamıyor.');

  await Sharing.shareAsync(uri, {
    UTI: 'com.adobe.pdf',
    mimeType: 'application/pdf',
    dialogTitle: fileName.replace(/\.pdf$/i, ''),
  });

  return uri;
}
