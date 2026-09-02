import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import {
  buildLabelProductRows,
  resolvePackageLabelSequence,
  type LabelProductRow,
} from './packageLabelUtils';

import { loadBarcodeSettings, type BarcodeSettings } from './barcodeSettings';
import type { RmaPackage } from './api';

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function formatDate(value?: string | null) {
  if (!value) return '—';
  try {
    return new Date(value).toLocaleDateString('tr-TR');
  } catch {
    return '—';
  }
}

function renderProductRows(rows: LabelProductRow[]) {
  if (rows.length === 0) {
    return `<tr><td colspan="3" class="empty">Kolide ürün yok</td></tr>`;
  }

  return rows
    .map(
      (row) => `
      <tr>
        <td class="slot">${row.slot}</td>
        <td class="product">
          <div class="product-name">${escapeHtml(row.name)}</div>
          <div class="product-meta">${escapeHtml(row.stockCode)}${row.receiptNumber ? ` · ${escapeHtml(row.receiptNumber)}` : ''}</div>
        </td>
        <td class="qty">${row.quantity}</td>
      </tr>`,
    )
    .join('');
}

function buildLabelHtml(pkg: RmaPackage, settings: BarcodeSettings) {
  const scanValue = pkg.barcodeValue || pkg.qrValue || pkg.packageNumber;
  const labelSequence = resolvePackageLabelSequence({
    labelSequence: pkg.labelSequence,
    barcodeValue: scanValue,
    history: pkg.history,
  }) ?? 1;
  const productRows = buildLabelProductRows(pkg.items ?? []);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&data=${encodeURIComponent(scanValue)}`;

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${settings.labelWidthMm}mm ${settings.labelHeightMm}mm; margin: 5mm; }
    * { box-sizing: border-box; }
    body {
      font-family: Arial, Helvetica, sans-serif;
      color: #0f172a;
      margin: 0;
      background: #fff;
    }
    .sheet {
      border: 1.5px solid #cbd5e1;
      border-radius: 6px;
      padding: 8px;
      min-height: calc(${settings.labelHeightMm}mm - 10mm);
    }
    .brand {
      text-align: center;
      font-weight: 800;
      font-size: 11px;
      letter-spacing: 0.5px;
      color: #1e3a8a;
    }
    .subtitle {
      text-align: center;
      color: #64748b;
      font-size: 7.5px;
      margin: 2px 0 8px;
      text-transform: uppercase;
      letter-spacing: 0.3px;
    }
    .hero {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
      padding: 6px 8px;
      border-radius: 8px;
      background: linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%);
      border: 1px solid #93c5fd;
    }
    .seq-badge {
      width: 42px;
      height: 42px;
      border-radius: 50%;
      background: #1d4ed8;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      font-weight: 800;
      flex-shrink: 0;
      box-shadow: 0 2px 4px rgba(29, 78, 216, 0.25);
    }
    .hero-text { flex: 1; min-width: 0; }
    .hero-title {
      font-size: 10px;
      font-weight: 700;
      color: #1e3a8a;
      margin-bottom: 2px;
    }
    .hero-hint {
      font-size: 7px;
      color: #475569;
      line-height: 1.3;
    }
    .meta {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 3px 8px;
      font-size: 7px;
      margin-bottom: 8px;
      padding-bottom: 6px;
      border-bottom: 1px dashed #cbd5e1;
    }
    .meta span { color: #64748b; }
    .meta strong { color: #0f172a; font-weight: 700; }
    .meta .full { grid-column: 1 / -1; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 7px;
      margin-bottom: 8px;
    }
    th {
      text-align: left;
      background: #f1f5f9;
      color: #334155;
      font-weight: 700;
      padding: 3px 4px;
      border: 1px solid #e2e8f0;
    }
    td {
      padding: 3px 4px;
      border: 1px solid #e2e8f0;
      vertical-align: top;
    }
    .slot {
      width: 16px;
      text-align: center;
      font-weight: 800;
      color: #1d4ed8;
      background: #eff6ff;
    }
    .product-name {
      font-weight: 700;
      line-height: 1.2;
      word-break: break-word;
    }
    .product-meta {
      color: #64748b;
      font-size: 6px;
      margin-top: 1px;
    }
    .qty {
      width: 22px;
      text-align: center;
      font-weight: 700;
    }
    .empty {
      text-align: center;
      color: #94a3b8;
      padding: 8px;
    }
    .scan-block {
      text-align: center;
      margin-top: 4px;
      padding-top: 6px;
      border-top: 1px solid #e2e8f0;
    }
    .barcode-lines {
      height: 28px;
      margin: 0 auto 4px;
      max-width: 92%;
      background: repeating-linear-gradient(
        90deg,
        #0f172a 0 2px,
        transparent 2px 4px,
        #0f172a 4px 5px,
        transparent 5px 8px
      );
    }
    .barcode-value {
      font-family: 'Courier New', monospace;
      font-size: ${Math.max(8, settings.barcodeFontPt - 4)}px;
      font-weight: 700;
      word-break: break-all;
      line-height: 1.2;
      color: #0f172a;
    }
    .qr {
      display: block;
      margin: 6px auto 0;
      width: ${settings.qrSizeMm}mm;
      height: ${settings.qrSizeMm}mm;
    }
    .hint {
      text-align: center;
      font-size: 6.5px;
      color: #64748b;
      margin-top: 4px;
    }
  </style>
</head>
<body>
  <div class="sheet">
    <div class="brand">ÇALIŞKAN GROUP · RMA KOLİ</div>
    <div class="subtitle">Tedarikçi sevkiyat etiketi</div>

    <div class="hero">
      <div class="seq-badge">${labelSequence}</div>
      <div class="hero-text">
        <div class="hero-title">Koli Sıra No · ${labelSequence}/9</div>
        <div class="hero-hint">Aynı tedarikçiye giden aktif kolilerde 1–9 arası benzersiz numara</div>
      </div>
    </div>

    <div class="meta">
      <div class="full"><span>Koli: </span><strong>${escapeHtml(pkg.packageNumber)}</strong></div>
      <div class="full"><span>Tedarikçi: </span><strong>${escapeHtml(pkg.supplierName)}</strong></div>
      <div><span>Cari: </span><strong>${escapeHtml(pkg.supplierAccountCode)}</strong></div>
      <div><span>Tarih: </span><strong>${formatDate(pkg.closedAt || pkg.createdAt)}</strong></div>
      <div><span>Ürün: </span><strong>${pkg.productCount ?? productRows.length}</strong></div>
      <div><span>Adet: </span><strong>${pkg.totalQuantity ?? productRows.reduce((s, r) => s + r.quantity, 0)}</strong></div>
    </div>

    <table>
      <thead>
        <tr>
          <th>#</th>
          <th>Ürün içeriği</th>
          <th>Adet</th>
        </tr>
      </thead>
      <tbody>
        ${renderProductRows(productRows)}
      </tbody>
    </table>

    <div class="scan-block">
      <div class="barcode-lines"></div>
      <div class="barcode-value">${escapeHtml(scanValue)}</div>
      <img class="qr" src="${qrUrl}" alt="QR" />
      <div class="hint">Barkodu tarayarak sevkiyat doğrulaması yapın</div>
    </div>
  </div>
</body>
</html>`;
}

