import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';

import { loadBarcodeSettings, type BarcodeSettings } from './barcodeSettings';
import type { RmaPackage } from './api';

const escapeHtml = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function buildLabelHtml(pkg: RmaPackage, settings: BarcodeSettings) {
  const scanValue = pkg.barcodeValue || pkg.qrValue || pkg.packageNumber;
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(scanValue)}`;

  return `<!doctype html>
<html lang="tr">
<head>
  <meta charset="utf-8" />
  <style>
    @page { size: ${settings.labelWidthMm}mm ${settings.labelHeightMm}mm; margin: 6mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; margin: 0; }
    .brand { text-align: center; font-weight: 700; font-size: 11px; letter-spacing: 0.4px; }
    .subtitle { text-align: center; color: #64748b; font-size: 8px; margin-bottom: 8px; }
    .row { font-size: 8px; margin: 3px 0; }
    .barcode { text-align: center; font-family: 'Courier New', monospace; font-size: ${settings.barcodeFontPt}px; font-weight: 700; margin: 10px 0 6px; word-break: break-all; }
    .qr { display: block; margin: 0 auto; width: ${settings.qrSizeMm}mm; height: ${settings.qrSizeMm}mm; }
    .hint { text-align: center; font-size: 7px; color: #64748b; margin-top: 6px; }
  </style>
</head>
<body>
  <div class="brand">ÇALIŞKAN GROUP · RMA KOLİ</div>
  <div class="subtitle">Tedarikçi sevkiyat etiketi</div>
  <div class="row"><strong>Koli:</strong> ${escapeHtml(pkg.packageNumber)}</div>
  <div class="row"><strong>Tedarikçi:</strong> ${escapeHtml(pkg.supplierName)}</div>
  <div class="row"><strong>Cari:</strong> ${escapeHtml(pkg.supplierAccountCode)}</div>
  <div class="row"><strong>Ürün:</strong> ${pkg.productCount ?? 0} · <strong>Adet:</strong> ${pkg.totalQuantity ?? 0}</div>
  <div class="barcode">${escapeHtml(scanValue)}</div>
  <img class="qr" src="${qrUrl}" alt="QR" />
  <div class="hint">Barkodu tarayarak sevkiyat doğrulaması yapın</div>
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
  const html = buildLabelHtml(pkg, settings);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `${pkg.packageNumber} koli etiketi`,
    });
  } else {
    await Print.printAsync({ html });
  }
}
