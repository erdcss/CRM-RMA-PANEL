import { jsPDF } from "jspdf";
import QRCode from "qrcode";

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
    category: string;
    status: string;
    description?: string;
    quantity: number;
  }>;
  createdAt: string;
}

const categoryLabels: Record<string, string> = {
  iade: "İade",
  degisim: "Değişim",
  servis: "Servis",
};

const statusLabels: Record<string, string> = {
  beklemede: "Beklemede",
  serviste: "Serviste",
  teslim_edildi: "Teslim Edildi",
  iptal: "İptal",
};

function truncateText(doc: jsPDF, text: string, maxWidth: number): string {
  if (doc.getTextWidth(text) <= maxWidth) {
    return text;
  }
  
  let truncated = text;
  while (doc.getTextWidth(truncated + "...") > maxWidth && truncated.length > 0) {
    truncated = truncated.slice(0, -1);
  }
  return truncated + "...";
}

function drawTablePage(
  doc: jsPDF,
  products: TicketData['products'],
  startIndex: number,
  pageWidth: number,
  pageHeight: number,
  margin: number,
  isFirstPage: boolean,
  ticketNumber: string,
  startY?: number
) {
  const colWidths = {
    adet: 15,
    urun: 45,
    marka: 35,
    durum: 33,
  };
  
  const rowHeight = 6;
  const maxRowsPerPage = 15;
  let yPos: number;
  
  if (isFirstPage) {
    yPos = startY || 60; // Use provided Y position for first page
  } else {
    yPos = 15;
    
    // Page title
    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 41, 55);
    doc.text("SERVİS FİŞİ (Devam)", pageWidth / 2, yPos, { align: "center" });
    yPos += 3;
    
    doc.setFontSize(9);
    doc.text(`Fiş No: ${ticketNumber}`, pageWidth / 2, yPos, { align: "center" });
    yPos += 8;
  }
  
  // Store table start position for this page
  const tableStartY = yPos;
  
  // Draw table header background
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, yPos - 4, pageWidth - 2 * margin, 7, 'F');
  
  // Table header text
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 41, 55);
  
  let xPos = margin + 1;
  doc.text("ADET", xPos + colWidths.adet / 2, yPos, { align: "center" });
  
  xPos += colWidths.adet;
  doc.text("ÜRÜN ADI", xPos + 2, yPos);
  
  xPos += colWidths.urun;
  doc.text("MARKA/MODEL", xPos + 2, yPos);
  
  xPos += colWidths.marka;
  doc.text("DURUM", xPos + 2, yPos);
  
  yPos += 4;
  
  // Draw header bottom line
  doc.setLineWidth(0.5);
  doc.setDrawColor(180, 180, 180);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  
  // Draw table rows (always draw 15 rows)
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  
  for (let i = 0; i < maxRowsPerPage; i++) {
    yPos += rowHeight;
    const productIndex = startIndex + i;
    
    if (productIndex < products.length) {
      const product = products[productIndex];
      
      // ADET
      xPos = margin + 1;
      doc.text(product.quantity.toString(), xPos + colWidths.adet / 2, yPos - 1.5, { align: "center" });
      
      // ÜRÜN ADI
      xPos += colWidths.adet;
      const productName = truncateText(doc, product.name, colWidths.urun - 4);
      doc.text(productName, xPos + 2, yPos - 1.5);
      
      // MARKA/MODEL
      xPos += colWidths.urun;
      let brandModel = product.brand;
      if (product.model) brandModel += ` ${product.model}`;
      const brandText = truncateText(doc, brandModel, colWidths.marka - 4);
      doc.text(brandText, xPos + 2, yPos - 1.5);
      
      // DURUM
      xPos += colWidths.marka;
      const status = `${categoryLabels[product.category]} - ${statusLabels[product.status]}`;
      const statusText = truncateText(doc, status, colWidths.durum - 4);
      doc.text(statusText, xPos + 2, yPos - 1.5);
    }
    
    // Draw row line
    doc.setDrawColor(220, 220, 220);
    doc.setLineWidth(0.2);
    doc.line(margin, yPos + 1, pageWidth - margin, yPos + 1);
  }
  
  const tableEndY = yPos + 1;
  
  // Draw vertical lines for this page
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.3);
  
  xPos = margin;
  doc.line(xPos, tableStartY - 4, xPos, tableEndY);
  
  xPos += colWidths.adet;
  doc.line(xPos, tableStartY - 4, xPos, tableEndY);
  
  xPos += colWidths.urun;
  doc.line(xPos, tableStartY - 4, xPos, tableEndY);
  
  xPos += colWidths.marka;
  doc.line(xPos, tableStartY - 4, xPos, tableEndY);
  
  xPos += colWidths.durum;
  doc.line(xPos, tableStartY - 4, xPos, tableEndY);
  
  return tableEndY;
}

