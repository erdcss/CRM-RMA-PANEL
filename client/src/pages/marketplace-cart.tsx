
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft, ShoppingCart, Package, Truck, Warehouse, Trash2 } from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
type CartItem={id:number;product_id:number;boxes:number;delivery_mode:string;sku:string;stock:number;company_name:string;
  total:number;valid:boolean;content?:{name:string;imageUrl:string;unitsPerBox:number;minBoxes:number}};
type Group={supplierId:number;companyName:string;deliveryMode:string;subtotal:number;platformFee:number;warehouseFee:number};
type Cart={items:CartItem[];supplierOrders:Group[];subtotal:number;currency:string;paymentEnabled:boolean;notice:string};
type Draft={id:number;status:string;subtotal:string|number;supplier_orders:number;created_at:string};
const format=(n:number)=>new Intl.NumberFormat("tr-TR",{style:"currency",currency:"TRY"}).format(n);
export default function MarketplaceCart(){
 const {data:cart,isLoading}=useQuery<Cart>({queryKey:["/api/marketplace/cart"],staleTime:0});
 const {data:drafts=[]}=useQuery<Draft[]>({queryKey:["/api/marketplace/order-drafts"],staleTime:0});
 const [busy,setBusy]=useState(false),[message,setMessage]=useState("");
 const [requestKey,setRequestKey]=useState(()=>crypto.randomUUID());
 async function remove(item:number){
   setBusy(true);setMessage("");
   try{await apiRequest("DELETE","/api/marketplace/cart/"+item);await queryClient.invalidateQueries({queryKey:["/api/marketplace/cart"]});}
   catch(e){setMessage(e instanceof Error?e.message:"Ürün silinemedi");}
   finally{setBusy(false);}
 }
 async function draft(){
   setBusy(true);setMessage("");
   try{const r=await apiRequest("POST","/api/marketplace/order-drafts",{requestKey});
     const d=await r.json() as {id:number;message?:string};
     setMessage("Sipariş taslağı #"+d.id+" kaydedildi. "+(d.message||""));
     setRequestKey(crypto.randomUUID());
     await queryClient.invalidateQueries({queryKey:["/api/marketplace/order-drafts"]});
   }catch(e){setMessage(e instanceof Error?e.message:"Taslak oluşturulamadı");}
   finally{setBusy(false);}
 }
 return <main className="min-h-screen bg-[#f6f7f9] px-4 py-6 text-slate-900">
   <div className="mx-auto max-w-5xl space-y-5">
     <Link href="/magazalar" className="text-sm text-slate-600"><ArrowLeft className="mr-2 inline h-4 w-4"/>Tedarikçi mağazalarına dön</Link>
     <div className="flex items-center gap-2"><ShoppingCart className="h-6 w-6"/><h1 className="text-2xl font-black">Pazaryeri Sepetim</h1></div>
     {message?<div role="status" className="rounded-xl bg-amber-50 p-4 text-sm text-amber-900">{message}</div>:null}
     {isLoading?<p>Sepet yükleniyor...</p>:!cart?.items?.length?<div className="rounded-2xl border bg-white p-10 text-center">Sepetiniz boş.</div>:<>
       <div className="space-y-3">
         {cart.supplierOrders.map(g=><section key={g.supplierId+":"+g.deliveryMode} className="rounded-2xl border bg-white p-4">
           <div className="mb-3 flex flex-wrap justify-between gap-3 border-b pb-3">
             <div><h2 className="font-bold">{g.companyName}</h2><p className="mt-1 flex items-center gap-2 text-xs text-slate-500">
               {g.deliveryMode==="warehouse"?<><Warehouse className="h-4 w-4"/> Depo kontrollü sevkiyat</>:<><Truck className="h-4 w-4"/> Tedarikçiden doğrudan sevkiyat</>}</p></div>
             <b>{format(g.subtotal)}</b>
           </div>
           {cart.items.filter(i=>Number(i.supplier_id??g.supplierId)===g.supplierId&&i.delivery_mode===g.deliveryMode).map(it=>
             <div key={it.id} className="flex items-center gap-3 py-2">
               {it.content?.imageUrl?<img alt="" src={it.content.imageUrl} className="h-14 w-14 rounded-lg object-contain"/>:<Package className="h-8 w-8"/>}
               <div className="min-w-0 flex-1"><p className="text-sm font-semibold">{it.content?.name||it.sku}</p>
                 <p className="text-xs text-slate-500">{it.boxes} koli · {it.content?.unitsPerBox||1} adet/koli</p>
                 {!it.valid?<p className="text-xs font-semibold text-red-600">Stok veya minimum koli koşulu değişti</p>:null}</div>
               <b className="text-sm">{format(it.total)}</b>
               <button aria-label="Sepetten sil" disabled={busy} onClick={()=>void remove(it.id)} className="rounded-lg border p-2"><Trash2 className="h-4 w-4"/></button>
             </div>)}
           <p className="mt-3 text-xs text-slate-500">Tahmini platform bedeli: {format(g.platformFee)}{g.warehouseFee>0?" · Tahmini depo kontrol bedeli: "+format(g.warehouseFee):""}. Bu bedeller satıcı mutabakatına yöneliktir.</p>
         </section>)}
       </div>
       <div className="rounded-2xl border bg-white p-5">
         <div className="flex items-center justify-between text-lg font-bold"><span>Ürünler toplamı</span><span>{format(cart.subtotal)}</span></div>
         <p className="mt-2 text-xs text-slate-500">KDV, kargo ve fiyatlandırma politikalarının son onayı olmadan bu tutar tahsilat tutarı olarak kabul edilmez.</p>
         <div className="mt-4 flex flex-wrap gap-2">
           <button disabled={busy||cart.items.some(i=>!i.valid)} onClick={()=>void draft()} className="rounded-xl bg-slate-950 px-5 py-3 text-sm font-bold text-white disabled:opacity-50">Satıcı Bazında Sipariş Taslağı Oluştur</button>
           <button disabled className="rounded-xl border px-5 py-3 text-sm font-semibold text-slate-500">Ödeme — Entegrasyon bekleniyor</button>
         </div>
       </div>
     </>}
     <section className="rounded-2xl border bg-white p-5">
       <h2 className="font-bold">Kaydedilmiş sipariş taslakları</h2>
       {drafts.length?drafts.map(d=><p key={d.id} className="mt-3 flex justify-between border-b pb-2 text-sm">
         <span>#{d.id} · {d.supplier_orders} tedarikçi · {new Date(d.created_at).toLocaleString("tr-TR")}</span>
         <b>{format(Number(d.subtotal))}</b></p>):<p className="mt-2 text-sm text-slate-500">Taslak bulunmuyor.</p>}
     </section>
   </div>
 </main>;
}
