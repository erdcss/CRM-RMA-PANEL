import {resolveInvoiceForm} from "@shared/dukkan-invoice-forms";
import type {SalesInvoicePdfData} from "./dukkan-invoice-pdf";

const W=1240,H=1754;
const X=46,RIGHT=1194;
const BORDER="#131313";
const num=(v:unknown)=>Number(v??0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
const quantity=(v:unknown)=>Number(v??0).toLocaleString("tr-TR",{maximumFractionDigits:3});
const str=(v:unknown)=>String(v??"").trim();

export const CLASSIC_SALES_LINES_PER_PAGE=30;

/** A4 black-and-white sales slip based on the user's Satış Formu 2:
 * bordered company/customer section, boxed table rows, checkbox for each
 * product and dispatch/balance footer. Actual invoice data only. */
export function paintClassicSalesPage(
  data:SalesInvoicePdfData,
  page:number,
  pages:number,
  items:SalesInvoicePdfData["lines"],
):HTMLCanvasElement{
  const config=resolveInvoiceForm("sale",data.template);
  const canvas=document.createElement("canvas");
  canvas.width=W;canvas.height=H;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("Satış şablonu çizimi başlatılamadı");
  ctx.fillStyle="#fff";
  ctx.fillRect(0,0,W,H);
  ctx.lineWidth=1.8;
  ctx.strokeStyle=BORDER;
  ctx.textBaseline="alphabetic";

  const rule=(x:number,y:number,w:number,h:number)=>{
    ctx.lineWidth=1.7;ctx.strokeStyle=BORDER;ctx.strokeRect(x,y,w,h);
  };
  const line=(x1:number,y1:number,x2:number,y2:number)=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  };
  const setFont=(size:number,bold=false)=>{
    ctx.font=(bold?"700 ":"400 ")+size+"px Arial, 'Arial Narrow', sans-serif";
    ctx.fillStyle=BORDER;
  };
  const text=(value:unknown,x:number,y:number,size=18,bold=false,maxWidth?:number)=>{
    const v=str(value);
    if(!v)return;
    setFont(size,bold);
    ctx.fillText(v,x,y,maxWidth);
  };
  const right=(value:unknown,x:number,y:number,size=18,bold=false)=>{
    setFont(size,bold);
    const val=str(value);
    ctx.fillText(val,x-ctx.measureText(val).width,y);
  };
  const centered=(value:unknown,left:number,rightX:number,y:number,size=18,bold=false)=>{
    setFont(size,bold);
    const val=str(value);
    ctx.fillText(val,(left+rightX-ctx.measureText(val).width)/2,y,
      Math.max(18,rightX-left-10));
  };
  const wrapped=(value:string,x:number,y:number,maxWidth:number,size:number,maxLines:number)=>{
    const words=value.trim().split(/\s+/),lines:string[]=[];
    let current="";
    for(const word of words){
      const attempt=current?current+" "+word:word;
      setFont(size);
      if(ctx.measureText(attempt).width>maxWidth&&current){
        lines.push(current);current=word;
        if(lines.length===maxLines)break;
      }else current=attempt;
    }
    if(current&&lines.length<maxLines)lines.push(current);
    lines.forEach((row,i)=>text(row,x,y+i*(size+5),size,false,maxWidth));
  };

  // Framed company information and actual invoice date / document number.
  rule(X,50,RIGHT-X,130);
  text(config.companyName||data.invoice.store_name,58,83,23,true,760);
  if(config.showCompanyDetails){
    text("ADRES :",58,119,17,true);
    text(config.companyAddress,148,119,17,false,700);
    text("Tel :",58,153,17,true);
    text(config.companyPhone,106,153,17,false,215);
    text("mail :",323,153,17,true);
    text(config.companyEmail,379,153,17,false,412);
  }
  text("Tarih :",840,85,19,true);
  text(new Date(data.invoice.issued_at).toLocaleDateString("tr-TR"),938,85,19,true,236);
  text("Belge NO :",840,120,19,true);
  text(data.invoice.invoice_no,974,120,19,true,212);
  text("Sayfa :",880,155,18);
  text(String(page+1),971,155,18);

  // Two customer fields appear immediately under the company frame.
  rule(X,180,RIGHT-X,74);
  line(X,217,RIGHT,217);
  text("AD SOYAD :",58,207,19,true);
  text(data.invoice.party_name,224,207,19,true,945);
  text("TEL :",58,244,18,true);
  if(config.showPartyPhone)text(data.invoice.party_phone,118,244,17,false,500);

  // Column proportions follow the original A4 document.
  const cols=[X,228,757,850,927,1057,RIGHT];
  const headY=267,headH=28;
  rule(X,headY,RIGHT-X,headH);
  cols.slice(1,-1).forEach(cx=>line(cx,headY,cx,headY+headH));
  centered("STOK KODU",cols[0],cols[1],288,17,true);
  centered(config.productHeader,cols[1],cols[2],288,17,true);
  centered(config.quantityHeader,cols[2],cols[3],288,16,true);
  centered(config.unitHeader,cols[3],cols[4],288,16,true);
  if(config.showUnitPrice)centered(config.priceHeader,cols[4],cols[5],288,16,true);
  centered(config.amountHeader,cols[5],cols[6],288,16,true);

  const rowTop=301,rowH=30,rowGap=4;
  items.forEach((item,i)=>{
    const y=rowTop+i*(rowH+rowGap),baseline=y+21;
    rule(X,y,RIGHT-X,rowH);
    cols.slice(1,-1).forEach(cx=>line(cx,y,cx,y+rowH));
    rule(X+8,y+7,15,15);
    if(config.showProductCode)text(item.sku||"—",X+29,baseline,17,false,cols[1]-X-37);
    text(item.product_name,cols[1]+8,baseline,17,false,cols[2]-cols[1]-16);
    right(quantity(item.quantity),cols[3]-8,baseline,17);
    centered(item.unit||"Adet",cols[3],cols[4],baseline,16);

    // No VAT column in the original document. The displayed per-unit gross
    // price must agree with the stored tax-inclusive line amount.
    const count=Number(item.quantity),gross=Number(item.line_total);
    const grossUnit=count>0&&Number.isFinite(gross)?gross/count:Number(item.unit_price);
    if(config.showUnitPrice)right(num(grossUnit),cols[5]-10,baseline,17);
    right(num(item.line_total),cols[6]-10,baseline,17,true);
  });

  const footY=rowTop+items.length*(rowH+rowGap)+18;
  const footerY=Math.min(footY,1540);
  text("AMBAR İLETİŞİM :",X+11,footerY+17,18,true);
  text(config.warehouseContact,X+213,footerY+17,17,false,450);
  text("TESLİM EDİLEN BAĞ/KOLİ :",X+11,footerY+76,18,true);
  if(config.deliveredPackages)wrapped(config.deliveredPackages,X+345,footerY+76,300,17,2);

  if(page===pages-1){
    if(data.importedArchive){
      text("Arşiv Ekstre Tutarı",838,footerY+17,17,true);
      text(":",1065,footerY+17,17);
      right(num(data.invoice.grand_total),RIGHT,footerY+17,21,true);
      text("Belge kaynağı: Cari ekstre",838,footerY+59,14,false,355);
    }else{
      text("Şimdi Alınan Mal",872,footerY+17,17,true);
      text(":",1065,footerY+17,17);
      right(num(data.invoice.grand_total),RIGHT,footerY+17,21,true);
      text("Toplam Bakiye",887,footerY+59,17,true);
      text(":",1065,footerY+59,17);
      const balance=data.invoice.party_balance;
      right(balance===undefined||balance===null?"—":num(balance),
        RIGHT,footerY+59,21,true);
    }
  }else{
    text("Belgenin devamı sonraki sayfadadır.",865,footerY+34,17,true,315);
  }

  if(config.headerNote)wrapped(config.headerNote,X+10,footerY+112,1090,16,2);
  if(config.footerNote)wrapped(config.footerNote,X+10,footerY+180,1090,16,3);
  line(X,1701,RIGHT,1701);
  text(data.importedArchive?
    config.documentTitle+" · ARŞİV / CARİ EKSTRE KAYDI · Resmî fatura değildir.":
    config.documentTitle+" · Dahili ön muhasebe belgesidir; GİB e-Fatura veya e-Arşiv yerine geçmez.",
    X+3,1724,13,false,1020);
  right(String(page+1)+" / "+String(pages),RIGHT,1724,14);
  return canvas;
}
