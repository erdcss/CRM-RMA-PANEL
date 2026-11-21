import {useMemo,useState} from "react";
import {useQuery} from "@tanstack/react-query";
import {Input} from "@/components/ui/input";
export type ProductRecipient={id:number;company_name:string|null;email:string|null};
export async function fetchProductRecipients():Promise<ProductRecipient[]>{
  const result=await fetch("/api/admin/b2b-product-recipients",{credentials:"include",cache:"no-store"});
  if(!result.ok)throw Error("Firma listesi alınamadı");
  return result.json();
}
export const recipientKey=["/api/admin/b2b-product-recipients"];
export default function AdminPrivateProductCustomerSelect({
  value,onChange,allowPublic=false
}:{
  value:number|null;onChange:(id:number|null)=>void;allowPublic?:boolean
}){
  const [search,setSearch]=useState("");
  const {data=[],isLoading,isError}=useQuery<ProductRecipient[]>({
    queryKey:recipientKey,queryFn:fetchProductRecipients,staleTime:60_000
  });
  const rows=useMemo(()=>{
    const q=search.trim().toLocaleLowerCase("tr-TR");
    return q ? data.filter(x=>
      [x.company_name,x.email,String(x.id)].some(y=>String(y||"").toLocaleLowerCase("tr-TR").includes(q))
    ) : data;
  },[search,data]);
  return <div className="space-y-2">
    <Input aria-label="Firma ara" value={search} onChange={event=>setSearch(event.target.value)}
      placeholder="Firma adı veya e-posta ile ara"/>
    <select aria-label="Ürünün atanacağı firmayı seç" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      value={value===null?"":String(value)}
      onChange={event=>onChange(event.target.value?Number(event.target.value):null)}
      disabled={isLoading||isError} required={!allowPublic}>
      {allowPublic?<option value="">Herkese açık ürün</option>:<option value="">Firma seçiniz</option>}
      {value!==null&&!rows.some(x=>x.id===value)&&data.some(x=>x.id===value)
        ?data.filter(x=>x.id===value).map(x=><option key={x.id} value={x.id}>{x.company_name||"Firma"} · {x.email||"#"+x.id}</option>):null}
      {rows.map(x=><option key={x.id} value={x.id}>
        {x.company_name||"Firma"} · {x.email||"#"+x.id}
      </option>)}
    </select>
    {isLoading?<p className="text-xs text-muted-foreground">Onaylı firmalar yükleniyor…</p>:null}
    {isError?<p className="text-xs text-destructive">Firma listesi alınamadı. Sayfayı yenileyin.</p>:null}
    {!isLoading&&!isError&&!data.length?<p className="text-xs text-amber-700">Atanabilecek aktif ve onaylı B2B firma bulunamadı.</p>:null}
    <p className="text-xs text-muted-foreground">
      Özel ürünler yalnızca seçilen firmanın web ve mobil B2B kataloğunda gösterilir; diğer firmalar ürün bağlantısını da açamaz.
    </p>
  </div>;
}
