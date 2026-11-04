import { jsPDF } from "jspdf";
import {paintClassicSalesPage,CLASSIC_SALES_LINES_PER_PAGE} from "./dukkan-sales-form-classic";
import {invoiceColors,resolveInvoiceForm,type DukkanInvoiceForm,type InvoiceFormKind} from "@shared/dukkan-invoice-forms";

export type SalesInvoicePdfData={
  invoice:{
    id:number;invoice_no:string;kind:"sale"|"sale_return"|"purchase"|"purchase_return";issued_at:string;
    party_name:string;party_tax_number?:string|null;party_phone?:string|null;
    store_name:string;subtotal:string|number;tax_total:string|number;grand_total:string|number;
    party_balance?:string|number|null;
  };
  lines:Array<{id:number;quantity:string|number;unit_price:string|number;tax_rate:string|number;line_total:string|number;
    sku:string;product_name:string;unit:string}>;
  disclaimer:string;officialInvoice:false;
  template?:DukkanInvoiceForm;
};
const ink="#101c34",subtle="#62748c",line="#e3eaf3";
const number=(value:unknown)=>Number(value||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
const money=(value:unknown)=>number(value)+" TL";
const date=(value:string)=>{const d=new Date(value);return Number.isNaN(d.valueOf())?value:d.toLocaleDateString("tr-TR");};
const norm=(value:unknown)=>String(value??"").trim();

function paintPage(data:SalesInvoicePdfData,page:number,pages:number,items:SalesInvoicePdfData["lines"]){
  const kind:InvoiceFormKind=data.invoice.kind.startsWith("purchase")?"purchase":"sale";
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
  text(config.documentTitle,75,155,23,"#7dd3fc",800,680);
  text("Dahili ön muhasebe kaydı — Resmî e-Fatura değildir",75,207,19,"#b8c6db");
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
    if(config.showProductCode&&item.sku)text("Kod: "+norm(item.sku),90,y+21,13,subtle,400,515);
    text(number(item.quantity)+" "+norm(item.unit),660,y,17,ink,400,140);
    if(config.showUnitPrice)text(money(item.unit_price),807,y,17,ink,400,166);
    if(config.showTaxRate)text("%"+number(item.tax_rate).replace(",00",""),985,y,17,ink);
    right(money(item.line_total),1152,y,17,ink,700);
  });
  const footY=1535;
  rect(74,footY,1092,2,line);
  if(page===pages-1){
    text("Ara Toplam",720,footY+42,19,subtle);
    right(money(data.invoice.subtotal),1152,footY+42,21,ink,700);
    text("KDV Toplamı",720,footY+80,19,subtle);
    right(money(data.invoice.tax_total),1152,footY+80,21,ink,700);
    rect(695,footY+97,470,63,palette.main);
    text("GENEL TOPLAM",719,footY+138,21,"#ffffff",700);
    right(money(data.invoice.grand_total),1151,footY+138,23,"#ffffff",800);
  }else text("Kalemler sonraki sayfada devam ediyor.",78,footY+44,19,subtle);
  if(config.footerNote)text(config.footerNote,75,1683,15,subtle,400,1070);
  rect(74,1706,1092,2,line);
  text("Dahili ön muhasebe belgesi — GİB e-Fatura / e-Arşiv yerine geçmez.",75,1734,15,subtle);
  right(`${page+1} / ${pages}`,1152,1734,15,subtle);
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
    const canvas=classic?paintClassicSalesPage(data,page,pages,items):paintPage(data,page,pages,items);
    pdf.addImage(canvas.toDataURL("image/jpeg",0.9),"JPEG",0,0,pageSize[0],pageSize[1],undefined,"FAST");
  }
  return pdf;
}

export async function exportDukkanInvoicePdf(data:SalesInvoicePdfData){
  const pdf=renderDukkanInvoicePdf(data);
  const kind=data.invoice.kind.startsWith("purchase")?"Alis":"Satis";
  pdf.save("Caliskan-Dukkan-"+kind+"-"+String(data.invoice.invoice_no).replace(/[^0-9]/g,"")+".pdf");
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

