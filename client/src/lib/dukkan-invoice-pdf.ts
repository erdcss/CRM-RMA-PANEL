import { jsPDF } from "jspdf";

export type SalesInvoicePdfData={
  invoice:{
    id:number;invoice_no:string;kind:"sale"|"sale_return";issued_at:string;
    party_name:string;party_tax_number?:string|null;party_phone?:string|null;
    store_name:string;subtotal:string|number;tax_total:string|number;grand_total:string|number;
  };
  lines:Array<{id:number;quantity:string|number;unit_price:string|number;tax_rate:string|number;line_total:string|number;
    sku:string;product_name:string;unit:string}>;
  disclaimer:string;officialInvoice:false;
};
const ink="#101c34",subtle="#62748c",line="#e3eaf3",blue="#0284c7";
const number=(value:unknown)=>Number(value||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
const money=(value:unknown)=>number(value)+" TL";
const date=(value:string)=>{const d=new Date(value);return Number.isNaN(d.valueOf())?value:d.toLocaleDateString("tr-TR");};
const norm=(value:unknown)=>String(value??"").trim();

function paintPage(data:SalesInvoicePdfData,page:number,pages:number,items:SalesInvoicePdfData["lines"]){
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
  rect(0,0,1240,18,blue);
  rect(0,18,1240,260,ink);
  text("ÇALIŞKAN DÜKKAN",75,92,45,"#ffffff",800);
  text("SATIŞ BELGESİ",75,155,23,"#7dd3fc",800);
  text("Dahili ön muhasebe kaydı — Resmî e-Fatura değildir",75,207,19,"#b8c6db");
  right("BELGE NO: "+norm(data.invoice.invoice_no),1150,112,22,"#ffffff",700);
  right(date(norm(data.invoice.issued_at)),1150,157,21,"#dce7f6");
  rect(74,312,1092,158,"#f4f7fb");
  text("İŞLETME",98,350,16,subtle,700);
  text(norm(data.invoice.store_name),98,392,26,ink,800,510);
  text("MÜŞTERİ / CARİ",646,350,16,subtle,700);
  text(norm(data.invoice.party_name),646,390,23,ink,700,480);
  if(data.invoice.party_tax_number)text("VKN/TCKN: "+norm(data.invoice.party_tax_number),646,426,16,subtle);
  text("ÜRÜN / HİZMET",90,535,17,subtle,700);
  text("MİKTAR",660,535,17,subtle,700);
  text("BİRİM FİYAT",807,535,17,subtle,700);
  text("KDV",985,535,17,subtle,700);
  right("TUTAR",1152,535,17,subtle,700);
  rect(74,550,1092,2,line);
  items.forEach((item,i)=>{
    const y=583+i*52;
    if(i%2===1)rect(74,y-34,1092,50,"#f7faff");
    text(norm(item.product_name),90,y,18,ink,600,510);
    text(number(item.quantity)+" "+norm(item.unit),660,y,17,ink,400,140);
    text(money(item.unit_price),807,y,17,ink,400,166);
    text("%"+number(item.tax_rate).replace(",00",""),985,y,17,ink);
    right(money(item.line_total),1152,y,17,ink,700);
  });
  const footY=1535;
  rect(74,footY,1092,2,line);
  if(page===pages-1){
    text("Ara Toplam",720,footY+42,19,subtle);
    right(money(data.invoice.subtotal),1152,footY+42,21,ink,700);
    text("KDV Toplamı",720,footY+80,19,subtle);
    right(money(data.invoice.tax_total),1152,footY+80,21,ink,700);
    rect(695,footY+97,470,63,ink);
    text("GENEL TOPLAM",719,footY+138,21,"#ffffff",700);
    right(money(data.invoice.grand_total),1151,footY+138,23,"#ffffff",800);
  }else text("Kalemler sonraki sayfada devam ediyor.",78,footY+44,19,subtle);
  rect(74,1706,1092,2,line);
  text("Bu çıktı bir dahili satış belgesidir. GİB e-Fatura / e-Arşiv yerine geçmez.",75,1734,15,subtle);
  right(`${page+1} / ${pages}`,1152,1734,15,subtle);
  return canvas;
}

export async function exportSalesInvoicePdf(data:SalesInvoicePdfData){
  if(!data?.invoice||!Array.isArray(data.lines)||!["sale","sale_return"].includes(data.invoice.kind))
    throw Error("Geçerli satış belgesi bulunamadı");
  const perPage=18;
  const pages=Math.max(1,Math.ceil(data.lines.length/perPage));
  const pdf=new jsPDF({orientation:"portrait",unit:"mm",format:"a4",compress:true});
  for(let page=0;page<pages;page++){
    if(page)pdf.addPage();
    const canvas=paintPage(data,page,pages,data.lines.slice(page*perPage,(page+1)*perPage));
    pdf.addImage(canvas.toDataURL("image/jpeg",0.88),"JPEG",0,0,210,297,undefined,"FAST");
  }
  pdf.save("Caliskan-Dukkan-Satis-"+String(data.invoice.invoice_no).replace(/[^0-9]/g,"")+".pdf");
}
