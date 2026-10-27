import { jsPDF } from "jspdf";
import type { SupplierOrderView } from "./supplier-privacy";

export type SupplierPdfVariant="standard"|"simple";
const clean=(value:unknown)=>String(value??"")
  .replace(/[ğĞ]/g,"g").replace(/[şŞ]/g,"s").replace(/[ıİ]/g,"i")
  .replace(/[çÇ]/g,"c").replace(/[öÖ]/g,"o").replace(/[üÜ]/g,"u")
  .replace(/[^\x20-\x7e\n]/g," ");
const currency=(value:unknown)=>{
  const v=Number(value);
  return (Number.isFinite(v)?v:0).toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})+" TL";
};
/** These are order summaries, never legal e-invoices. No telephone/email/user ID. */
export function generateSupplierOrderPdf(order:SupplierOrderView,variant:SupplierPdfVariant="standard"):Buffer {
  const pdf=new jsPDF({unit:"mm",format:"a4",compress:true});
  const left=15,right=195,width=right-left;
  let y=17;
  const newPage=()=>{pdf.addPage();y=16;};
  const title=(text:string,x:number,yy:number,size=11)=>{
    pdf.setTextColor(15,23,42);pdf.setFont("helvetica","bold");pdf.setFontSize(size);
    pdf.text(clean(text),x,yy);
  };
  const body=(text:string,x:number,yy:number,size=9)=>{
    pdf.setTextColor(65,79,99);pdf.setFont("helvetica","normal");pdf.setFontSize(size);
    pdf.text(clean(text),x,yy);
  };
  const line=()=>{pdf.setDrawColor(225,232,240);pdf.line(left,y,right,y);y+=5;};
  const checkHeight=(height=18)=>{if(y+height>275)newPage();};
  // Header matches the app's dark / amber brand identity, print-friendly.
  pdf.setFillColor(12,20,38);pdf.rect(0,0,210,35,"F");
  pdf.setFillColor(255,205,0);pdf.roundedRect(left,11,20,14,3,3,"F");
  pdf.setTextColor(8,15,28);pdf.setFont("helvetica","bold");pdf.setFontSize(9);
  pdf.text("CB",left+5.6,20);
  pdf.setTextColor(255,255,255);pdf.setFontSize(15);pdf.text("CALISKAN BUSINESS",41,19);
  pdf.setFontSize(8);pdf.text("SIPARIS OZETI - FATURA DEGILDIR",41,25);
  y=45;
  title(variant==="simple"?"SADE URUN LISTESI":"STANDART SIPARIS DETAYI",left,y,14);y+=10;
  body("Siparis No: #"+String(order.order_number||order.order_id||order.id),left,y);
  body("Tarih: "+(order.created_at?new Date(order.created_at).toLocaleString("tr-TR"):"-"),right,y,9);
  y+=7;
  if(variant==="standard"){
    line();
    if(order.customer_company){body("Firma",left,y);title(order.customer_company,42,y,9);y+=7;}
    if(order.delivery_address){
      body("Teslimat",left,y);
      const lines=pdf.splitTextToSize(clean(order.delivery_address),145);
      pdf.setTextColor(15,23,42);pdf.setFont("helvetica","normal");pdf.setFontSize(8.5);
      pdf.text(lines,42,y);y+=Math.max(1,lines.length)*5+2;
    }
    body("Durum",left,y);title(["paid","approved","confirmed","onaylandi"].includes(String(order.status))?"Onaylandi":"Onay Bekliyor",42,y,9);y+=7;
    body("Odeme",left,y);title(order.payment_method==="bank_transfer"?"Havale / EFT":
      order.payment_method==="card"?"Kredi / Banka Karti":"Belirtilmemis",42,y,9);y+=7;
    body("Teslimat turu",left,y);title(order.delivery_mode==="warehouse"?"Depo":
      "Dogrudan teslimat",42,y,9);y+=9;
  }else y+=3;
  pdf.setFillColor(241,245,249);pdf.roundedRect(left,y-5,width,11,2,2,"F");
  title("URUN / KOD",left+3,y+2,8);title("KOLI",135,y+2,8);title("TUTAR",right-3,y+2,8);y+=13;
  for(let i=0;i<(order.items||[]).length;i++){
    const item=order.items[i];
    const name=clean(item.name||item.sku||"Urun");
    const textLines=pdf.splitTextToSize((i+1)+". "+name,102);
    const height=Math.max(16,textLines.length*4.5+9);
    checkHeight(height+12);
    pdf.setFont("helvetica","bold");pdf.setFontSize(9);pdf.setTextColor(20,30,44);
    pdf.text(textLines,left+3,y);
    body(item.sku?"Kod: "+item.sku:"",left+3,y+textLines.length*4.5+0.5,7);
    body(String(item.boxes??0),137,y,9);
    pdf.setFont("helvetica","bold");pdf.setTextColor(15,23,42);pdf.setFontSize(8.5);
    pdf.text(currency(item.total),right-3,y,{align:"right"});
    y+=height;line();
  }
  checkHeight(42);y+=5;
  pdf.setFillColor(238,246,255);pdf.roundedRect(103,y-6,92,24,3,3,"F");
  body("GENEL TOPLAM",108,y+1,9);
  pdf.setTextColor(10,36,78);pdf.setFontSize(12);pdf.setFont("helvetica","bold");
  pdf.text(currency(order.subtotal),190,y+11,{align:"right"});
  y+=29;
  checkHeight(14);
  body("Belge: Tedarikci siparis ozeti. Resmi fatura yerine gecmez.",left,y,7.5);
  // Do not add customer phone, buyer email, full account record or raw order JSON.
  return Buffer.from(pdf.output("arraybuffer"));
}
