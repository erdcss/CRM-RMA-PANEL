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
  const margin = 20;
  let yPos = 20;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(20);
  doc.text("Çalışkan Group RMA Panel", margin, yPos);
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Kayıt #${ticket.id}`, margin, yPos);
  doc.text(
    new Date(ticket.createdAt).toLocaleDateString("tr-TR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }),
    pageWidth - margin,
    yPos,
    { align: "right" }
  );
  yPos += 15;

  const qrCodeUrl = `${window.location.origin}/kayit/${ticket.id}`;
  try {
    const qrDataUrl = await QRCode.toDataURL(qrCodeUrl, {
      width: 100,
      margin: 1,
    });
    doc.addImage(qrDataUrl, "PNG", pageWidth - margin - 30, yPos, 30, 30);
  } catch (error) {
    console.error("QR Code generation error:", error);
  }

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Müşteri Bilgileri", margin, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.text(`Ad Soyad: ${ticket.customer.name}`, margin, yPos);
  yPos += 6;
  doc.text(`Telefon: ${ticket.customer.phone}`, margin, yPos);
  yPos += 6;
  
  if (ticket.customer.email) {
    doc.text(`E-posta: ${ticket.customer.email}`, margin, yPos);
    yPos += 6;
  }
  
  if (ticket.customer.address) {
    doc.text(`Adres: ${ticket.customer.address}`, margin, yPos);
    yPos += 6;
  }

  yPos += 10;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Ürünler", margin, yPos);
  yPos += 8;

  ticket.products.forEach((product, index) => {
    if (yPos > 260) {
      doc.addPage();
      yPos = 20;
    }

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    doc.text(`${index + 1}. ${product.name}`, margin, yPos);
    yPos += 6;

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Marka: ${product.brand}${product.model ? ` ${product.model}` : ""}`, margin + 5, yPos);
    yPos += 6;

    if (product.serialNumber) {
      doc.text(`Seri No: ${product.serialNumber}`, margin + 5, yPos);
      yPos += 6;
    }

    doc.text(`Durum: ${categoryLabels[product.category]} - ${statusLabels[product.status]}`, margin + 5, yPos);
    yPos += 6;

    if (product.description) {
      const lines = doc.splitTextToSize(`Açıklama: ${product.description}`, pageWidth - 2 * margin - 5);
      doc.text(lines, margin + 5, yPos);
      yPos += lines.length * 6;
    }

    yPos += 8;
  });

  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Bu belge ${new Date().toLocaleDateString("tr-TR")} tarihinde oluşturulmuştur.`,
    pageWidth / 2,
    doc.internal.pageSize.getHeight() - 10,
    { align: "center" }
  );

  doc.save(`Kayit_${ticket.id}_${ticket.customer.name.replace(/\s+/g, "_")}.pdf`);
}
