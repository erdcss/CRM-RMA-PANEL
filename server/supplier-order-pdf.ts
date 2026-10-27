import { jsPDF } from "jspdf";
import type { SupplierOrderView } from "./supplier-privacy";

const latin = (value: unknown) => String(value ?? "")
  .replace(/[ğĞ]/g, "g").replace(/[şŞ]/g, "s").replace(/[ıİ]/g, "i")
  .replace(/[çÇ]/g, "c").replace(/[öÖ]/g, "o").replace(/[üÜ]/g, "u")
  .replace(/[^\x20-\x7E\n]/g, " ");
const money = (amount: unknown) => {
  const value=Number(amount);
  return (Number.isFinite(value) ? value : 0).toFixed(2)+" TRY";
};

/** Only accepts a strict supplier-view allowlist, never customer or address payloads. */
export function generateSupplierOrderPdf(order: SupplierOrderView): Buffer {
  const pdf = new jsPDF({unit:"mm",format:"a4"});
  const pageWidth=210,left=16,right=194;
  let y=22;
  const heading=(text:string) => {
    pdf.setFillColor(17,24,39);
    pdf.rect(left,y-7,right-left,11,"F");
    pdf.setTextColor(255,255,255);
    pdf.setFont("helvetica","bold");pdf.setFontSize(11);
    pdf.text(latin(text),left+3,y);
    pdf.setTextColor(17,24,39);
    y+=17;
  };
  const row=(key:string,val:unknown)=>{
    pdf.setFont("helvetica","normal");pdf.setFontSize(10);
    pdf.setTextColor(95,105,119);pdf.text(latin(key),left,y);
    pdf.setTextColor(17,24,39);pdf.text(latin(val),75,y);
    y+=8;
  };
  pdf.setFont("helvetica","bold");pdf.setTextColor(17,24,39);pdf.setFontSize(19);
  pdf.text("CALISKAN B2B",left,y);
  y+=9;
  pdf.setFontSize(11);pdf.text("TEDARIKCI SIPARIS OZETI",left,y);y+=11;
  pdf.setDrawColor(225,230,235);pdf.line(left,y,right,y);y+=10;

  heading("Siparis Bilgileri");
  row("Siparis No",String(order.order_id||order.id));
  row("Durum",order.status==="paid"?"Odendi":order.status);
  row("Teslimat sekli",order.delivery_mode==="warehouse"?"Depo":"Dogrudan");
  const time=new Date(order.created_at);
  row("Tarih",Number.isFinite(time.getTime())?time.toLocaleDateString("tr-TR"):order.created_at);
  y+=6;
  heading("Urunler");
  pdf.setFontSize(9);
  (order.items||[]).forEach((item,index)=>{
    if(y>260){pdf.addPage();y=22;heading("Urunler (devam)");}
    const name=latin(String(item.name||item.sku||"Urun")).slice(0,64);
    const parts=pdf.splitTextToSize((index+1)+". "+name,112);
    pdf.setFont("helvetica","bold");pdf.setTextColor(17,24,39);
    pdf.text(parts,left,y);
    pdf.setFont("helvetica","normal");pdf.setTextColor(90,100,111);
    pdf.text(latin("Koli: "+String(item.boxes??0)+"   Koli ici: "+String(item.unitsPerBox??1)),left,y+parts.length*5);
    pdf.setTextColor(17,24,39);pdf.text(money(item.total),right,y,{align:"right"});
    y+=parts.length*5+10;
    pdf.setDrawColor(234,238,242);pdf.line(left,y-4,right,y-4);
  });
  if(y>264){pdf.addPage();y=22;}
  y+=6;pdf.setFont("helvetica","bold");pdf.setFontSize(13);
  pdf.text("GENEL TOPLAM",left,y);pdf.text(money(order.subtotal),right,y,{align:"right"});
  y+=11;pdf.setTextColor(95,105,119);pdf.setFont("helvetica","normal");pdf.setFontSize(8);
  pdf.text("Bu belge tedarikci siparis ozetidir; fatura yerine gecmez.",left,y);
  // No client telephone, e-mail, account identifier, private address or raw item JSON.
  return Buffer.from(pdf.output("arraybuffer"));
}
