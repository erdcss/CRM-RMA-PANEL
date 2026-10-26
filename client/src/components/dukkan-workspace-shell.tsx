import {Activity, ArrowUpRight, BarChart3, Boxes, Building2, ChevronRight, Clock3, FileText, Landmark, LayoutDashboard, LockKeyhole, Package, Plus, ReceiptText, RefreshCw, ShieldCheck, Store, Users, Wallet} from "lucide-react";
import type {ReactNode} from "react";

export type DukkanSection="overview"|"sales"|"purchases"|"products"|"stock"|"orders"|"instruments"|"banks"|"parties"|"reports";
const sections:Array<{key:DukkanSection;label:string;icon:typeof Store}>=[
 {key:"overview",label:"Genel Bakış",icon:LayoutDashboard},
 {key:"sales",label:"Satış Faturaları",icon:ReceiptText},
 {key:"purchases",label:"Satın Alma Faturaları",icon:FileText},
 {key:"products",label:"Ürünler",icon:Package},
 {key:"stock",label:"Stok Hareketleri",icon:Boxes},
 {key:"orders",label:"Siparişler",icon:Clock3},
 {key:"instruments",label:"Çek ve Senetler",icon:Wallet},
 {key:"banks",label:"Bankalar",icon:Landmark},
 {key:"parties",label:"Cari Hesaplar",icon:Users},
 {key:"reports",label:"Raporlar",icon:BarChart3}
];

export function DukkanWorkspaceHeader(props:{
 logo?:string|null;stores:Array<{id:number|string;name:string}>;storeId:string;onStoreChange:(value:string)=>void;
 onRefresh:()=>void;isAdmin:boolean;isSuperAdmin:boolean;onNewStore:()=>void;
}){
 return <header className="relative mb-6 overflow-hidden rounded-[28px] bg-[#0d203d] px-5 py-7 text-white shadow-[0_18px_50px_rgba(13,32,61,0.18)] sm:px-8 sm:py-8">
  <div className="pointer-events-none absolute -right-10 -top-28 h-80 w-80 rounded-full bg-cyan-500/20 blur-3xl"/>
  <div className="pointer-events-none absolute bottom-[-130px] left-1/4 h-60 w-80 rounded-full bg-blue-600/25 blur-3xl"/>
  <div className="relative flex flex-wrap items-center justify-between gap-5">
   <div className="flex items-center gap-4">
    {props.logo?<img src={props.logo} alt="Çalışkan Dükkan" className="h-16 w-16 rounded-[20px] border border-white/20 bg-white object-contain shadow-xl"/>:
    <span className="grid h-16 w-16 place-items-center rounded-[20px] bg-gradient-to-br from-sky-400 to-blue-700 shadow-xl"><Store size={30}/></span>}
    <div><span className="mb-1 inline-flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-sky-300"><Activity size={12}/> İŞLETME YÖNETİMİ</span>
     <h1 className="text-2xl font-black tracking-tight sm:text-3xl">Çalışkan Dükkan</h1>
     <p className="mt-1 text-xs text-slate-300 sm:text-sm">Satış, stok, finans ve ekip — tek merkezde</p>
    </div>
   </div>
   <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
    {props.stores.length>0&&<label className="flex min-w-[180px] flex-1 items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-3 py-2.5 sm:flex-none">
     <Building2 size={16} className="shrink-0 text-sky-200"/>
     <select aria-label="Mağaza seç" className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-white outline-none [&>option]:text-slate-900" value={props.storeId} onChange={e=>props.onStoreChange(e.target.value)}>{props.stores.map(shop=><option key={shop.id} value={shop.id}>{shop.name}</option>)}</select>
    </label>}
    <button className="rounded-xl border border-white/20 bg-white/10 p-3 transition hover:bg-white/20" onClick={props.onRefresh} aria-label="Verileri yenile"><RefreshCw size={17}/></button>
    {props.isAdmin&&<button className="inline-flex items-center gap-2 rounded-xl bg-sky-400 px-4 py-3 text-sm font-bold text-[#082341] hover:bg-sky-300" onClick={props.onNewStore}><Plus size={16}/> Mağaza Oluştur</button>}
   </div>
  </div>
  <div className="relative mt-6 flex flex-wrap gap-2 border-t border-white/10 pt-4">
   <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200"><span className="h-2 w-2 rounded-full bg-emerald-400"/> Merkezi veri bağlantısı</span>
   <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-xs text-slate-200"><ShieldCheck size={13}/> Rol tabanlı erişim</span>
   {props.isSuperAdmin&&<span className="inline-flex items-center gap-1.5 rounded-full bg-sky-400/15 px-3 py-1.5 text-xs font-semibold text-sky-200"><ShieldCheck size={13}/> Süper Yönetici</span>}
  </div>
 </header>;
}

export function DukkanWorkspaceLayout({selected,onSelect,cashier,children}:{selected:DukkanSection;onSelect:(section:DukkanSection)=>void;cashier:boolean;children:ReactNode}){
 return <div className="grid items-start gap-5 lg:grid-cols-[218px_minmax(0,1fr)]">
  <nav aria-label="Çalışkan Dükkan modülleri" className="flex gap-1.5 overflow-x-auto rounded-[22px] border border-[#e6edf6] bg-white p-2.5 shadow-sm lg:sticky lg:top-4 lg:flex-col lg:overflow-visible lg:p-3">
   <div className="hidden px-3 pb-3 pt-2 text-[11px] font-extrabold uppercase tracking-[0.16em] text-slate-400 lg:block">ÇALIŞMA ALANI</div>
   {sections.filter(t=>!cashier||!["purchases","instruments","banks","reports","stock","products"].includes(t.key)).map(item=>{
    const Icon=item.icon;
    return <button key={item.key} onClick={()=>onSelect(item.key)} aria-current={selected===item.key?"page":undefined}
      className={"flex shrink-0 items-center gap-2.5 whitespace-nowrap rounded-xl px-3.5 py-3 text-left text-[13px] font-semibold transition lg:w-full "+
        (selected===item.key?"bg-gradient-to-r from-[#123e78] to-[#125a99] text-white shadow-md shadow-blue-900/15":"text-slate-600 hover:bg-slate-100 hover:text-[#123e78]")}>
     <Icon size={17} className="shrink-0"/><span className="flex-1">{item.label}</span>{selected===item.key&&<ChevronRight size={14} className="hidden text-sky-200 lg:block"/>}
    </button>;
   })}
   <div className="mt-3 hidden rounded-xl bg-sky-50 p-3 lg:block"><span className="flex items-center gap-2 text-xs font-bold text-[#184b86]"><LockKeyhole size={14}/> Güvenli kayıtlar</span><p className="mt-1 text-[11px] leading-5 text-slate-500">Tüm işlemler mağaza yetkileriyle korunur.</p></div>
  </nav>
  <main className="min-w-0">{children}</main>
 </div>;
}