export async function printPackageLabel(pkg: RmaPackage) {
  const settings = await loadBarcodeSettings();
  const html = buildLabelHtml(pkg, settings);
  await Print.printAsync({ html });
}

export async function sharePackageLabelPdf(pkg: RmaPackage) {
  const settings = await loadBarcodeSettings();
  const scanValue = pkg.barcodeValue || pkg.qrValue || pkg.packageNumber;
  const productRows = buildLabelProductRows(pkg.items ?? []);
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(scanValue)}`;

  const rows = productRows
    .map(
      (row) => `
      <tr>
        <td class="center">${row.slot}</td>
        <td>${escapeHtml(row.name)}</td>
        <td>${escapeHtml(row.stockCode)}</td>
        <td class="center">${row.quantity}</td>
      </tr>`,
    )
    .join('');

  const a5Html = `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: A5 portrait; margin: 10mm 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
      color: #0f172a;
      font-size: 9px;
      margin: 0;
    }
    .header { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .brand { font-size: 13px; font-weight: 800; margin: 0; }
    .meta { font-size: 8px; color: #64748b; text-align: right; }
    .card {
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 8px;
      margin-bottom: 8px;
      background: #f8fafc;
    }
    .barcode { font-family: "Courier New", monospace; font-size: 9px; font-weight: 700; word-break: break-all; }
    table { width: 100%; border-collapse: collapse; font-size: 8px; margin-bottom: 8px; }
    th, td { border: 1px solid #cbd5e1; padding: 4px; vertical-align: top; word-break: break-word; }
    th { background: #f1f5f9; }
    .center { text-align: center; }
    .qr-wrap { text-align: center; margin-top: 6px; }
    .qr { width: ${settings.qrSizeMm + 8}mm; height: ${settings.qrSizeMm + 8}mm; }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <p class="brand">ÇALIŞKAN GROUP · KOLİ ETİKETİ</p>
      <div>${escapeHtml(pkg.packageNumber)}</div>
    </div>
    <div class="meta">${escapeHtml(formatDate(pkg.closedAt || pkg.createdAt))}</div>
  </div>
  <div class="card">
    <div><strong>Tedarikçi:</strong> ${escapeHtml(pkg.supplierName)} (${escapeHtml(pkg.supplierAccountCode)})</div>
    <div class="barcode">${escapeHtml(scanValue)}</div>
  </div>
  <table>
    <thead>
      <tr><th>#</th><th>Ürün</th><th>Stok</th><th>Adet</th></tr>
    </thead>
    <tbody>${rows || '<tr><td colspan="4">Ürün yok</td></tr>'}</tbody>
  </table>
  <div class="qr-wrap"><img class="qr" src="${qrUrl}" alt="QR" /></div>
</body>
</html>`;

  const { uri } = await Print.printToFileAsync({
    html: a5Html,
    width: 420,
    height: 595,
  });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${pkg.packageNumber} koli etiketi`,
    });
  } else {
    await Print.printAsync({ html: a5Html });
  }
}
