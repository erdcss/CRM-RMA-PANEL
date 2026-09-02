import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import {
  buildLabelProductRows,
  resolvePackageLabelSequence,
  type LabelProductRow,
} from "@shared/package-label";
import { resolvePackageBarcodeValue } from "@shared/shipment-barcode";
import { getPackageStatusLabel } from "@shared/package-constants";
import { loadPackageLabelSettings } from "@/lib/packageLabelSettings";

interface PackageLabelItem {
  quantity?: number | null;
  product?: {
    name?: string | null;
    stockCode?: string | null;
    ticket?: { receiptNumber?: string | null };
  } | null;
}

interface PackageLabelData {
  packageNumber: string;
  supplierName: string;
  supplierAccountCode: string;
  status: string;
  barcodeValue?: string | null;
  qrValue?: string | null;
  createdAt: string;
  closedAt?: string | null;
  productCount?: number;
  totalQuantity?: number;
  items?: PackageLabelItem[];
  labelSequence?: number | null;
  history?: Array<{ eventType?: string | null; metadata?: string | null }>;
}

const PDF_FONT = "courier";

function toAscii(text: string): string {
  return text
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ö/g, "o").replace(/ç/g, "c").replace(/İ/g, "I").replace(/Ğ/g, "G")
    .replace(/Ü/g, "U").replace(/Ş/g, "S").replace(/Ö/g, "O").replace(/Ç/g, "C");
}

function drawProductRows(doc: jsPDF, rows: LabelProductRow[], startY: number, margin: number, pageWidth: number) {
  let y = startY;
  const tableWidth = pageWidth - margin * 2;
  const slotW = 8;
  const qtyW = 12;
  const nameW = tableWidth - slotW - qtyW;

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(6);
  doc.setFillColor(241, 245, 249);
  doc.rect(margin, y, tableWidth, 5, "F");
  doc.text("#", margin + 2, y + 3.5);
  doc.text(toAscii("Urun"), margin + slotW + 2, y + 3.5);
  doc.text(toAscii("Adet"), margin + slotW + nameW + 4, y + 3.5);
  y += 5;

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(5.5);

  for (const row of rows) {
    if (y > 118) break;
    const nameLines = doc.splitTextToSize(toAscii(row.name), nameW - 4);
    const meta = toAscii(`${row.stockCode}${row.receiptNumber ? ` · ${row.receiptNumber}` : ""}`);
    const metaLines = doc.splitTextToSize(meta, nameW - 4);
    const rowHeight = Math.max(7, (nameLines.length + metaLines.length) * 2.6 + 2);

    doc.setDrawColor(226, 232, 240);
    doc.rect(margin, y, slotW, rowHeight);
    doc.rect(margin + slotW, y, nameW, rowHeight);
    doc.rect(margin + slotW + nameW, y, qtyW, rowHeight);

    doc.setFont(PDF_FONT, "bold");
    doc.setTextColor(29, 78, 216);
    doc.text(String(row.slot), margin + slotW / 2, y + rowHeight / 2 + 1, { align: "center" });

    doc.setTextColor(15, 23, 42);
    doc.setFont(PDF_FONT, "bold");
    doc.text(nameLines, margin + slotW + 2, y + 3);
    doc.setFont(PDF_FONT, "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(metaLines, margin + slotW + 2, y + 3 + nameLines.length * 2.6);

    doc.setTextColor(15, 23, 42);
    doc.setFont(PDF_FONT, "bold");
    doc.text(String(row.quantity), margin + slotW + nameW + qtyW / 2, y + rowHeight / 2 + 1, {
      align: "center",
    });

    y += rowHeight;
  }

  return y;
}

export async function generatePackageLabelPDF(data: PackageLabelData): Promise<void> {
  const settings = loadPackageLabelSettings();
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: [settings.labelWidthMm, settings.labelHeightMm],
  });
  const margin = 6;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 7;

  const scanValue = resolvePackageBarcodeValue(data);
  if (!scanValue) {
    throw new Error("Koli barkodu atanmamış veya geçersiz. Önce koliyi kapatıp 9 haneli barkod alın.");
  }
  const labelSequence = resolvePackageLabelSequence({
    labelSequence: data.labelSequence,
    barcodeValue: scanValue,
    history: data.history,
  }) ?? 1;
  const productRows = buildLabelProductRows(data.items ?? []);

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(9);
  doc.setTextColor(30, 58, 138);
  doc.text(toAscii("CALISKAN GROUP · RMA KOLI"), pageWidth / 2, y, { align: "center" });
  y += 4;

  doc.setFontSize(6);
  doc.setTextColor(100, 116, 139);
  doc.text(toAscii("TEDARIKCI SEVKIYAT ETIKETI"), pageWidth / 2, y, { align: "center" });
  y += 7;

  doc.setFillColor(239, 246, 255);
  doc.setDrawColor(147, 197, 253);
  doc.roundedRect(margin, y, pageWidth - margin * 2, 16, 2, 2, "FD");

  doc.setFillColor(29, 78, 216);
  doc.circle(margin + 10, y + 8, 7, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.text(String(labelSequence), margin + 10, y + 9.2, { align: "center" });

  doc.setTextColor(30, 58, 138);
  doc.setFontSize(8);
  doc.text(toAscii(`Koli Sira No · ${labelSequence}/9`), margin + 21, y + 6);
  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(5.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    toAscii("Ayni tedarikciye giden aktif kolilerde 1-9 arasi benzersiz numara"),
    margin + 21,
    y + 10.5,
  );
  y += 19;

  doc.setTextColor(15, 23, 42);
  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(7);
  doc.text(toAscii(`Koli: ${data.packageNumber}`), margin, y);
  y += 4;
  doc.text(toAscii(`Tedarikci: ${data.supplierName}`), margin, y);
  y += 4;
  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(6);
  doc.text(toAscii(`Cari: ${data.supplierAccountCode}`), margin, y);
  doc.text(
    toAscii(`Tarih: ${new Date(data.closedAt || data.createdAt).toLocaleDateString("tr-TR")}`),
    margin + 46,
    y,
  );
  y += 4;
  doc.text(
    toAscii(`Urun: ${data.productCount ?? productRows.length} / Adet: ${data.totalQuantity ?? 0}`),
    margin,
    y,
  );
  doc.text(toAscii(`Durum: ${getPackageStatusLabel(data.status)}`), margin + 46, y);
  y += 5;

  y = drawProductRows(doc, productRows, y, margin, pageWidth);
  y += 3;

  doc.setDrawColor(203, 213, 225);
  doc.line(margin, y, pageWidth - margin, y);
  y += 4;

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(8);
  doc.setTextColor(15, 23, 42);
  doc.text(scanValue, pageWidth / 2, y, { align: "center", maxWidth: pageWidth - margin * 2 });
  y += 5;

  try {
    const qrDataUrl = await QRCode.toDataURL(scanValue, { width: 200, margin: 1 });
    const qrSize = settings.qrSizeMm;
    doc.addImage(qrDataUrl, "PNG", (pageWidth - qrSize) / 2, y, qrSize, qrSize);
    y += qrSize + 3;
  } catch {
    doc.text(toAscii("QR uretilemedi"), pageWidth / 2, y, { align: "center" });
  }

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(5);
  doc.setTextColor(100, 116, 139);
  doc.text(toAscii("Barkodu tarayarak sevkiyat dogrulamasi yapin"), pageWidth / 2, y, { align: "center" });

  doc.save(`Koli_${toAscii(data.packageNumber).replace(/\s+/g, "_")}_etiket.pdf`);
}
