import { jsPDF } from "jspdf";
import autoTable from 'jspdf-autotable';
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

// Helper function to convert Turkish characters to ASCII for PDF compatibility
function toAscii(text: string): string {
  return text
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'I')
    .replace(/Ğ/g, 'G')
    .replace(/Ü/g, 'U')
    .replace(/Ş/g, 'S')
    .replace(/Ö/g, 'O')
    .replace(/Ç/g, 'C');
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
  const margin = 8;
  let yPos = 12;

  // ======================
  // HEADER SECTION - Daha sıkı
  // ======================
  
  // Left side - Company info
  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.text(toAscii("ÇALIŞKAN GROUP"), margin, yPos);
  yPos += 4;
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text(toAscii("Müşteri Hizmetleri ve RMA Merkezi"), margin, yPos);
  yPos += 3;
  doc.text("Tel: (0xxx) xxx xx xx", margin, yPos);
  
  // Right side - Form title and date
  const rightX = pageWidth - margin;
  yPos = 12;
  
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.text(toAscii("SERVİS FİŞİ"), rightX, yPos, { align: "right" });
  yPos += 5;
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
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
  yPos += 3;
  doc.text(`Saat: ${timeStr}`, rightX, yPos, { align: "right" });
  
  // Receipt/Ticket number
  yPos += 4;
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  const ticketNumber = ticket.receiptNumber || `#${ticket.id}`;
  doc.text(toAscii(`Fiş No: ${ticketNumber}`), rightX, yPos, { align: "right" });

  // Horizontal line - ince
  yPos = 30;
  doc.setDrawColor(220, 220, 220);
  doc.setLineWidth(0.3);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 4;

  // ======================
  // CUSTOMER INFO - Daha sıkı
  // ======================
  
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text(toAscii("Müşteri Adı:"), margin, yPos);
  
  doc.setFont("helvetica", "normal");
  doc.text(toAscii(ticket.customer.name), margin + 22, yPos);
  yPos += 4;
  
  doc.setFont("helvetica", "bold");
  doc.text("Telefon:", margin, yPos);
  
  doc.setFont("helvetica", "normal");
  doc.text(ticket.customer.phone, margin + 22, yPos);
  yPos += 5;

  // ======================
  // TABLE SECTION - autoTable ile UTF-8 desteği
  // ======================
  
  const maxRowsPerPage = 15;
  const totalProducts = ticket.products.length;
  
  // Prepare table data
  const tableRows: any[] = [];
  
  for (let i = 0; i < Math.max(maxRowsPerPage, totalProducts); i++) {
    if (i < totalProducts) {
      const product = ticket.products[i];
      let brandModel = product.brand;
      if (product.model) brandModel += ` ${product.model}`;
      
      // Convert Turkish characters for compatibility using toAscii helper
      const productName = toAscii(product.name);
      const brandText = toAscii(brandModel);
      const status = toAscii(`${categoryLabels[product.category]} - ${statusLabels[product.status]}`);
      
      tableRows.push([
        product.quantity.toString(),
        productName,
        brandText,
        status
      ]);
    } else {
      tableRows.push(['', '', '', '']);
    }
  }
  
  // Draw table with autoTable
  autoTable(doc, {
    startY: yPos,
    head: [[toAscii('ADET'), toAscii('ÜRÜN ADI'), toAscii('MARKA/MODEL'), toAscii('DURUM')]],
    body: tableRows.slice(0, maxRowsPerPage),
    theme: 'grid',
    styles: {
      fontSize: 7,
      cellPadding: 1.5,
      lineColor: [200, 200, 200],
      lineWidth: 0.1,
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [245, 245, 245],
      textColor: [40, 40, 40],
      fontStyle: 'bold',
      halign: 'left',
      fontSize: 7,
      cellPadding: 2,
    },
    columnStyles: {
      0: { cellWidth: 13, halign: 'center' },
      1: { cellWidth: 44 },
      2: { cellWidth: 34 },
      3: { cellWidth: 31 },
    },
    margin: { left: margin, right: margin },
    tableWidth: pageWidth - 2 * margin,
    didDrawPage: (data) => {
      // Handle pagination if more than 15 products
      if (data.pageNumber > 1) {
        // Add continuation header
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.text(toAscii("SERVİS FİŞİ (Devam)"), pageWidth / 2, 12, { align: "center" });
        
        doc.setFontSize(8);
        doc.text(toAscii(`Fiş No: ${ticketNumber}`), pageWidth / 2, 17, { align: "center" });
      }
      
      // Add continuation footer if not last page
      const currentPageProducts = maxRowsPerPage * data.pageNumber;
      if (totalProducts > currentPageProducts) {
        doc.setFontSize(6);
        doc.setFont("helvetica", "italic");
        doc.text(toAscii("(devamı sonraki sayfada)"), pageWidth / 2, pageHeight - 6, { align: "center" });
      }
    },
  });
  
  // Get final Y position after table
  const finalY = (doc as any).lastAutoTable.finalY || yPos + 95;
  
  // ======================
  // FOOTER SECTION - Sadece son sayfada
  // ======================
  
  yPos = finalY + 5;
  
  // Signature boxes - daha sıkı
  const boxWidth = (pageWidth - 2 * margin - 8) / 3;
  
  doc.setFontSize(7);
  doc.setFont("helvetica", "bold");
  
  // Teslim Eden
  let xPos = margin;
  doc.text(toAscii("Teslim Eden"), xPos, yPos);
  doc.setDrawColor(180, 180, 180);
  doc.setLineWidth(0.2);
  doc.line(xPos, yPos + 8, xPos + boxWidth, yPos + 8);
  
  // Teslim Alan
  xPos += boxWidth + 4;
  doc.text(toAscii("Teslim Alan"), xPos, yPos);
  doc.line(xPos, yPos + 8, xPos + boxWidth, yPos + 8);
  
  // Ücret Durumu
  xPos += boxWidth + 4;
  doc.text(toAscii("Ücret Durumu"), xPos, yPos);
  doc.line(xPos, yPos + 8, xPos + boxWidth, yPos + 8);

  // QR Code (bottom right) - daha küçük
  const qrCodeUrl = `${window.location.origin}/kayit/${ticket.id}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrCodeUrl, {
      width: 70,
      margin: 1,
      color: {
        dark: "#1f2937",
        light: "#ffffff",
      },
    });
    const qrSize = 18;
    doc.addImage(qrDataUrl, "PNG", pageWidth - margin - qrSize, pageHeight - margin - qrSize - 3, qrSize, qrSize);
  } catch (error) {
    console.error("QR Code generation error:", error);
  }

  // Footer text - küçük
  doc.setFontSize(6);
  doc.setFont("helvetica", "normal");
  const footerText = toAscii(`Bu belge ${new Date().toLocaleDateString("tr-TR")} tarihinde otomatik oluşturulmuştur.`);
  doc.text(footerText, margin, pageHeight - margin - 1);

  // Save PDF
  const fileName = ticket.receiptNumber 
    ? `Fis_${toAscii(ticket.receiptNumber).replace(/\s+/g, "_")}.pdf`
    : `Kayit_${ticket.id}_${toAscii(ticket.customer.name).replace(/\s+/g, "_")}.pdf`;
  
  doc.save(fileName);
}
