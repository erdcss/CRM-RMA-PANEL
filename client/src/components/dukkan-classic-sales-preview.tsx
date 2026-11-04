import type {DukkanInvoiceForm} from "@shared/dukkan-invoice-forms";

const money=(n:number)=>n.toLocaleString("tr-TR",{minimumFractionDigits:2,maximumFractionDigits:2});
const TH="border border-black px-1 py-1 text-center text-[8px] font-extrabold text-black";
const TD="border border-black px-1 py-1 text-[8px] leading-4 text-black";

export function DukkanClassicSalesPreview({form,storeName}:{form:DukkanInvoiceForm;storeName:string}){
  const rows=[
    {sku:"ORNEK-001",name:"Örnek Elektrikli Ev Aleti",qty:2,unit:"Adet",price:900,total:2160},
    {sku:"ORNEK-002",name:"Örnek Mutfak Gereci",qty:1,unit:"Adet",price:350,total:420},
  ];
  return <div className="space-y-2 bg-white px-3 py-4 font-sans text-black sm:px-4" aria-label="Klasik satış formu önizlemesi">
    <div className="grid grid-cols-[minmax(0,1fr)_120px] gap-2 border border-black px-2 py-2 text-[9px]">
      <div className="min-w-0 space-y-1">
        <div className="break-words text-[11px] font-extrabold">{form.companyName||storeName}</div>
        {form.showCompanyDetails&&<>
          <div><strong>ADRES :</strong> {form.companyAddress}</div>
          <div><strong>Tel :</strong> {form.companyPhone} <strong>mail :</strong> {form.companyEmail}</div>
        </>}
      </div>
      <div className="space-y-1">
        <div><strong>Tarih :</strong> 04.11.2026</div>
        <div><strong>Belge NO :</strong> ORNEK-001</div>
        <div><strong>Sayfa :</strong> 1</div>
      </div>
    </div>
    <div className="border border-black text-[9px]">
      <div className="border-b border-black px-2 py-1"><strong>AD SOYAD :</strong> ÖRNEK MÜŞTERİ</div>
      <div className="px-2 py-1"><strong>TEL :</strong> {form.showPartyPhone?"0500 000 00 00":""}</div>
    </div>
    <div className="overflow-x-auto">
      <table className="w-full table-fixed border-separate border-spacing-y-[2px] border-spacing-x-0 text-left">
        <colgroup>
          <col style={{width:"19%"}}/><col style={{width:"38%"}}/><col style={{width:"9%"}}/>
          <col style={{width:"10%"}}/><col style={{width:"12%"}}/><col style={{width:"12%"}}/>
        </colgroup>
        <thead><tr>
          <th className={TH}>ÜRÜN KODU</th>
          <th className={TH}>{form.productHeader}</th>
          <th className={TH}>{form.quantityHeader}</th>
          <th className={TH}>{form.unitHeader}</th>
          <th className={TH}>{form.priceHeader}</th>
          <th className={TH}>{form.amountHeader}</th>
        </tr></thead>
        <tbody>{rows.map(row=><tr key={row.sku}>
          <td className={TD}>
            <span className="mr-1 inline-block h-[9px] w-[9px] shrink-0 border border-black align-middle"/>
            {form.showProductCode?row.sku:""}
          </td>
          <td className={TD+" break-words"}>{row.name}</td>
          <td className={TD+" text-right"}>{row.qty}</td>
          <td className={TD+" text-center"}>{row.unit}</td>
          <td className={TD+" text-right"}>{form.showUnitPrice?money(row.total/row.qty):""}</td>
          <td className={TD+" text-right font-bold"}>{money(row.total)}</td>
        </tr>)}</tbody>
      </table>
    </div>
    <div className="flex items-start justify-between gap-2 px-1 pt-2 text-[9px]">
      <div className="min-w-0 space-y-4">
        <p><strong>AMBAR İLETİŞİM :</strong> {form.warehouseContact}</p>
        <p><strong>TESLİM EDİLEN BAĞ/KOLİ :</strong> {form.deliveredPackages}</p>
      </div>
      <div className="shrink-0 text-right">
        <p><strong>Şimdi Alınan Mal :</strong> <strong>{money(2580)}</strong></p>
        <p className="mt-2"><strong>Toplam Bakiye :</strong> <strong>{money(2580)}</strong></p>
      </div>
    </div>
    {form.footerNote&&<p className="break-words px-1 pt-3 text-[9px]">{form.footerNote}</p>}
    <div className="mt-8 border-t border-slate-200 pt-2 text-[8px] text-slate-500">
      Örnek verilerle hazırlanmıştır. Dahili ön muhasebe belgesidir; resmî e-Fatura değildir.
    </div>
  </div>;
}
