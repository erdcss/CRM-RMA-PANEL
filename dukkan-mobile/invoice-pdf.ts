import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type {SalesDocument} from "./remote-db";

const esc=(value:unknown)=>String(value??"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;");
const n=(value:unknown)=>Number(value||0).toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
const tl=(value:unknown)=>n(value)+" TL";
const localDate=(value:string)=>{const d=new Date(value);return Number.isNaN(d.valueOf())?value:d.toLocaleDateString("tr-TR");};

export async function shareSalesInvoicePdf(doc:SalesDocument){
 if(!doc||!doc.invoice||!["sale","sale_return"].includes(doc.invoice.kind))throw Error("Geçerli satış belgesi bulunamadı");
 const inv=doc.invoice;
 const rows=doc.lines.map((r,i)=>`<tr>
  <td>${i+1}</td>
  <td><b>${esc(r.product_name)}</b><small>${esc(r.sku)}</small></td>
  <td class="num">${esc(n(r.quantity))} ${esc(r.unit)}</td>
  <td class="num">${esc(tl(r.unit_price))}</td>
  <td class="num">%${esc(n(r.tax_rate))}</td>
  <td class="num"><b>${esc(tl(r.line_total))}</b></td>
 </tr>`).join("");
 const html=`<!DOCTYPE html><html lang="tr"><head><meta charset="UTF-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
  <style>
  @page{size:A4;margin:0}*{box-sizing:border-box}body{margin:0;font-family:-apple-system,BlinkMacSystemFont,"Helvetica Neue",Arial,sans-serif;color:#142b4e;background:#fff}
  .hero{background:#0d203d;color:white;padding:38px 45px;border-top:10px solid #0294cb}
  .brand{font-size:27px;font-weight:900;letter-spacing:-0.3px}.kind{font-size:14px;color:#82d9f7;font-weight:800;margin-top:9px}
  .warn{font-size:10px;color:#c9d5e5;margin-top:6px}.ref{margin-top:20px;font-size:11px;color:#d6e2ee}
  .body{padding:28px 45px 25px}.panel{display:flex;gap:20px;padding:19px 22px;background:#f2f6fd;border-radius:11px;margin-bottom:30px}
  .panel>div{flex:1;min-width:0}.label{font-size:9px;letter-spacing:1px;color:#7b8aa2;font-weight:800;text-transform:uppercase}
  .value{font-size:14px;font-weight:800;margin-top:7px;word-break:break-word}.detail{font-size:10px;color:#687c94;margin-top:4px}
  table{width:100%;border-collapse:collapse;table-layout:fixed}thead{display:table-header-group}th{background:#e8f1fb;text-align:left;font-size:10px;padding:12px 7px;border-bottom:2px solid #d8e5f5}
  td{padding:12px 7px;border-bottom:1px solid #e8edf3;font-size:10px;vertical-align:top;word-break:break-word}
  tr{page-break-inside:avoid}th:nth-child(1){width:5%}th:nth-child(2){width:33%}th:nth-child(3){width:14%}th:nth-child(4){width:17%}th:nth-child(5){width:11%}th:nth-child(6){width:20%}
  .num{text-align:right}small{display:block;color:#7b8aa2;margin-top:4px;font-size:9px}
  .totals{margin-left:auto;margin-top:30px;width:52%;page-break-inside:avoid}.total-row{display:flex;justify-content:space-between;padding:10px 13px;font-size:12px}
  .grand{background:#0d203d;color:#fff;font-weight:800;border-radius:8px;font-size:14px}
  .footer{padding:14px 45px;font-size:9px;color:#6d7f97;border-top:1px solid #e3eaf3;margin:20px 45px 0;padding-left:0}
  </style></head><body><div class="hero">
  <div class="brand">ÇALIŞKAN DÜKKAN</div>
  <div class="kind">SATIŞ ${inv.kind==="sale_return"?"İADE":""} BELGESİ</div>
  <div class="warn">Dahili ön muhasebe kaydı — GİB e-Fatura / e-Arşiv faturası değildir.</div>
  <div class="ref">BELGE NO: <b>${esc(inv.invoice_no)}</b> &nbsp; · &nbsp; ${esc(localDate(inv.issued_at))}</div>
  </div><div class="body"><div class="panel">
    <div><span class="label">İşletme</span><div class="value">${esc(inv.store_name)}</div></div>
    <div><span class="label">Müşteri / Cari</span><div class="value">${esc(inv.party_name)}</div>
    ${inv.party_tax_number?`<div class="detail">VKN/TCKN: ${esc(inv.party_tax_number)}</div>`:""}</div>
  </div>
  <table><thead><tr><th>No</th><th>Ürün / Stok</th><th class="num">Miktar</th><th class="num">Birim Fiyat</th><th class="num">KDV</th><th class="num">Tutar</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals"><div class="total-row"><span>Ara Toplam</span><b>${esc(tl(inv.subtotal))}</b></div>
  <div class="total-row"><span>KDV Toplamı</span><b>${esc(tl(inv.tax_total))}</b></div>
  <div class="total-row grand"><span>GENEL TOPLAM</span><b>${esc(tl(inv.grand_total))}</b></div></div>
  </div><div class="footer">Bu belge Çalışkan Dükkan sisteminin dahili çıktısıdır. Resmî mali belge yerine geçmez.</div>
  </body></html>`;
 const {uri}=await Print.printToFileAsync({html,width:595,height:842});
 if(!(await Sharing.isAvailableAsync()))throw Error("Bu cihazda PDF paylaşımı desteklenmiyor");
 await Sharing.shareAsync(uri,{UTI:".pdf",mimeType:"application/pdf",dialogTitle:"Çalışkan Dükkan Satış Belgesi"});
}
