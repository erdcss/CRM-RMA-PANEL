import { jsPDF } from "jspdf";
import QRCode from "qrcode";
import { getPackageStatusLabel } from "@shared/package-constants";

interface PackageLabelData {
  packageNumber: string;
  supplierName: string;
  supplierAccountCode: string;
  status: string;
  barcodeValue?: string | null;
  qrValue?: string | null;
  createdAt: string;
  productCount?: number;
  totalQuantity?: number;
}

const PDF_FONT = "courier";

function toAscii(text: string): string {
  return text
    .replace(/ı/g, "i").replace(/ğ/g, "g").replace(/ü/g, "u").replace(/ş/g, "s")
    .replace(/ö/g, "o").replace(/ç/g, "c").replace(/İ/g, "I").replace(/Ğ/g, "G")
    .replace(/Ü/g, "U").replace(/Ş/g, "S").replace(/Ö/g, "O").replace(/Ç/g, "C");
}

export async function generatePackageLabelPDF(data: PackageLabelData): Promise<void> {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [100, 150] });
  const margin = 6;
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 8;

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(10);
  doc.text(toAscii("CALISKAN GROUP"), pageWidth / 2, y, { align: "center" });
  y += 5;

  doc.setFontSize(8);
  doc.setFont(PDF_FONT, "normal");
  doc.text(toAscii("RMA KOLI ETIKETI"), pageWidth / 2, y, { align: "center" });
  y += 6;

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(9);
  doc.text(toAscii(`Koli: ${data.packageNumber}`), margin, y);
  y += 5;

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(7);
  doc.text(toAscii(`Tedarikci: ${data.supplierName}`), margin, y);
  y += 4;
  doc.text(toAscii(`Kod: ${data.supplierAccountCode}`), margin, y);
  y += 4;
  doc.text(
    toAscii(`Tarih: ${new Date(data.createdAt).toLocaleDateString("tr-TR")}`),
    margin,
    y,
  );
  y += 4;
  doc.text(
    toAscii(`Urun: ${data.productCount ?? 0} / Adet: ${data.totalQuantity ?? 0}`),
    margin,
    y,
  );
  y += 4;
  doc.text(toAscii(`Durum: ${getPackageStatusLabel(data.status)}`), margin, y);
  y += 6;

  const scanValue = data.barcodeValue || data.qrValue || data.packageNumber;

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(14);
  doc.text(scanValue, pageWidth / 2, y, { align: "center" });
  y += 8;

  try {
    const qrDataUrl = await QRCode.toDataURL(scanValue, { width: 200, margin: 1 });
    const qrSize = 38;
    doc.addImage(qrDataUrl, "PNG", (pageWidth - qrSize) / 2, y, qrSize, qrSize);
    y += qrSize + 4;
  } catch {
    doc.text(toAscii("QR uretilemedi"), pageWidth / 2, y, { align: "center" });
  }

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(6);
  doc.text(toAscii(scanValue), pageWidth / 2, y, { align: "center" });

  doc.save(`Koli_${toAscii(data.packageNumber).replace(/\s+/g, "_")}_etiket.pdf`);
}
