import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

interface TicketData {
  id: number;
  receiptNumber?: string;
  customer: {
    name: string;
    phone: string;
    email?: string;
    address?: string;
  };
  products: Array<{
    id: number;
    name: string;
    brand: string;
    model?: string;
    serialNumber?: string;
    stockCode?: string;
    category: string;
    status: string;
    description?: string;
    quantity: number;
  }>;
  createdAt: string;
}

const categoryLabels: Record<string, string> = {
  iade: "Iade",
  degisim: "Degisim",
  servis: "Servis",
};

const statusLabels: Record<string, string> = {
  beklemede: "Beklemede",
  serviste: "Serviste",
  teslim_edildi: "Teslim Edildi",
  iptal: "Iptal",
};

const PDF_FONT = "courier";

function toAscii(text: string): string {
  return text
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/İ/g, "I")
    .replace(/Ğ/g, "G")
    .replace(/Ü/g, "U")
    .replace(/Ş/g, "S")
    .replace(/Ö/g, "O")
    .replace(/Ç/g, "C");
}

function drawTopSection(
  doc: jsPDF,
  ticket: TicketData,
  margin: number,
  pageWidth: number,
): number {
  const ticketNumber = ticket.receiptNumber || `#${ticket.id}`;
  const dateStr = new Date(ticket.createdAt).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = new Date(ticket.createdAt).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });

  let yPos = 7;

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(8.5);
  doc.text(toAscii("CALISKAN GROUP"), margin, yPos);
  doc.text(toAscii("SERVIS FISI"), pageWidth - margin, yPos, { align: "right" });
  yPos += 3;

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(5);
  doc.text(toAscii("Musteri Hizmetleri ve RMA Merkezi"), margin, yPos);
  doc.text(`Tarih: ${dateStr}`, pageWidth - margin, yPos, { align: "right" });
  yPos += 2.2;

  doc.text("Tel: (0xxx) xxx xx xx", margin, yPos);
  doc.text(`Saat: ${timeStr}`, pageWidth - margin, yPos, { align: "right" });
  yPos += 2.2;

  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(5.5);
  doc.text(toAscii(`Fis No: ${ticketNumber}`), pageWidth - margin, yPos, { align: "right" });
  yPos += 2.8;

  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.2);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 2.8;

  doc.setFontSize(5.5);
  doc.setFont(PDF_FONT, "bold");
  doc.text(toAscii("Musteri:"), margin, yPos);
  doc.setFont(PDF_FONT, "normal");
  doc.text(toAscii(ticket.customer.name), margin + 13, yPos);

  doc.setFont(PDF_FONT, "bold");
  doc.text("Tel:", pageWidth / 2 + 2, yPos);
  doc.setFont(PDF_FONT, "normal");
  doc.text(toAscii(ticket.customer.phone || "-"), pageWidth / 2 + 10, yPos);
  yPos += 4;

  const contentWidth = pageWidth - 2 * margin;
  const boxWidth = (contentWidth - 4) / 3;
  doc.setFont(PDF_FONT, "bold");
  doc.setFontSize(5);

  let xPos = margin;
  for (const label of ["Teslim Eden", "Teslim Alan", "Ucret Durumu"]) {
    doc.text(toAscii(label), xPos + boxWidth / 2, yPos, { align: "center" });
    doc.setDrawColor(170, 170, 170);
    doc.line(xPos, yPos + 5, xPos + boxWidth, yPos + 5);
    xPos += boxWidth + 2;
  }
  yPos += 8;

  doc.setFont(PDF_FONT, "normal");
  doc.setFontSize(4.5);
  doc.text(
    toAscii(`Bu belge ${dateStr} tarihinde olusturulmustur.`),
    margin,
    yPos,
  );

  return yPos + 3;
}

export async function generateTicketPDF(ticket: TicketData): Promise<void> {
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a5",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 6;
  const contentWidth = pageWidth - 2 * margin;
  const ticketNumber = ticket.receiptNumber || `#${ticket.id}`;

  const tableStartY = drawTopSection(doc, ticket, margin, pageWidth);

  const tableRows = ticket.products.map((product) => {
    const brandModel = [product.brand, product.model].filter(Boolean).join(" ").trim();
    const status = `${categoryLabels[product.category] ?? product.category} - ${
      statusLabels[product.status] ?? product.status
    }`;

    return [
      String(product.quantity ?? 1),
      toAscii(product.stockCode?.trim() || "-"),
      toAscii(product.name),
      toAscii(brandModel || "-"),
      toAscii(status),
    ];
  });

  autoTable(doc, {
    startY: tableStartY,
    head: [[
      toAscii("Adet"),
      toAscii("Urun Kodu"),
      toAscii("Urun Adi"),
      toAscii("Marka"),
      toAscii("Durum"),
    ]],
    body: tableRows.length > 0 ? tableRows : [["-", "-", "-", "-", "-"]],
    theme: "grid",
    styles: {
      font: PDF_FONT,
      fontSize: 4.8,
      cellPadding: 0.6,
      lineColor: [190, 190, 190],
      lineWidth: 0.1,
      overflow: "linebreak",
      valign: "middle",
    },
    headStyles: {
      fillColor: [240, 240, 240],
      textColor: [30, 30, 30],
      fontStyle: "bold",
      halign: "left",
      fontSize: 4.8,
      cellPadding: 0.8,
    },
    columnStyles: {
      0: { cellWidth: 7, halign: "center" },
      1: { cellWidth: 20 },
      2: { cellWidth: 46 },
      3: { cellWidth: 24 },
      4: { cellWidth: contentWidth - 97 },
    },
    margin: { left: margin, right: margin, top: margin, bottom: margin },
    tableWidth: contentWidth,
    showHead: "everyPage",
    didDrawPage: (data) => {
      if (data.pageNumber === 1) return;

      doc.setFont(PDF_FONT, "bold");
      doc.setFontSize(7);
      doc.text(toAscii("SERVIS FISI (Devam)"), pageWidth / 2, 8, { align: "center" });
      doc.setFont(PDF_FONT, "normal");
      doc.setFontSize(5);
      doc.text(toAscii(`Fis No: ${ticketNumber}`), pageWidth / 2, 11.5, { align: "center" });
    },
    didParseCell: (data) => {
      if (data.section === "body" && data.pageNumber > 1) {
        data.cell.styles.fontSize = 4.8;
      }
    },
    pageBreak: "auto",
    rowPageBreak: "avoid",
  });

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont(PDF_FONT, "normal");
    doc.setFontSize(4);
    doc.text(`${page}/${pageCount}`, pageWidth - margin, pageHeight - 3, { align: "right" });
  }

  const fileName = ticket.receiptNumber
    ? `Fis_${toAscii(ticket.receiptNumber).replace(/\s+/g, "_")}.pdf`
    : `Kayit_${ticket.id}_${toAscii(ticket.customer.name).replace(/\s+/g, "_")}.pdf`;

  doc.save(fileName);
}
