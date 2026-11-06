import { jsPDF } from "jspdf";
import {paintClassicSalesPage,CLASSIC_SALES_LINES_PER_PAGE} from "./dukkan-sales-form-classic";
import {invoiceColors,resolveInvoiceForm,type DukkanInvoiceForm,type InvoiceFormKind} from "@shared/dukkan-invoice-forms";

export type SalesInvoicePdfData={
  invoice:{
    id:number;invoice_no:string;kind:"sale"|"sale_return"|"purchase"|"purchase_return";issued_at:string;
    party_name:string;party_tax_number?:string|null;party_phone?:string|null;
    store_name:string;subtotal:string|number|null;tax_total:string|number|null;grand_total:string|number;
    party_balance?:string|number|null;
  };
  lines:Array<{id:number;quantity:string|number;unit_price:string|number;tax_rate:string|number|null;line_total:string|number;
    sku:string;product_name:string;unit:string}>;
  disclaimer:string;officialInvoice:false;
  importedArchive?:boolean;
  template?:DukkanInvoiceForm;
};
const ink="#101c34",subtle="#62748c",line="#e3eaf3";
const number=(value:unknown)=>Number(value||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
const money=(value:unknown)=>number(value)+" TL";
const date=(value:string)=>{const d=new Date(value);return Number.isNaN(d.valueOf())?value:d.toLocaleDateString("tr-TR");};
const norm=(value:unknown)=>String(value??"").trim();

function paintPage(data:SalesInvoicePdfData,page:number,pages:number,items:SalesInvoicePdfData["lines"]){
  const kind:InvoiceFormKind=data.invoice.kind.startsWith("purchase")?"purchase":"sale";
  const archived=Boolean(data.importedArchive);
  const config=resolveInvoiceForm(kind,data.template);
  const palette=invoiceColors[config.color];
  const canvas=document.createElement("canvas");canvas.width=1240;canvas.height=1754;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("PDF çizim alanı açılamadı");
  const rect=(x:number,y:number,w:number,h:number,color:string)=>{ctx.fillStyle=color;ctx.fillRect(x,y,w,h);};
  const text=(value:string,x:number,y:number,size:number,color=ink,weight=400,maxWidth?:number)=>{
    ctx.fillStyle=color;ctx.font=`${weight} ${size}px Arial, sans-serif`;
    if(maxWidth)ctx.fillText(value,x,y,maxWidth);else ctx.fillText(value,x,y);
  };
  const right=(value:string,x:number,y:number,size:number,color=ink,weight=400)=>{
    ctx.font=`${weight} ${size}px Arial, sans-serif`;text(value,x-ctx.measureText(value).width,y,size,color,weight);
  };
  rect(0,0,1240,1754,"#ffffff");
  rect(0,0,1240,18,palette.accent);
  rect(0,18,1240,260,palette.main);
  text(norm(config.companyName||data.invoice.store_name),75,92,43,"#ffffff",800,650);
  text(archived?"ARŞİV / CARİ EKSTRE FATURA KAYDI":config.documentTitle,75,155,23,"#7dd3fc",800,680);
  text(archived?"Kaynak ekstreden aktarılmıştır — Resmî fatura değildir":"Dahili ön muhasebe kaydı — Resmî e-Fatura değildir",75,207,19,"#b8c6db");
  if(config.headerNote)text(config.headerNote,75,242,16,"#e2e8f0",400,1070);
  right("BELGE NO: "+norm(data.invoice.invoice_no),1150,112,22,"#ffffff",700);
  right(date(norm(data.invoice.issued_at)),1150,157,21,"#dce7f6");
  rect(74,312,1092,190,"#f4f7fb");
  text("İŞLETME",98,350,16,subtle,700);
  text(norm(config.companyName||data.invoice.store_name),98,392,25,ink,800,510);
  if(config.showCompanyDetails){
    if(config.companyAddress)text(config.companyAddress,98,418,15,subtle,400,515);
    if(config.companyPhone)text("Tel: "+config.companyPhone,98,440,14,subtle,400,515);
    const taxes=[config.companyTaxOffice,config.companyTaxNumber].filter(Boolean).join(" · ");
    if(taxes)text(taxes,98,464,14,subtle,400,515);
  }
  text(kind==="sale"?"MÜŞTERİ / CARİ":"TEDARİKÇİ / CARİ",646,350,16,subtle,700);
  text(norm(data.invoice.party_name),646,390,23,ink,700,480);
  if(config.showPartyTaxNumber&&data.invoice.party_tax_number)
    text("VKN/TCKN: "+norm(data.invoice.party_tax_number),646,422,16,subtle,400,480);
  if(config.showPartyPhone&&data.invoice.party_phone)
    text("Tel: "+norm(data.invoice.party_phone),646,448,16,subtle,400,480);
  text(config.productHeader,90,535,17,subtle,700,520);
  text(config.quantityHeader,660,535,17,subtle,700,155);
  if(config.showUnitPrice)text(config.priceHeader,807,535,17,subtle,700,160);
  if(config.showTaxRate)text(config.taxHeader,985,535,17,subtle,700,80);
  right(config.amountHeader,1152,535,17,subtle,700);
  rect(74,550,1092,2,line);
  items.forEach((item,i)=>{
    const y=583+i*58;
    if(i%2===1)rect(74,y-34,1092,56,"#f7faff");
    text(norm(item.product_name),90,y,18,ink,600,510);
    if(config.showProductCode&&item.sku)text("Stok Kodu: "+norm(item.sku),90,y+21,13,subtle,400,515);
    text(number(item.quantity)+" "+norm(item.unit),660,y,17,ink,400,140);
    if(config.showUnitPrice)text(money(item.unit_price),807,y,17,ink,400,166);
    if(config.showTaxRate)text(item.tax_rate===null?"—":"%"+number(item.tax_rate).replace(",00",""),985,y,17,ink);
    right(money(item.line_total),1152,y,17,ink,700);
  });
  if(archived&&!items.length)text("Kaynak cari ekstresinde ürün kalemleri bulunamadı.",90,610,18,subtle);
  const footY=1535;
  rect(74,footY,1092,2,line);
  if(page===pages-1){
    if(archived){
      text("KDV ve matrah kaynak ekstreden doğrulanamadı.",707,footY+55,15,subtle,400,450);
      rect(695,footY+97,470,63,palette.main);
      text("EKSTRE TUTARI",718,footY+138,21,"#ffffff",700);
    }else{
      text("Ara Toplam",720,footY+42,19,subtle);
      right(money(data.invoice.subtotal),1152,footY+42,21,ink,700);
      text("KDV Toplamı",720,footY+80,19,subtle);
      right(money(data.invoice.tax_total),1152,footY+80,21,ink,700);
      rect(695,footY+97,470,63,palette.main);
      text("GENEL TOPLAM",719,footY+138,21,"#ffffff",700);
    }
    right(money(data.invoice.grand_total),1151,footY+138,23,"#ffffff",800);
  }else text("Kalemler sonraki sayfada devam ediyor.",78,footY+44,19,subtle);
  if(config.footerNote)text(config.footerNote,75,1683,15,subtle,400,1070);
  rect(74,1706,1092,2,line);
  text(archived?"Arşiv kaydı — cari ekstre kaynaklıdır; resmî fatura yerine geçmez.":"Dahili ön muhasebe belgesi — GİB e-Fatura / e-Arşiv yerine geçmez.",75,1734,15,subtle);
  right(`${page+1} / ${pages}`,1152,1734,15,subtle);
  return canvas;
}


/** Purchase documents are intentionally ink-only, regardless of saved theme.
 * Sales documents continue using the custom form selected in Settings.
 * Historical imports are presented as source-statement evidence, not tax invoices. */
function paintPlainPurchasePage(
  data:SalesInvoicePdfData,page:number,pages:number,items:SalesInvoicePdfData["lines"],
):HTMLCanvasElement{
  const config=resolveInvoiceForm("purchase",data.template);
  const archived=Boolean(data.importedArchive);
  const canvas=document.createElement("canvas");
  canvas.width=1240;canvas.height=1754;
  const ctx=canvas.getContext("2d");
  if(!ctx)throw Error("Alış belgesi çizim alanı açılamadı");
  const black="#000000";
  ctx.fillStyle="#ffffff";
  ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.strokeStyle=black;
  ctx.lineWidth=1.5;
  const text=(value:unknown,x:number,y:number,size:number,bold=false,width?:number)=>{
    ctx.fillStyle=black;
    ctx.font=(bold?"700 ":"400 ")+size+"px Arial, sans-serif";
    const label=norm(value);
    if(width)ctx.fillText(label,x,y,width);else ctx.fillText(label,x,y);
  };
  const right=(value:unknown,x:number,y:number,size:number,bold=false)=>{
    ctx.font=(bold?"700 ":"400 ")+size+"px Arial, sans-serif";
    const label=norm(value);
    text(label,x-ctx.measureText(label).width,y,size,bold);
  };
  const line=(x1:number,y1:number,x2:number,y2:number)=>{
    ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.stroke();
  };
  const left=74,rightEdge=1166;
  text(config.companyName||data.invoice.store_name,left,86,35,true,970);
  text(archived?"ARŞİV / CARİ EKSTRE ALIŞ KAYDI":config.documentTitle,left,143,24,true,760);
  text(archived?"Kaynak ekstreden aktarılmıştır; resmî fatura değildir.":
    "Dahili ön muhasebe belgesidir; resmî fatura değildir.",left,181,16);
  right("BELGE NO: "+norm(data.invoice.invoice_no),rightEdge,125,19,true);
  right(date(norm(data.invoice.issued_at)),rightEdge,163,18);
  line(left,216,rightEdge,216);
  text("İŞLETME",left,264,18,true);
  text(config.companyName||data.invoice.store_name,left,303,22,true,490);
  if(config.showCompanyDetails){
    if(config.companyAddress)text(config.companyAddress,left,339,16,false,505);
    if(config.companyPhone)text("Tel: "+config.companyPhone,left,370,16,false,490);
    if(config.companyTaxOffice||config.companyTaxNumber)
      text([config.companyTaxOffice,config.companyTaxNumber].filter(Boolean).join(" · "),
        left,400,16,false,490);
  }
  text("TEDARİKÇİ / CARİ",655,264,18,true);
  text(data.invoice.party_name,655,303,22,true,510);
  if(config.showPartyTaxNumber&&data.invoice.party_tax_number)
    text("VKN/TCKN: "+data.invoice.party_tax_number,655,340,16);
  if(config.showPartyPhone&&data.invoice.party_phone)
    text("Tel: "+data.invoice.party_phone,655,371,16);
  line(left,444,rightEdge,444);
  if(config.headerNote)text(config.headerNote,left,473,15,false,1060);
  // Completely white table: only thin black dividers and black characters.
  text(config.productHeader,left+8,545,17,true,500);
  text(config.quantityHeader,663,545,17,true,116);
  if(config.showUnitPrice)text(config.priceHeader,802,545,17,true,145);
  if(config.showTaxRate)text(config.taxHeader,994,545,17,true,82);
  right(config.amountHeader,rightEdge-5,545,17,true);
  line(left,561,rightEdge,561);
  items.forEach((item,i)=>{
    const y=594+i*54;
    text(item.product_name,left+8,y,18,true,535);
    if(config.showProductCode&&item.sku)
      text("Stok Kodu: "+item.sku,left+8,y+19,12,false,500);
    text(number(item.quantity)+" "+(item.unit||"adet"),663,y,17,false,130);
    if(config.showUnitPrice)text(money(item.unit_price),802,y,17,false,170);
    if(config.showTaxRate)
      text(item.tax_rate===null?"—":"%"+number(item.tax_rate).replace(",00",""),994,y,17);
    right(money(item.line_total),rightEdge-5,y,17,true);
    line(left,y+26,rightEdge,y+26);
  });
  if(!items.length)text(
    archived?"Kaynak ekstresinde ürün kalemleri bulunamadı.":"Bu belgede ürün kalemi yok.",
    left+8,620,17);
  line(left,1490,rightEdge,1490);
  if(page===pages-1){
    if(archived){
      text("KDV ve matrah kaynaktan doğrulanamadı.",670,1526,16);
      text("EKSTRE BELGE TUTARI",670,1580,20,true);
    }else{
      text("Ara Toplam",750,1525,18);
      right(money(data.invoice.subtotal),rightEdge,1525,18,true);
      text("KDV Toplamı",750,1560,18);
      right(money(data.invoice.tax_total),rightEdge,1560,18,true);
      text("GENEL TOPLAM",750,1614,20,true);
    }
    right(money(data.invoice.grand_total),rightEdge,archived?1580:1614,22,true);
  }else text("Belgenin diğer ürünleri sonraki sayfada devam eder.",left,1540,18);
  if(config.footerNote)text(config.footerNote,left,1670,15,false,1060);
  line(left,1700,rightEdge,1700);
  text(archived?
    "Ekstre kaynaklı arşiv kaydıdır; GİB e-Fatura / e-Arşiv yerine geçmez.":
    "Dahili alış belgesidir; GİB e-Fatura / e-Arşiv yerine geçmez.",
    left,1732,15);
  right((page+1)+" / "+pages,rightEdge,1732,15);
  return canvas;
}

export function renderDukkanInvoicePdf(data:SalesInvoicePdfData){
  if(!data?.invoice||!Array.isArray(data.lines)||
    !["sale","sale_return","purchase","purchase_return"].includes(data.invoice.kind))
    throw Error("Geçerli satış veya alış belgesi bulunamadı");
  const kind:InvoiceFormKind=data.invoice.kind.startsWith("purchase")?"purchase":"sale";
  const config=resolveInvoiceForm(kind,data.template);
  const pageSize=config.paperSize==="a5"?[148,210] as const:[210,297] as const;
  const classic=kind==="sale"&&config.layout==="classic";
  const perPage=classic?CLASSIC_SALES_LINES_PER_PAGE:16;
  const pages=Math.max(1,Math.ceil(data.lines.length/perPage));
  const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:config.paperSize,compress:true});
  for(let page=0;page<pages;page++){
    if(page)pdf.addPage();
    const items=data.lines.slice(page*perPage,(page+1)*perPage);
    const canvas=kind==="purchase"?paintPlainPurchasePage(data,page,pages,items):
      classic?paintClassicSalesPage(data,page,pages,items):paintPage(data,page,pages,items);
    pdf.addImage(canvas.toDataURL("image/jpeg",0.9),"JPEG",0,0,pageSize[0],pageSize[1],undefined,"FAST");
  }
  return pdf;
}

export async function exportDukkanInvoicePdf(data:SalesInvoicePdfData){
  const pdf=renderDukkanInvoicePdf(data);
  const kind=data.invoice.kind.startsWith("purchase")?"Alis":"Satis";
  pdf.save("Caliskan-Dukkan-"+(data.importedArchive?"Arsiv-":"")+kind+"-"+String(data.invoice.invoice_no).replace(/[^a-zA-Z0-9_-]/g,"").slice(0,70)+".pdf");
}

/** Open a printable PDF in the browser viewer. Must be invoked from a user
 * action; the popup should be opened synchronously before fetching invoice data. */
export function showDukkanInvoicePrint(pdf:jsPDF,printWindow:Window|null){
  pdf.autoPrint();
  const blobUrl=pdf.output("bloburl");
  if(printWindow){
    printWindow.location.href=blobUrl.toString();
    window.setTimeout(()=>URL.revokeObjectURL(blobUrl.toString()),60000);
  }else{
    pdf.save("Caliskan-Dukkan-Yazdir.pdf");
  }
}

// Keep existing integrations working.
export const exportSalesInvoicePdf=exportDukkanInvoicePdf;

