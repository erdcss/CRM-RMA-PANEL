import { jsPDF } from "jspdf";
import QRCode from "qrcode";

interface TicketData {
  id: number;
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

export async function generateTicketPDF(ticket: TicketData): Promise<void> {
  const doc = new jsPDF();
  
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - 2 * margin;
  let yPos = 25;

  // Global font settings
  doc.setFont("helvetica");
  
  // Header - Company Name
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(37, 99, 235); // Primary blue color
  doc.text("Çalışkan Group RMA", margin, yPos);
  yPos += 8;

  // Ticket ID and Date
  doc.setFontSize(11);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 100, 100);
  doc.text(`Kayıt #${ticket.id} - ${ticket.customer.name}`, margin, yPos);
  
  const dateStr = new Date(ticket.createdAt).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  doc.text(dateStr, pageWidth - margin, yPos, { align: "right" });
  yPos += 15;

  // QR Code
  const qrCodeUrl = `${window.location.origin}/kayit/${ticket.id}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrCodeUrl, {
      width: 120,
      margin: 1,
      color: {
        dark: "#1f2937",
        light: "#ffffff",
      },
    });
    doc.addImage(qrDataUrl, "PNG", pageWidth - margin - 28, yPos - 5, 28, 28);
  } catch (error) {
    console.error("QR Code generation error:", error);
  }

  // Section: Customer Information
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 41, 55); // Dark gray
  doc.text("Müşteri Bilgileri", margin, yPos);
  yPos += 2;

  // Divider line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  // Customer details
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(55, 65, 81);

  const customerDetails = [
    { label: "Ad Soyad", value: ticket.customer.name },
    { label: "Telefon", value: ticket.customer.phone },
  ];

  if (ticket.customer.email) {
    customerDetails.push({ label: "E-posta", value: ticket.customer.email });
  }

  if (ticket.customer.address) {
    customerDetails.push({ label: "Adres", value: ticket.customer.address });
  }

  customerDetails.forEach((detail) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(100, 100, 100);
    doc.text(`${detail.label}:`, margin, yPos);
    
    doc.setFont("helvetica", "normal");
    doc.setTextColor(31, 41, 55);
    doc.text(detail.value, margin + 25, yPos);
    yPos += 6;
  });

  yPos += 8;

  // Section: Products
  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(31, 41, 55);
  doc.text("Ürünler", margin, yPos);
  yPos += 2;

  // Divider line
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.5);
  doc.line(margin, yPos, pageWidth - margin, yPos);
  yPos += 8;

  ticket.products.forEach((product, index) => {
    // Check if we need a new page
    if (yPos > pageHeight - 50) {
      doc.addPage();
      yPos = 25;
    }

    // Product number and name
    doc.setFontSize(11);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(31, 41, 55);
    doc.text(`${index + 1}. ${product.name}`, margin, yPos);
    yPos += 7;

    // Product details
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(75, 85, 99);

    const productDetails = [];

    // Brand and model
    let brandModel = product.brand;
    if (product.model) {
      brandModel += ` ${product.model}`;
    }
    productDetails.push({ label: "Marka/Model", value: brandModel });

    // Serial number
    if (product.serialNumber) {
      productDetails.push({ label: "Seri No", value: product.serialNumber });
    }

    // Category and status
    productDetails.push({
      label: "Durum",
      value: `${categoryLabels[product.category]} - ${statusLabels[product.status]}`,
    });

    // Description
    if (product.description) {
      productDetails.push({ label: "Açıklama", value: product.description });
    }

    productDetails.forEach((detail) => {
      doc.setFont("helvetica", "bold");
      doc.setTextColor(100, 100, 100);
      doc.text(`${detail.label}:`, margin + 3, yPos);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(55, 65, 81);

      // Handle long text wrapping
      const labelWidth = doc.getTextWidth(`${detail.label}: `);
      const maxWidth = contentWidth - labelWidth - 3;
      const lines = doc.splitTextToSize(detail.value, maxWidth);
      
      lines.forEach((line: string, lineIndex: number) => {
        if (lineIndex === 0) {
          doc.text(line, margin + 3 + labelWidth, yPos);
        } else {
          yPos += 5;
          if (yPos > pageHeight - 30) {
            doc.addPage();
            yPos = 25;
          }
          doc.text(line, margin + 3 + labelWidth, yPos);
        }
      });
      
      yPos += 5;
    });

    yPos += 5;

    // Separator between products
    if (index < ticket.products.length - 1) {
      doc.setDrawColor(243, 244, 246);
      doc.setLineWidth(0.3);
      doc.line(margin + 3, yPos, pageWidth - margin, yPos);
      yPos += 5;
    }
  });

  // Footer
  const footerY = pageHeight - 15;
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(156, 163, 175);
  doc.text(
    `Bu belge ${new Date().toLocaleDateString("tr-TR")} tarihinde otomatik olarak oluşturulmuştur.`,
    pageWidth / 2,
    footerY,
    { align: "center" }
  );

  // Save PDF
  doc.save(`Kayit_${ticket.id}_${ticket.customer.name.replace(/\s+/g, "_")}.pdf`);
}
