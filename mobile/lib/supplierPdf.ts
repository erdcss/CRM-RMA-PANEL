import * as FileSystem from 'expo-file-system/legacy';
import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { getCategoryLabel, getStatusLabel } from '@/constants/statuses';
import type { SupplierItem } from './api';

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
  const rows = items
    .map((item, index) => {
      const product = item.product;
      const ticket = product.ticket;
      const customer = ticket?.customer;
      const receivedAt = ticket?.createdAt || item.createdAt;
      return `
        <tr>
          <td>${index + 1}</td>
          <td>${escapeHtml(product.stockCode || '-')}</td>
          <td>${escapeHtml(product.name || '-')}</td>
          <td>${escapeHtml(product.quantity ?? 1)}</td>
          <td>${escapeHtml(getCategoryLabel(product.category))}</td>
          <td>${escapeHtml(customer?.name || '-')}</td>
          <td>${escapeHtml(new Date(receivedAt).toLocaleDateString('tr-TR'))}</td>
          <td>${escapeHtml(getStatusLabel(product.status))}</td>
          <td>${escapeHtml(product.serialNumber || '-')}</td>
        </tr>`;
    })
    .join('');

  return `<!doctype html>
  <html lang="tr">
    <head>
      <meta charset="utf-8" />
      <style>
        @page { size: A4 landscape; margin: 12mm; }
        body { font-family: Arial, sans-serif; color: #111827; font-size: 10px; }
        .header { display: flex; justify-content: space-between; margin-bottom: 14px; }
        h1 { font-size: 18px; margin: 0 0 4px; }
        .muted { color: #6b7280; font-size: 9px; }
        .summary { margin: 10px 0 14px; padding: 10px; border: 1px solid #d1d5db; border-radius: 8px; }
        table { width: 100%; border-collapse: collapse; table-layout: fixed; }
        th, td { border: 1px solid #d1d5db; padding: 5px; vertical-align: top; word-break: break-word; }
        th { background: #f3f4f6; font-size: 9px; }
        .signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 34px; }
        .sign { border-top: 1px solid #9ca3af; padding-top: 6px; text-align: center; }
      </style>
    </head>
    <body>
      <div class="header">
        <div>
          <h1>Tedarikçi Ürün Teslim Listesi</h1>
          <div class="muted">ÇALIŞKAN CORE · RMA Operasyon</div>
        </div>
        <div>
          <strong>${escapeHtml(now.toLocaleDateString('tr-TR'))}</strong><br />
          <span class="muted">${escapeHtml(now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }))}</span>
        </div>
      </div>

      <div class="summary">
        <strong>Tedarikçi:</strong> ${escapeHtml(supplierName)}<br />
        <strong>Cari Kodu:</strong> ${escapeHtml(supplierCode || '-')}<br />
        <strong>Toplam Satır:</strong> ${items.length}<br />
        <strong>Toplam Adet:</strong> ${items.reduce((sum, item) => sum + Number(item.product.quantity ?? 1), 0)}
      </div>

      <table>
        <thead>
          <tr>
            <th>#</th>
            <th>Stok Kodu</th>
            <th>Ürün</th>
            <th>Adet</th>
            <th>İşlem</th>
            <th>Müşteri</th>
            <th>Geliş Tarihi</th>
            <th>Son Durum</th>
            <th>Seri No</th>
          </tr>
        </thead>
        <tbody>${rows || '<tr><td colspan="9">Ürün bulunmuyor.</td></tr>'}</tbody>
      </table>

      <div class="signatures">
        <div class="sign">Teslim Eden</div>
        <div class="sign">Teslim Alan</div>
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