export async function generateTicketPDF(ticket: TicketData): Promise<void> {
  // A5 format (148 x 210 mm)
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a5",
  });
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 10;
  let yPos = 15;

  // Global font settings
  doc.setFont("helvetica");

  // ======================
  // HEADER SECTION
  // ======================
  
  // Left side - Company info
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 41, 55);
  doc.text("ÇALIŞKAN GROUP", margin, yPos);
  yPos += 5;
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text("Müşteri Hizmetleri ve RMA Merkezi", margin, yPos);
  yPos += 4;
  doc.text("Tel: (0xxx) xxx xx xx", margin, yPos);
  
  // Right side - Form title and date
  const rightX = pageWidth - margin;
  yPos = 15;
  
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 41, 55);
  doc.text("SERVİS FİŞİ", rightX, yPos, { align: "right" });
  yPos += 6;
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  const dateStr = new Date(ticket.createdAt).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
  const timeStr = new Date(ticket.createdAt).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(`Tarih: ${dateStr}`, rightX, yPos, { align: "right" });
  yPos += 4;
  doc.text(`Saat: ${timeStr}`, rightX, yPos, { align: "right" });
  
  // Receipt/Ticket number
  yPos += 5;
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 41, 55);
  const ticketNumber = ticket.receiptNumber || `#${ticket.id}`;
  doc.text(`Fiş No: ${ticketNumber}`, rightX, yPos, { align: "right" });

  // Horizontal line
  yPos = 38;
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 6;

  // ======================
  // CUSTOMER INFO SECTION
  // ======================
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 41, 55);
  doc.text("Müşteri Adı:", margin, yPos);
  
  doc.setFont("helvetica", "normal");
  doc.text(ticket.customer.name, margin + 25, yPos);
  yPos += 5;
  
  doc.setFont("helvetica", "bold");
  doc.text("Telefon:", margin, yPos);
  
  doc.setFont("helvetica", "normal");
  doc.text(ticket.customer.phone, margin + 25, yPos);
  yPos += 5;

  if (ticket.customer.address) {
    doc.setFont("helvetica", "bold");
    doc.text("Adres:", margin, yPos);
    
    doc.setFont("helvetica", "normal");
    const addressLines = doc.splitTextToSize(ticket.customer.address, pageWidth - margin - 30);
    addressLines.forEach((line: string, index: number) => {
      doc.text(line, margin + 25, yPos + (index * 4));
    });
    yPos += addressLines.length * 4 + 1;
  }

  yPos += 2;

  // ======================
  // TABLE SECTION WITH PAGINATION
  // ======================
  
  const maxRowsPerPage = 15;
  const totalProducts = ticket.products.length;
  const totalPages = Math.ceil(totalProducts / maxRowsPerPage);
  
  for (let page = 0; page < Math.max(1, totalPages); page++) {
    const startIndex = page * maxRowsPerPage;
    const isFirstPage = page === 0;
    const isLastPage = page === totalPages - 1 || totalPages === 0;
    
    if (!isFirstPage) {
      doc.addPage();
    }
    
    const tableEndY = drawTablePage(
      doc,
      ticket.products,
      startIndex,
      pageWidth,
      pageHeight,
      margin,
      isFirstPage,
      ticketNumber,
      isFirstPage ? yPos : undefined
    );
    
    // Add continuation footer if not last page
    if (!isLastPage && totalProducts > maxRowsPerPage) {
      doc.setFontSize(7);
      doc.setFont("helvetica", "italic");
      doc.setTextColor(100, 100, 100);
      doc.text("(devamı sonraki sayfada)", pageWidth / 2, pageHeight - 10, { align: "center" });
    }
    
    // Add footer only on last page
    if (isLastPage) {
      yPos = tableEndY + 6;
      
      // Signature boxes
      const boxWidth = (pageWidth - 2 * margin - 10) / 3;
      
      doc.setFontSize(8);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(31, 41, 55);
      
      // Teslim Eden
      let xPos = margin;
      doc.text("Teslim Eden", xPos, yPos);
      doc.setDrawColor(180, 180, 180);
      doc.setLineWidth(0.3);
      doc.line(xPos, yPos + 10, xPos + boxWidth, yPos + 10);
      
      // Teslim Alan
      xPos += boxWidth + 5;
      doc.text("Teslim Alan", xPos, yPos);
      doc.line(xPos, yPos + 10, xPos + boxWidth, yPos + 10);
      
      // Ücret Durumu
      xPos += boxWidth + 5;
      doc.text("Ücret Durumu", xPos, yPos);
      doc.line(xPos, yPos + 10, xPos + boxWidth, yPos + 10);

      // QR Code (bottom right)
      const qrCodeUrl = `${window.location.origin}/kayit/${ticket.id}`;
      try {
        const qrDataUrl = await QRCode.toDataURL(qrCodeUrl, {
          width: 80,
          margin: 1,
          color: {
            dark: "#1f2937",
            light: "#ffffff",
          },
        });
        const qrSize = 20;
        doc.addImage(qrDataUrl, "PNG", pageWidth - margin - qrSize, pageHeight - margin - qrSize - 5, qrSize, qrSize);
      } catch (error) {
        console.error("QR Code generation error:", error);
      }

      // Footer text
      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(150, 150, 150);
      doc.text(
        `Bu belge ${new Date().toLocaleDateString("tr-TR")} tarihinde otomatik oluşturulmuştur.`,
        margin,
        pageHeight - margin - 2
      );
    }
  }

  // Save PDF
  const fileName = ticket.receiptNumber 
    ? `Fis_${ticket.receiptNumber.replace(/\s+/g, "_")}.pdf`
    : `Kayit_${ticket.id}_${ticket.customer.name.replace(/\s+/g, "_")}.pdf`;
  
  doc.save(fileName);
}
