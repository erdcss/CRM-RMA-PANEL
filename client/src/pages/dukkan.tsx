import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { FormEvent } from "react";
import { useLocation } from "wouter";
import { useBranding } from "@/hooks/use-branding";
import {DukkanWorkspaceHeader,DukkanWorkspaceLayout} from "@/components/dukkan-workspace-shell";
import {DukkanSuperManagerPanel} from "@/components/dukkan-super-manager-panel";
import {DukkanInvoiceFormSettings} from "@/components/dukkan-invoice-form-settings";
import {DukkanAiDocumentImport,type AiDocumentDraft} from "@/components/dukkan-ai-document-import";
import {fileToCompressedDataUrl} from "@/lib/compress-image";
import {DukkanProductToolbar} from "@/components/dukkan-product-toolbar";
import {DukkanStockWorkspace,type StockProduct} from "@/components/dukkan-stock-workspace";
import { DukkanCariSearchPicker } from "@/components/dukkan-cari-search-picker";
import { DukkanCariActionsDrawer } from "@/components/dukkan-cari-actions-drawer";
import {DEFAULT_PRODUCT_TOOLBAR,paginateDukkanProducts,restoreProductToolbar,selectDukkanProducts,type ProductToolbarState} from "@/lib/dukkan-product-toolbar";
import { Building2, Plus, RefreshCw, Store, Trash2, ShieldCheck, Eye, EyeOff, Download, Activity, Users, Package, FileText, BarChart3, ChevronRight, ArrowUpRight, LayoutDashboard, Wallet, Landmark, ReceiptText, Boxes, Clock3, Search, Menu, X, Lock, ImagePlus, Link2, CheckCircle2 } from "lucide-react";

type Entry = Record<string, any>;
type Field = { key: string; label: string; type?: "text" | "number" | "date" | "select"; options?: Array<{ value: string; label: string }>; required?: boolean };
type DocLine = { productId: string; quantity: string; unitPrice: string; taxRate: string };
type Section = "overview" | "sales" | "purchases" | "products" | "stock" | "orders" | "instruments" | "banks" | "parties" | "suppliers" | "reports" | "settings";
const SECTIONS: Array<{ key: Section; label: string }> = [
  { key:"overview",label:"Genel Bakış" },{key:"sales",label:"Satış Faturaları"},
  {key:"purchases",label:"Satın Alma Faturaları"},{key:"products",label:"Ürünler"},
  {key:"stock",label:"Stok Hareketleri"},{key:"orders",label:"Siparişler"},
  {key:"instruments",label:"Çek ve Senetler"},{key:"banks",label:"Bankalar"},
  {key:"parties",label:"Cari Hesaplar"},{key:"suppliers",label:"Tedarikçi Firmalar"},{key:"reports",label:"Raporlar"},{key:"settings",label:"Ayarlar"}
];
const NEW_LINE: DocLine = { productId:"",quantity:"1",unitPrice:"0",taxRate:"20" };
const currency=(v: unknown)=>Number(v||0).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
const fmt=(v:unknown)=>v===null||v===undefined?"—":String(v);
const api=async(path:string,options?:RequestInit)=>{
  const response=await fetch(path,{credentials:"include",cache:"no-store",...options,headers:{"Content-Type":"application/json",...(options?.headers||{})}});
  const value=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(value.error||"İşlem tamamlanamadı");
  return value;
};
const buttonClass="inline-flex items-center justify-center gap-2 rounded-xl bg-[#122a51] px-4 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[#224d8b] disabled:opacity-40";
const inputClass="w-full min-w-0 rounded-xl border border-[#dbe5f0] bg-white px-3.5 py-3 text-sm text-[#142b4e] outline-none transition focus:border-sky-400 focus:ring-2 focus:ring-sky-100";
const softCard="rounded-[24px] border border-[#e6edf6] bg-white p-5 shadow-[0_8px_30px_rgba(15,23,42,0.035)] sm:p-6";

export default function Dukkan() {
  const {data:branding}=useBranding();
  const [,navigate]=useLocation();
  const [stores,setStores]=useState<Entry[]>([]);
  const [isAdmin,setIsAdmin]=useState(false);
  const [isSuperAdmin,setIsSuperAdmin]=useState(false);
  const [pdfBusyId,setPdfBusyId]=useState<string|null>(null);
  const [settingsView,setSettingsView]=useState<"general"|"forms">("general");
  const [members,setMembers]=useState<Entry[]>([]);
  const [storeId,setStoreId]=useState(()=>{
    const fromUrl=new URLSearchParams(window.location.search).get("storeId");
    if(fromUrl)return fromUrl;
    try{
      const returning=sessionStorage.getItem("dukkan:return-to-products");
      const previous=JSON.parse(sessionStorage.getItem("dukkan:last-product-list")||"null");
      if(returning&&previous?.storeId===returning)return returning;
    }catch{ /* storage unavailable */ }
    return "";
  });
  const [section,setSection]=useState<Section>(()=>{
    const params=new URLSearchParams(window.location.search);
    const tab=params.get("tab");
    try{
      const returning=sessionStorage.getItem("dukkan:return-to-products");
      const previous=JSON.parse(sessionStorage.getItem("dukkan:last-product-list")||"null");
      if(returning&&previous?.storeId===returning&&
          (!params.get("storeId")||params.get("storeId")===returning)){
        sessionStorage.removeItem("dukkan:return-to-products");
        return "products";
      }
    }catch{ /* use query-string fallback */ }
    return SECTIONS.some(item=>item.key===tab)?tab as Section:"overview";
  });
  const [productToolbar,setProductToolbar]=useState<ProductToolbarState>(()=>{
    try{
      const initialStore=new URLSearchParams(window.location.search).get("storeId")||"";
      return restoreProductToolbar(sessionStorage.getItem("dukkan:products-toolbar:"+initialStore));
    }catch{return {...DEFAULT_PRODUCT_TOOLBAR};}
  });
  const toolbarStore=useRef(new URLSearchParams(window.location.search).get("storeId")||"");
  const [rows,setRows]=useState<Entry[]>([]);
  const [parties,setParties]=useState<Entry[]>([]);
  const [products,setProducts]=useState<Entry[]>([]);
  const [productCounts,setProductCounts]=useState<{storeId:string;publishedB2B:number;dukkanTotal:number}|null>(null);
  const [b2bCatalog,setB2bCatalog]=useState<Entry[]>([]);
  const [productImages,setProductImages]=useState<string[]>([]);
  const [publishToB2B,setPublishToB2B]=useState(false);
  const [editingLoading,setEditingLoading]=useState(false);
  const [banks,setBanks]=useState<Entry[]>([]);
  const [report,setReport]=useState<Entry|null>(null);
  const [draft,setDraft]=useState<Record<string,string>>({});
  const [lines,setLines]=useState<DocLine[]>([{...NEW_LINE}]);
  const [notice,setNotice]=useState("");
  const [error,setError]=useState("");
  const [busy,setBusy]=useState(false);
  const [exportingCari,setExportingCari]=useState<"debt"|"credit"|null>(null);
  const [showForm,setShowForm]=useState(false);
  const [editingProductId,setEditingProductId]=useState<string|null>(null);
  const [editingPartyId,setEditingPartyId]=useState<string|null>(null);
  const [cariSearch,setCariSearch]=useState("");
  const [cariFilter,setCariFilter]=useState<"az"|"debtor"|"creditor"|"recent">("az");
  const [selectedCariAction,setSelectedCariAction]=useState<Entry|null>(null);
  const [editingCatalogId,setEditingCatalogId]=useState<string|null>(null);
  const [publishingId,setPublishingId]=useState<string|null>(null);
  const requestVersion=useRef(0);
  const lastLoadedStore=useRef("");
  const lastCariContext=useRef("");
  const pageCache=useRef<Map<string,Entry[]>>(new Map());
  const [newStoreName,setNewStoreName]=useState("");
  const [showNewStore,setShowNewStore]=useState(false);
  const [refresh,setRefresh]=useState(0);
  const currentStore=stores.find(s=>String(s.id)===storeId);
  const cashier=currentStore?.role==="cashier";
  const base="/api/dukkan/stores/"+encodeURIComponent(storeId);
  const isWriter=currentStore?.role!=="viewer";
  const canManage=currentStore?.role==="owner"||currentStore?.role==="manager";
  const canManageStock=canManage||currentStore?.role==="accountant"||(isAdmin&&currentStore?.role!=="viewer");
  const canAccount=!cashier;
  const isManager=["owner","manager"].includes(String(currentStore?.role));
  const canAccessSettings=canManage||isSuperAdmin;
  useEffect(()=>{
    if(section==="settings"&&!canAccessSettings)setSection("overview");
  },[section,canAccessSettings]);
  const identity=useMemo(()=>new URLSearchParams(window.location.search).get("tab"),[]);
  useEffect(()=>{
    if(!storeId||toolbarStore.current===storeId)return;
    toolbarStore.current=storeId;
    try{setProductToolbar(restoreProductToolbar(sessionStorage.getItem("dukkan:products-toolbar:"+storeId)));}
    catch{setProductToolbar({...DEFAULT_PRODUCT_TOOLBAR});}
  },[storeId]);
  useEffect(()=>{
    if(!storeId||toolbarStore.current!==storeId)return;
    try{sessionStorage.setItem("dukkan:products-toolbar:"+storeId,JSON.stringify(productToolbar));}
    catch{ /* Filtering works without browser storage. */ }
  },[storeId,productToolbar]);
  const changeToolbar=(changes:Partial<ProductToolbarState>)=>{
    setProductToolbar(current=>({...current,...changes,page:changes.page!==undefined?changes.page:1}));
  };

  useEffect(()=>{if(identity && SECTIONS.some(s=>s.key===identity))setSection(identity as Section);},[identity]);
  const loadStores=useCallback(async()=>{
    try {
      const list=await api("/api/dukkan/stores") as Entry[];
      setStores(list);setStoreId(previous=>list.some(s=>String(s.id)===previous)?previous:String(list[0]?.id||""));
    }catch(e){setError((e as Error).message);}
  },[]);
  useEffect(()=>{void loadStores(); void api("/api/auth/me").then(person=>{setIsAdmin(["super_admin","admin"].includes(person.role));setIsSuperAdmin(person.role==="super_admin");}).catch(()=>{});},[loadStores]);
  const load=useCallback(async()=>{
    if(!storeId)return;
    const request=++requestVersion.current;
    const isCurrent=()=>request===requestVersion.current;
    const productPage=section==="products";
    // The B2B catalog is auto-imported by /data/products; one source of truth.
    const wantsCatalog=false;
    try{
      if(section==="stock"){
        // A dedicated lean endpoint avoids expensive catalog imports, customer
        // balances, bank reports and invoice queries on stock-page transitions.
        const stockProducts=await api(base+"/stock-products");
        if(isCurrent()){
          setProducts(Array.isArray(stockProducts)?stockProducts:[]);
          setError("");
        }
        return;
      }
      // One atomic list update: never briefly replace the full product list with
      // only local products during the 10-second background refresh.
      const needsProducts=["products","sales","purchases","orders"].includes(section);
      const needsParties=["parties","suppliers","sales","purchases","orders","instruments","reports"].includes(section);
      const needsBanks=!cashier&&["banks","parties","suppliers"].includes(section);
      const needsReport=!cashier&&["overview","reports"].includes(section);
      const resource:Record<Section,string|null>={
        overview:"invoices",sales:"invoices",purchases:"invoices",products:null,stock:null,
        orders:"orders",instruments:"instruments",banks:"bank-movements",
        parties:"parties",suppliers:"parties",reports:"cari-movements",settings:null
      };
      // All visible resources load in parallel. Unrelated heavy product, bank and
      // cari queries are not awaited when entering another module.
      const [partiesResult,productsResult,banksResult,reportResult,catalogOutcome,summaryOutcome,
        resourceResult,membersResult]=await Promise.all([
        needsParties?api(base+"/data/parties"):Promise.resolve(null),
        needsProducts?api(base+"/data/products"):Promise.resolve(null),
        needsBanks?api(base+"/data/banks"):Promise.resolve(null),
        needsReport?api(base+"/report"):Promise.resolve(null),
        wantsCatalog
          ? api(base+"/catalog/b2b").then(value=>({value,error:""}))
            .catch(error=>({value:null,error:(error as Error).message}))
          : Promise.resolve({value:[],error:""}),
        productPage?api(base+"/catalog/summary").catch(()=>null):Promise.resolve(null),
        resource[section]?api(base+"/data/"+resource[section]):Promise.resolve([]),
        section==="settings"&&canManage?api(base+"/members"):Promise.resolve([]),
      ]);
      if(!isCurrent())return;
      const catalog=Array.isArray(catalogOutcome.value)?catalogOutcome.value:[] as Entry[];
      const warning=wantsCatalog&&catalogOutcome.error
        ? "B2B kataloğunun bağlantısı geçici olarak kesildi: "+catalogOutcome.error+
          ". Son başarılı liste korunuyor."
        : "";
      const result=Array.isArray(resourceResult)?resourceResult as Entry[]:[];
      setMembers(Array.isArray(membersResult)?membersResult:[]);
      if(!isCurrent())return;
      const sameStore=lastLoadedStore.current===storeId;
      if(Array.isArray(partiesResult))setParties(partiesResult);
      if(Array.isArray(banksResult))setBanks(banksResult);
      if(reportResult!==null)setReport(reportResult);
      if(Array.isArray(productsResult))setProducts(productsResult);
      if(summaryOutcome && Number.isFinite(summaryOutcome.publishedB2B) && Number.isFinite(summaryOutcome.dukkanTotal)){
        setProductCounts({storeId,publishedB2B:summaryOutcome.publishedB2B,dukkanTotal:summaryOutcome.dukkanTotal});
      }
      setB2bCatalog(current=>warning&&sameStore?current:catalog);
      const previous=pageCache.current.get(storeId+":"+section)||[];
      const nextRows=section==="products"?[
        ...(Array.isArray(productsResult)?productsResult:[]).map((item:Entry)=>({...item,_source:"dukkan"})),
        ...(warning&&sameStore?previous.filter(item=>item._source==="b2b"):
          catalog.map((item:Entry)=>({...item,id:"b2b-"+item.id,_b2bId:String(item.id),
            _source:"b2b",sale_price:item.price,stock:item.stock}))),
      ]:result;
      pageCache.current.set(storeId+":"+section,nextRows);
      setRows(nextRows);
      lastLoadedStore.current=storeId;
      setError(warning);
    }catch(e){
      if(isCurrent())setError("Ürünler yenilenemedi; son liste korunuyor. "+(e as Error).message);
    }
  },[base,storeId,section,cashier,canManage]);
  // Switching back to an already opened module shows its last rows immediately,
  // while the fresh request updates them without a blocking full-page loader.
  useEffect(()=>{
    const stored=pageCache.current.get(storeId+":"+section);
    if(stored&&section!=="stock")setRows(stored);
  },[storeId,section]);
  useEffect(()=>{
    void load();
    return()=>{ requestVersion.current++; };
  },[load,refresh]);
  useEffect(()=>{
    const context=storeId+":"+section;
    // React StrictMode may re-run mount effects: preserve restored filters on the second run.
    if(lastCariContext.current===context)return;
    lastCariContext.current=context;
    setDraft({});setLines([{...NEW_LINE}]);setShowForm(false);
    setEditingProductId(null);setEditingCatalogId(null);setEditingPartyId(null);
    // Restore the exact customer/supplier filter used before entering a cari card.
    let restored=false;
    try{
      const last=JSON.parse(sessionStorage.getItem("dukkan:last-cari-list")||"null");
      if(["parties","suppliers"].includes(section)&&storeId&&
          sessionStorage.getItem("dukkan:return-to-cari")==="1"&&
          last?.storeId===storeId&&last?.section===section){
        setCariSearch(typeof last.search==="string"?last.search:"");
        setCariFilter(["az","debtor","creditor","recent"].includes(last.filter)?last.filter:"az");
        sessionStorage.removeItem("dukkan:return-to-cari");
        sessionStorage.setItem("dukkan:restore-cari-scroll","1");
        restored=true;
      }
    }catch{ /* storage may be unavailable */ }
    if(!restored){setCariSearch("");setCariFilter("az");}
    setProductImages([]);setPublishToB2B(false);
  },[section,storeId]);
  // The database bridge writes synchronously; refresh open catalog views so changes
  // made on a second device or in B2B appear without a full page reload.
  useEffect(()=>{
    if(section!=="products"||!storeId||showForm)return;
    const timer=window.setInterval(()=>setRefresh(value=>value+1),10000);
    const onFocus=()=>setRefresh(value=>value+1);
    window.addEventListener("focus",onFocus);
    return()=>{window.clearInterval(timer);window.removeEventListener("focus",onFocus);};
  },[section,storeId,showForm]);

  useEffect(()=>{
    if(section!=="products"||!rows.length)return;
    try{
      if(sessionStorage.getItem("dukkan:restore-scroll")!=="1")return;
      const last=JSON.parse(sessionStorage.getItem("dukkan:last-product-list")||"null");
      if(last?.storeId!==storeId)return;
      const scroll=Number(last.scroll);
      if(!Number.isFinite(scroll))return;
      sessionStorage.removeItem("dukkan:restore-scroll");
      requestAnimationFrame(()=>{
        const container=document.querySelector<HTMLElement>("[data-dukkan-scroll]");
        if(container)container.scrollTop=Math.max(0,scroll);
      });
    }catch{ /* ignore stale navigation state */ }
  },[storeId,section,rows.length]);
  useEffect(()=>{
    if(!["parties","suppliers"].includes(section)||!storeId||!rows.length)return;
    try{
      if(sessionStorage.getItem("dukkan:restore-cari-scroll")!=="1")return;
      const last=JSON.parse(sessionStorage.getItem("dukkan:last-cari-list")||"null");
      if(last?.storeId!==storeId||last?.section!==section)return;
      const scroll=Number(last.scroll);
      sessionStorage.removeItem("dukkan:restore-cari-scroll");
      if(!Number.isFinite(scroll))return;
      requestAnimationFrame(()=>{
        const container=document.querySelector<HTMLElement>("[data-dukkan-scroll]");
        if(container)container.scrollTop=Math.max(0,scroll);
      });
    }catch{ /* ignore stale navigation state */ }
  },[storeId,section,rows.length]);
  const partyOpts=parties.map(v=>({value:String(v.id),label:v.name+" (#"+v.id+")"}));
  const productOpts=products.map(v=>({value:String(v.id),label:v.name+" · "+v.sku+" · stok "+v.stock}));
  const bankOpts=banks.map(v=>({value:String(v.id),label:v.name+" · "+currency(v.balance)}));
  const fields:Field[]=useMemo(()=>{
    const party={key:"partyId",label:"Cari Hesap",type:"select" as const,options:partyOpts,required:true};
    const product={key:"productId",label:"Ürün",type:"select" as const,options:productOpts,required:true};
    const bank={key:"bankId",label:"Banka",type:"select" as const,options:bankOpts,required:true};
    switch(section){
      case "products":return [{key:"name",label:"Ürün Adı",required:true},{key:"sku",label:"Stok Kodu",required:true},
        {key:"barcode",label:"Barkod"},{key:"brand",label:"Marka"},{key:"category",label:"Kategori"},
        ...(editingCatalogId?[{key:"stock",label:"B2B Stok Adedi",type:"number" as const,required:true}]:
          [{key:"unit",label:"Birim"},{key:"purchasePrice",label:"Alış Fiyatı",type:"number" as const}]),
        {key:"salePrice",label:"Satış Fiyatı",type:"number"},
        {key:"unitsPerBox",label:"Koli İçi Adet",type:"number"},
        {key:"minOrderQty",label:"Minimum Koli",type:"number"},
        {key:"description",label:"Ürün Açıklaması"}];
      case "parties":case "suppliers":return [
        {key:"name",label:"Firma / Kişi Adı",required:true},
        {key:"type",label:"Cari Tipi",type:"select",required:true,options:[
          {value:"customer",label:"Müşteri"},{value:"supplier",label:"Tedarikçi"},
          ...(editingPartyId&&draft.type==="both"?[{value:"both",label:"Müşteri / Tedarikçi (eski kayıt)"}]:[])
        ]},
        {key:"sourceCariNo",label:"Cari No"},{key:"accountCode",label:"Hesap Kodu"},
        {key:"city",label:"İl"},{key:"taxNumber",label:"Vergi Numarası"},
        {key:"phone",label:"Telefon"},{key:"email",label:"E-posta"},{key:"specialCode",label:"Özel Kod"}
      ];
      case "stock":return [product,{key:"delta",label:"Stok Değişimi (+/-)",type:"number",required:true},{key:"note",label:"Açıklama"}];
      case "sales":case "purchases":return [party,{key:"date",label:"Fatura Tarihi",type:"date"},{key:"kind",label:"İşlem Türü",type:"select",options:section==="sales"?(cashier?[{value:"sale",label:"Satış faturası"}]:[{value:"sale",label:"Satış faturası"},{value:"sale_return",label:"Satış iadesi"}]):[{value:"purchase",label:"Alış faturası"},{value:"purchase_return",label:"Alış iadesi"}]}];
      case "orders":return [party,{key:"number",label:"Sipariş Numarası",required:true},{key:"kind",label:"Sipariş Tipi",type:"select",options:cashier?[{value:"sale",label:"Müşteri siparişi"}]:[{value:"sale",label:"Müşteri siparişi"},{value:"purchase",label:"Tedarikçi siparişi"}]}];
      case "instruments":return [party,{key:"kind",label:"Tür",type:"select",options:[{value:"cheque",label:"Çek"},{value:"promissory",label:"Senet"}]},{key:"direction",label:"Yön",type:"select",options:[{value:"received",label:"Alınan"},{value:"issued",label:"Verilen"}]},{key:"number",label:"Belge Numarası",required:true},{key:"amount",label:"Tutar (TL)",type:"number",required:true},{key:"dueDate",label:"Vade",type:"date",required:true},{key:"note",label:"Açıklama"}];
      case "banks":return [bank,{key:"type",label:"İşlem",type:"select",options:[{value:"deposit",label:"Para girişi"},{value:"withdrawal",label:"Para çıkışı"}]},{key:"amount",label:"Tutar (TL)",type:"number",required:true},{key:"note",label:"Açıklama"}];
      default:return [];
    }
  },[section,parties,products,banks,cashier,editingCatalogId,editingPartyId,draft.type]);

  const applyAiDocument=(extracted:AiDocumentDraft)=>{
    const data={...extracted.fields};
    if(section==="parties")data.type=data.kind||"customer";
    if(section==="sales")data.kind=["sale","sale_return"].includes(data.kind)?data.kind:"sale";
    if(section==="purchases")data.kind=["purchase","purchase_return"].includes(data.kind)?data.kind:"purchase";
    if(section==="products"&&extracted.products.length===1)Object.assign(data,extracted.products[0]);
    setDraft(data);
    if(["sales","purchases"].includes(section)){
      setLines(extracted.lines.length?extracted.lines.map(item=>({
        productId:item.productId||"",quantity:item.quantity||"1",unitPrice:item.unitPrice||"0",taxRate:item.taxRate||"20"
      })):[{...NEW_LINE}]);
    }
    setEditingProductId(null);setEditingCatalogId(null);setEditingPartyId(null);
    if(section==="products"){setProductImages([]);setPublishToB2B(false);}
    setShowForm(true);
    setNotice("AI taslağı hazır. Belge alanlarını ve eşleşmeyen kayıtları kontrol edip Kaydet ve İşle düğmesine basın.");
    setError("");
  };
  const put=(k:string,v:string)=>setDraft(d=>({...d,[k]:v}));
  const onSubmit=async(e:FormEvent)=>{
    e.preventDefault();if(!storeId)return;
    setBusy(true);setError("");setNotice("");
    try{
      const body:Entry={...draft};
      let path="";
      if(section==="sales"||section==="purchases"){
        path="/invoices";body.kind=body.kind||(section==="sales"?"sale":"purchase");
        body.requestKey=globalThis.crypto.randomUUID();
        body.lines=lines.map(l=>({productId:Number(l.productId),quantity:Number(l.quantity),unitPrice:Number(l.unitPrice),taxRate:Number(l.taxRate)}));
      }else if(section==="orders"){
        path="/orders";body.kind=body.kind||"sale";
        body.lines=lines.map(l=>({productId:Number(l.productId),quantity:Number(l.quantity),unitPrice:Number(l.unitPrice),taxRate:0}));
      }else if(section==="products"){
        path="/products";body.images=productImages;body.publishB2B=publishToB2B;
        body.unitsPerBox=Number(draft.unitsPerBox||1);body.minOrderQty=Number(draft.minOrderQty||1);
        if(editingCatalogId)body.stock=Number(draft.stock);
        if(publishToB2B&&!productImages.length)throw new Error("B2B'de yayınlamak için önce ürün görseli ekleyin.");
      }
      else if(section==="parties"||section==="suppliers"){path="/parties";body.type=body.type||(section==="suppliers"?"supplier":"customer");}
      else if(section==="stock")path="/stock-movements";
      else if(section==="instruments"){path="/instruments";body.kind=body.kind||"cheque";body.direction=body.direction||"received";}
      else if(section==="banks"){path="/bank-movements";body.type=body.type||"deposit";}
      else return;
      const editing=(section==="products"&&Boolean(editingProductId||editingCatalogId))||
        ((section==="parties"||section==="suppliers")&&Boolean(editingPartyId));
      const url=editingCatalogId
        ? base+"/catalog/b2b/"+encodeURIComponent(editingCatalogId)
        : base+path+(editingProductId?"/"+editingProductId:editingPartyId?"/"+editingPartyId:"");
      const saved=await api(url,{method:editing?"PATCH":"POST",body:JSON.stringify(body)});
      setNotice("İşlem başarıyla kaydedildi. Tüm cihazlardaki ortak veritabanına işlendi."+
        (section==="products"?(publishToB2B?" Ürün Çalışkan B2B'de yayına alındı.":" Ürün B2B taslağına kaydedildi; henüz yayında değil."):"")+
        ((section==="sales"||section==="purchases")?" Fatura numarası: "+saved.invoice_no:""));
      setEditingProductId(null);setEditingCatalogId(null);setEditingPartyId(null);
      setShowForm(false);setDraft({});setProductImages([]);setPublishToB2B(false);setLines([{...NEW_LINE}]);setRefresh(x=>x+1);
    }catch(e){setError((e as Error).message);}
    finally{setBusy(false);}
  };
  const editCari=(item:Entry)=>{
    if(!isWriter||!canAccount||!storeId||!item.id)return;
    const backRoute="/dukkan?tab="+section+"&storeId="+encodeURIComponent(storeId);
    const scroll=document.querySelector<HTMLElement>("[data-dukkan-scroll]")?.scrollTop||0;
    try{
      sessionStorage.setItem("dukkan:last-cari-list",JSON.stringify({
        storeId,section,search:cariSearch,filter:cariFilter,scroll,route:backRoute
      }));
      sessionStorage.setItem("dukkan:return-to-cari","1");
    }catch{ /* deep link works without session storage */ }
    // Ensure the browser Back button restores the same list, even if the tab was switched without a URL change.
    if(window.location.pathname==="/dukkan")
      window.history.replaceState(window.history.state,"",backRoute);
    navigate("/dukkan/cariler/"+encodeURIComponent(String(item.id))+
      "?storeId="+encodeURIComponent(storeId)+"&from="+section);
  };
  const editProduct=(item:Entry)=>{
    if(!canManage||item._source==="b2b")return;
    const scroll=document.querySelector<HTMLElement>("[data-dukkan-scroll]")?.scrollTop||0;
    const backRoute="/dukkan?tab=products&storeId="+encodeURIComponent(storeId);
    try{
      sessionStorage.setItem("dukkan:last-product-list",JSON.stringify({
        route:backRoute,storeId,scroll,productId:String(item.id),
      }));
      sessionStorage.setItem("dukkan:return-to-products",storeId);
      sessionStorage.setItem("dukkan:restore-scroll","1");
    }catch{ /* navigation works even if browser storage is disabled */ }
    // Browser Back also needs the same tab/store route as the editor's back button.
    if(window.location.pathname==="/dukkan"){
      window.history.replaceState(window.history.state,"",backRoute);
    }
    navigate("/dukkan/urunler/"+encodeURIComponent(String(item.id))+
      "?storeId="+encodeURIComponent(storeId));
  };
  const togglePublication=async(item:Entry)=>{
    if(!canManage||publishingId)return;
    const global=item._source==="b2b";
    if(global&&(!isAdmin||item.linked_to_store))return;
    const published=global?item.is_active!==false:Boolean(item.publish_b2b);
    const target=global?String(item._b2bId):String(item.id);
    const key=(global?"b2b:":"dukkan:")+target;
    setPublishingId(key);setError("");setNotice("");
    try{
      const endpoint=global
        ? base+"/catalog/b2b/"+encodeURIComponent(target)+"/publication"
        : base+"/products/"+encodeURIComponent(target)+"/publication";
      await api(endpoint,{method:"PATCH",body:JSON.stringify({published:!published})});
      // Reflect the committed state without waiting for the next polling cycle.
      setRows(current=>current.map(entry=>entry.id===item.id&&entry._source===item._source
        ? {...entry,[global?"is_active":"publish_b2b"]:!published}:entry));
      setB2bCatalog(current=>global?current.map(entry=>String(entry.id)===target
        ? {...entry,is_active:!published}:entry):current);
      setNotice(item.name+" B2B'de "+(published?"yayından kaldırıldı.":"yayına alındı."));
      setRefresh(value=>value+1);
    }catch(e){setError((e as Error).message);}
    finally{setPublishingId(null);}
  };
  const addProductImages=async(files:File[])=>{
    try{
      const accepted=files.filter(f=>["image/jpeg","image/png","image/webp"].includes(f.type));
      if(accepted.length!==files.length)throw new Error("Yalnızca PNG, JPG ve WebP görseller desteklenir.");
      if(productImages.length+accepted.length>6)throw new Error("En fazla 6 ürün görseli yükleyebilirsiniz.");
      const images=await Promise.all(accepted.map(fileToCompressedDataUrl));
      setProductImages(current=>[...current,...images].slice(0,6));
    }catch(e){setError((e as Error).message);}
  };
  const exportPdf=async(invoice:Entry,print=false)=>{
    if(pdfBusyId)return;
    const viewer=print?window.open("","_blank"):null;
    if(viewer){
      viewer.document.title="Çalışkan Dükkân - Fatura Yazdır";
      viewer.document.body.textContent="Yazdırma belgesi hazırlanıyor...";
    }
    setPdfBusyId(String(invoice.id));setError("");
    try{
      const detail=await api(base+"/invoices/"+encodeURIComponent(String(invoice.id))+"/pdf-data");
      const pdf=await import("@/lib/dukkan-invoice-pdf");
      if(print)pdf.showDukkanInvoicePrint(pdf.renderDukkanInvoicePdf(detail),viewer);
      else await pdf.exportDukkanInvoicePdf(detail);
      const kind=String(invoice.kind).startsWith("purchase")?"Alış":"Satış";
      setNotice(kind+" belgesi "+(print?"yazdırılmak üzere açıldı":"PDF olarak indirildi")+": "+invoice.invoice_no);
    }catch(e){
      viewer?.close();
      setError("Belge hazırlanamadı: "+(e as Error).message);
    }finally{setPdfBusyId(null);}
  };
  const createStore=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);
    try{await api("/api/dukkan/stores",{method:"POST",body:JSON.stringify({name:newStoreName})});setNewStoreName("");setShowNewStore(false);await loadStores();}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const submitSpecial=async(resource:string,payload:Entry)=>{
    setBusy(true);setError("");
    try{await api(base+"/"+resource,{method:"POST",body:JSON.stringify(payload)});setNotice("İşlem kaydedildi");setDraft({});setRefresh(n=>n+1);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const downloadCariExcel=async(kind:"debt"|"credit")=>{
    if(!storeId||exportingCari)return;
    setExportingCari(kind);
    setError("");
    try{
      const response=await fetch(base+"/report/cari-excel?type="+kind,{
        credentials:"include",cache:"no-store"
      });
      if(!response.ok){
        const body=await response.json().catch(()=>({}));
        throw new Error(body.error||"Cari Excel raporu indirilemedi.");
      }
      const blob=await response.blob();
      const objectUrl=URL.createObjectURL(blob);
      const anchor=document.createElement("a");
      anchor.href=objectUrl;
      anchor.download="caliskan-dukkan-"+(kind==="debt"?"borclu":"alacakli")+"-cariler.xlsx";
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      window.setTimeout(()=>URL.revokeObjectURL(objectUrl),30000);
    }catch(error){
      setError((error as Error).message);
    }finally{
      setExportingCari(null);
    }
  };
  const updateInstrument=async(row:Entry,status:string)=>{
    setBusy(true);try{await api(base+"/instruments/"+row.id,{method:"PATCH",body:JSON.stringify({status})});setRefresh(n=>n+1);}
    catch(e){setError((e as Error).message);}finally{setBusy(false);}
  };
  const updateLine=(i:number,k:keyof DocLine,v:string)=>setLines(old=>old.map((l,n)=>{
    if(n!==i)return l;
    const next={...l,[k]:v};
    if(k==="productId"){const selected=products.find(p=>String(p.id)===v);next.unitPrice=String(section==="purchases"?selected?.purchase_price||0:selected?.sale_price||0);}
    return next;
  }));
  const total=lines.reduce((sum,l)=>sum+Number(l.quantity||0)*Number(l.unitPrice||0)*(1+Number(section==="orders"?0:l.taxRate||0)/100),0);
  const isCariSection=section==="parties"||section==="suppliers";
  const displayed=rows.filter(v=>{
    if(section==="sales")return ["sale","sale_return"].includes(v.kind);
    if(section==="purchases")return ["purchase","purchase_return"].includes(v.kind);
    if(!isCariSection)return true;
    // Imported legacy "both" records stay on Cari Hesaplar until explicitly reclassified.
    if(section==="suppliers"&&v.type!=="supplier")return false;
    if(section==="parties"&&v.type==="supplier")return false;
    const haystack=[v.name,v.source_cari_no,v.account_code,v.city,v.phone,v.email]
      .filter(Boolean).join(" ").toLocaleLowerCase("tr-TR");
    if(!cariSearch.trim().toLocaleLowerCase("tr-TR").split(/\s+/).filter(Boolean)
      .every(part=>haystack.includes(part)))return false;
    const balance=Number(v.balance||0);
    if(cariFilter==="debtor"&&balance<=0)return false;
    if(cariFilter==="creditor"&&balance>=0)return false;
    return true;
  }).sort((a,b)=>{
    if(!isCariSection)return 0;
    if(cariFilter==="recent"){
      const recentA=a.last_transaction_at?new Date(a.last_transaction_at).getTime():0;
      const recentB=b.last_transaction_at?new Date(b.last_transaction_at).getTime():0;
      if(recentA!==recentB)return recentB-recentA;
    }
    if(cariFilter==="debtor"||cariFilter==="creditor"){
      const difference=Math.abs(Number(b.balance||0))-Math.abs(Number(a.balance||0));
      if(difference)return difference;
    }
    return String(a.name||"").localeCompare(String(b.name||""),"tr-TR");
  });
  const matchingProducts=useMemo(()=>selectDukkanProducts(rows,productToolbar),[rows,productToolbar]);
  const pagedProducts=useMemo(()=>paginateDukkanProducts(matchingProducts,productToolbar.page,productToolbar.pageSize),[matchingProducts,productToolbar.page,productToolbar.pageSize]);
  const tableRows=section==="products"?pagedProducts.rows:displayed;
  const typeLabel:Record<string,string>={sale:"Satış",purchase:"Alış",sale_return:"Satış İadesi",purchase_return:"Alış İadesi",received:"Alınan",issued:"Verilen",pending:"Bekliyor",settled:"Tahsil/Ödendi",bounced:"Karşılıksız",cancelled:"İptal"};

  return (
    <div data-dukkan-scroll="main" className="h-full min-h-screen overflow-y-auto bg-[#f3f7fc] text-[#172945]">
      <div className="mx-auto max-w-[1700px] px-3 py-5 sm:px-7 sm:py-7">
        <DukkanWorkspaceHeader logo={branding?.dukkan_logo} stores={stores.map(item=>({id:Number(item.id),name:String(item.name||"Mağaza")}))} storeId={storeId} onStoreChange={setStoreId}
          onRefresh={()=>setRefresh(n=>n+1)} isAdmin={isAdmin} isSuperAdmin={isSuperAdmin} onNewStore={()=>setShowNewStore(v=>!v)}/>
        {error&&<div role="alert" className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
        {notice&&<div role="status" className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{notice}</div>}
        {showNewStore&&<form onSubmit={createStore} className={softCard+" mb-4 flex flex-wrap gap-2"}><input className={inputClass+" flex-1"} placeholder="Yeni mağaza adı" required value={newStoreName} onChange={e=>setNewStoreName(e.target.value)}/><button className={buttonClass} disabled={busy}>Oluştur</button></form>}
        {!storeId?<div className={softCard+" text-center"}><Building2 className="mx-auto mb-3 text-slate-400" size={34}/><h2 className="font-bold">Henüz erişilebilir mağaza yok</h2><p className="mt-2 text-sm text-slate-500">Çalışkan Admin yöneticisi mağaza oluşturup kullanıcıları mağazaya atayabilir.</p></div>:<>
          <DukkanWorkspaceLayout selected={section} onSelect={setSection} cashier={cashier} showSettings={canAccessSettings}>
          {section==="overview"&&<div className="mb-5 grid grid-cols-2 gap-3 xl:grid-cols-4">
             {([{title:"Yeni Satış",subtitle:"Hızlı fatura oluştur",icon:ReceiptText,key:"sales"},{title:"Ürün Yönetimi",subtitle:"Stok kartlarına eriş",icon:Package,key:"products"},
               {title:"Cari Hesaplar",subtitle:"Tahsilat ve alacaklar",icon:Users,key:"parties"},{title:"Rapor Merkezi",subtitle:"İşletme performansı",icon:BarChart3,key:"reports"}] as const)
              .filter(item=>!cashier||["sales","parties"].includes(item.key)).map(action=><button key={action.key} onClick={()=>{setSection(action.key);setShowForm(false);}}
               className="group flex items-center gap-3 rounded-[22px] border border-[#e2eaf5] bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-sky-200 hover:shadow-md">
               <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-[#e9f3ff] text-[#145595]"><action.icon size={20}/></span>
               <span className="min-w-0 flex-1"><strong className="block text-sm font-bold text-[#102a4a]">{action.title}</strong><span className="mt-0.5 block text-[11px] text-slate-500">{action.subtitle}</span></span>
               <ArrowUpRight size={16} className="text-slate-300 group-hover:text-sky-600"/>
              </button>)}
           </div>}
          {canAccount&&(section==="overview"||section==="reports")&&<div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-3 xl:grid-cols-6">
            {[
              ["Net Satış",currency(report?.sales)],["Net Alış",currency(report?.purchases)],
              ["Stok Maliyeti",currency(report?.stock?.stock_cost)],["Ürün Çeşidi",fmt(report?.stock?.product_count)],
              ["Cari Net Bakiye",currency(report?.netBalance)],["Banka Bakiyesi",currency(report?.bankBalance)]
            ].map(([title,value],index)=><div key={title} className="relative overflow-hidden rounded-[22px] border border-[#e2eaf5] bg-white px-4 py-5 shadow-sm transition hover:shadow-md">
                <div className={"absolute left-0 top-0 h-full w-1 "+(index===0?"bg-sky-500":index===1?"bg-indigo-500":index===2?"bg-emerald-500":"bg-[#bbcdf2]")}/>
                <div className="flex items-center justify-between gap-1"><p className="text-[11px] font-semibold text-slate-500">{title}</p><span className="h-2 w-2 rounded-full bg-[#d3e6fb]"/></div>
                <p className="mt-3 truncate text-xl font-black tabular-nums tracking-tight text-[#142b4e]">{value}</p>
               </div>)}
          </div>}
          {section==="reports"&&canAccount&&<section className={softCard+" mb-4"} aria-label="Cari hesap Excel raporları">
            <h2 className="text-lg font-extrabold text-[#142b4e]">Cari Hesap Bakiye Raporları</h2>
            <p className="mb-4 mt-1 text-sm text-slate-500">Güncel hareketlerden hesaplanan borçlu ve alacaklı carileri ayrı Excel (.xlsx) dosyaları olarak indirin. Sıfır bakiyeliler dahil edilmez.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              {(["debt","credit"] as const).map(kind=>{
                const matched=parties.filter(p=>kind==="debt"?Number(p.balance)>0:Number(p.balance)<0);
                const cents=matched.reduce((sum,p)=>sum+Math.round(Math.abs(Number(p.balance))*100),0);
                return <div key={kind} className="rounded-2xl border border-[#e0e9f5] bg-[#f8fbff] p-4">
                  <h3 className="font-bold text-[#163251]">{kind==="debt"?"Borçlu Cariler":"Alacaklı Cariler"}</h3>
                  <p className="mt-1 text-sm text-slate-500">{matched.length} cari hesap</p>
                  <p className="my-3 text-lg font-black tabular-nums text-[#142b4e]">{currency(cents/100)}</p>
                  <button type="button" disabled={exportingCari!==null}
                    onClick={()=>{void downloadCariExcel(kind);}} className={buttonClass+" w-full"}>
                    <Download size={17}/>
                    {exportingCari===kind?"Excel hazırlanıyor...":"Excel İndir (.xlsx)"}
                  </button>
                </div>;
              })}
            </div>
            <p className="mt-3 text-xs text-slate-500">Excel sütunları: Cari No, Hesap Kodu, Cari Adı, İl, Telefon, Cari Tipi, Vergi No, E-posta, Özel Kod ve Bakiye (TL).</p>
          </section>}
          {section==="reports"&&<div className={softCard+" mb-4"}><h2 className="font-bold">Vadesi geçmiş çek ve senetler</h2><p className="mt-2 text-sm">Belge: {fmt(report?.overdue?.count)} · Toplam: {currency(report?.overdue?.amount)}</p><p className="mt-2 text-xs text-slate-500">Raporlar kayıtlı işlemlerden üretilir; resmî mali tablo veya GİB e-Fatura yerine geçmez.</p></div>}
          {section==="settings"&&<div className={softCard+" mb-5"}>
            <div className="mb-4">
              <h2 className="text-lg font-black text-[#173758]">Ayarlar</h2>
              <p className="mt-1 text-xs text-slate-500">Mağaza yönetimi ve yazdırılabilir belge şablonları</p>
            </div>
            <nav aria-label="Ayarlar bölümleri" className="flex flex-wrap gap-2">
              <button type="button" onClick={()=>setSettingsView("general")} aria-pressed={settingsView==="general"}
                className={"inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition "+
                  (settingsView==="general"?"bg-[#123d70] text-white":"border border-[#d8e5f3] bg-white text-[#365a7f] hover:bg-sky-50")}>
                <Building2 size={17}/> Genel Ayarlar
              </button>
              <button type="button" onClick={()=>setSettingsView("forms")} aria-pressed={settingsView==="forms"}
                className={"inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-sm font-bold transition "+
                  (settingsView==="forms"?"bg-[#123d70] text-white":"border border-[#d8e5f3] bg-white text-[#365a7f] hover:bg-sky-50")}>
                <FileText size={17}/> Formlar
              </button>
            </nav>
          </div>}
          {section==="settings"&&settingsView==="forms"&&<DukkanInvoiceFormSettings
            key={storeId} base={base} storeId={storeId}
            storeName={String(currentStore?.name||"Çalışkan Dükkân")}
            canEdit={canManage}/>}
          {section==="settings"&&settingsView==="general"&&canManage&&<div className={softCard+" mb-5"}><h2 className="mb-3 font-bold">Personel ve Mağaza Yetkileri</h2><form className="flex flex-wrap gap-2" onSubmit={e=>{e.preventDefault();void submitSpecial("members",{username:draft.memberUsername,role:draft.memberRole||"cashier"});}}><input className={inputClass+" flex-1"} value={draft.memberUsername||""} onChange={e=>put("memberUsername",e.target.value)} required placeholder="Sistemde kayıtlı kullanıcı adı / e-posta"/><select className={inputClass} value={draft.memberRole||"cashier"} onChange={e=>put("memberRole",e.target.value)}><option value="cashier">Kasiyer</option><option value="accountant">Muhasebeci</option><option value="manager">Mağaza Müdürü</option><option value="viewer">Yalnızca Görüntüleme</option></select><button className={buttonClass} disabled={busy}>Yetki Ata</button></form><div className="mt-3 flex flex-wrap gap-2">{members.map(m=><span key={m.user_id} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs">{m.username} · {m.role}</span>)}</div></div>}
          {section==="settings"&&settingsView==="general"&&isSuperAdmin&&<DukkanSuperManagerPanel storeId={storeId}
            onCreated={name=>{setNotice(name+" süper yönetici olarak oluşturuldu. Çalışkan Admin ve Dükkan hesap bilgileriyle giriş hazır.");setRefresh(v=>v+1);}}
            onError={setError}/>}
          {section==="settings"&&settingsView==="general"&&<div className="mb-5">
            <div className={softCard}>
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-[#e6f2ff] p-3 text-[#124b85]"><Building2 size={22}/></div>
                <div><h2 className="text-lg font-black text-[#132b50]">Mağaza Ayarları</h2>
                  <p className="mt-1 text-xs text-slate-500">{currentStore?.name} · Kullanıcı ve yetki yönetimi</p></div>
              </div>
              <p className="mt-4 text-xs leading-6 text-slate-600">Personel yetkileri yalnızca seçili mağaza için geçerlidir. Süper yönetici ise tüm Çalışkan Admin modüllerine erişebilen yüksek yetkili bir hesaptır.</p>
            </div>
          </div>}
          {section!=="settings"&&<div className={softCard}>
            <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
              <div><span className="text-[10px] font-extrabold uppercase tracking-widest text-[#277ab5]">YÖNETİM MODÜLÜ</span><h2 className="mt-1 text-xl font-black tracking-tight text-[#122b4f]">{SECTIONS.find(t=>t.key===section)?.label}</h2><p className="mt-1 text-xs text-slate-500">{section==="stock"?products.length:displayed.length} kayıt · {currentStore?.name}</p></div>
              {isWriter&&(!cashier||["sales","orders"].includes(section))&&(section!=="products"||canManage)&&!["overview","reports","stock"].includes(section)&&<button onClick={()=>{setShowForm(v=>!v);setEditingProductId(null);setEditingCatalogId(null);setEditingPartyId(null);setDraft(isCariSection?{type:section==="suppliers"?"supplier":"customer"}:{});
                 setProductImages([]);setPublishToB2B(false);}} className={buttonClass}><Plus size={15} className="mr-1 inline"/>{showForm?"Formu Kapat":isCariSection?"Yeni Cari":"Yeni İşlem"}</button>}
            </div>
            {isWriter&&(["products","instruments","parties","sales","purchases"] as string[]).includes(section)&&(!cashier||["parties","sales"].includes(section))&&(!["products","stock"].includes(section)||canManage)&&
               <div className="mb-4"><DukkanAiDocumentImport key={storeId+section} section={section as AiDocumentDraft["section"]} base={base}
                 onApply={applyAiDocument} onImported={()=>{setNotice("Belgedeki ürünler başarıyla kaydedildi.");setRefresh(v=>v+1);}}/></div>}
             {section!=="stock"&&showForm&&fields.length>0&&<form id="dukkan-product-editor" onSubmit={onSubmit} className="mb-5 scroll-mt-8 rounded-[22px] border border-[#cae3fb] bg-gradient-to-br from-[#f2f8ff] via-white to-white p-5">
              <h3 className="mb-4 text-base font-black text-[#122b4f]">
                {editingCatalogId?"B2B ürün bilgilerini düzenle":editingProductId?"Ürün bilgilerini düzenle":editingPartyId?"Cari hesap bilgilerini düzenle":"Yeni kayıt oluştur"}
              </h3>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {fields.map(f=><label key={f.key} className="block min-w-0"><span className="mb-1 block text-xs font-semibold">{f.label}</span>
                  {f.type==="select"?<select className={inputClass} required={f.required} value={draft[f.key]||""} onChange={e=>put(f.key,e.target.value)}>
                    <option value="">Seçiniz</option>{f.options?.map(opt=><option key={opt.value} value={opt.value}>{opt.label}</option>)}
                  </select>:<input className={inputClass} type={f.type||"text"} step={f.type==="number"?"any":undefined} required={f.required} value={draft[f.key]||""} onChange={e=>put(f.key,e.target.value)}/>}
                </label>)}
              </div>
              {section==="products"&&<div className="mt-5 space-y-4">
                <div className="rounded-2xl border border-[#d7e7fa] bg-white p-4">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-extrabold text-[#122b4f]">Ürün Görselleri</h4>
                      <p className="text-xs text-slate-500">En fazla 6 fotoğraf · JPG, PNG veya WebP · İlk görsel kapak fotoğrafı olur</p>
                    </div>
                    <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-sky-200 bg-[#e9f4ff] px-4 py-2.5 text-xs font-bold text-[#145595] hover:bg-[#dcedff]">
                      <ImagePlus size={17}/> Görsel Ekle
                      <input type="file" accept="image/jpeg,image/png,image/webp" multiple className="sr-only"
                        onChange={e=>{void addProductImages(Array.from(e.target.files||[]));e.target.value="";}}/>
                    </label>
                  </div>
                  {productImages.length===0?<div className="grid min-h-24 place-content-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 text-center text-sm text-slate-400">
                    <ImagePlus className="mx-auto" size={24}/> Henüz ürün görseli eklenmedi
                  </div>:<div className="flex flex-wrap gap-3">
                    {productImages.map((image,i)=><div key={i} className="relative h-28 w-28 overflow-hidden rounded-xl border border-slate-200 bg-white">
                      <img src={image} alt={"Ürün görseli "+(i+1)} className="h-full w-full object-contain"/>
                      <button type="button" onClick={()=>setProductImages(old=>old.filter((_,n)=>i!==n))}
                        className="absolute right-1 top-1 rounded-full bg-white p-1 text-red-600 shadow" aria-label={"Görseli kaldır "+(i+1)}>
                        <Trash2 size={14}/></button>
                      {i===0?<span className="absolute bottom-1 left-1 rounded bg-[#112e51] px-2 py-0.5 text-[10px] text-white">Kapak</span>:null}
                    </div>)}
                  </div>}
                </div>
                <label className="flex cursor-pointer items-start gap-3 rounded-2xl border border-[#cbdcf0] bg-[#eef6ff] p-4">
                  <input type="checkbox" checked={publishToB2B} onChange={e=>setPublishToB2B(e.target.checked)}
                    className="mt-1 h-4 w-4 accent-[#145595]"/>
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-extrabold text-[#12345d]">
                      <Link2 size={18}/> Çalışkan B2B'de Yayınla
                    </span>
                    <span className="mt-1 block text-xs leading-5 text-slate-600">
                      Açıkken ürün B2B web ve mobil kataloğunda görünür. Kapatıldığında B2B kaydı taslak olur, ürün ve stok bağlantısı korunur.
                      Yayın için en az bir görsel gereklidir.
                    </span>
                  </span>
                </label>
              </div>}
              {["sales","purchases"].includes(section)&&<p className="mt-3 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs font-medium text-blue-900">Fatura Numarası: Kaydettiğinizde sistem tarafından benzersiz 14 haneli rakam atanacaktır.</p>}
              {["sales","purchases","orders"].includes(section)&&<div className="mt-5">
                <h4 className="mb-2 text-sm font-bold">Ürün Kalemleri</h4>
                <div className="mb-1 hidden grid-cols-12 gap-2 px-3 text-xs font-bold text-slate-500 md:grid">
                  <span className="col-span-4">Ürün</span><span className="col-span-2">Miktar</span><span className="col-span-2">Birim Fiyatı (TL)</span>
                  <span className="col-span-1">KDV (%)</span><span className="col-span-2 text-right">Tutar (TL)</span><span className="col-span-1 text-center">Sil</span>
                </div>
                {lines.map((l,i)=><div className="mb-2 grid grid-cols-2 items-center gap-2 rounded-xl bg-white p-3 md:grid-cols-12" key={i}>
                  <label className="col-span-2 md:col-span-4"><span className="mb-1 block text-xs font-semibold md:hidden">Ürün</span>
                    <select aria-label="Ürün" className={inputClass} value={l.productId} required onChange={e=>updateLine(i,"productId",e.target.value)}>
                      <option value="">Ürün seç</option>{productOpts.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </label>
                  <label className="md:col-span-2"><span className="mb-1 block text-xs font-semibold md:hidden">Miktar</span>
                    <input aria-label="Miktar" className={inputClass} required min="0.001" step="0.001" type="number" value={l.quantity} onChange={e=>updateLine(i,"quantity",e.target.value)}/>
                  </label>
                  <label className="md:col-span-2"><span className="mb-1 block text-xs font-semibold md:hidden">Birim Fiyatı (TL)</span>
                    <input aria-label="Birim Fiyatı (TL)" className={inputClass} required min="0" step="0.01" type="number" value={l.unitPrice} onChange={e=>updateLine(i,"unitPrice",e.target.value)}/>
                  </label>
                  <label className="md:col-span-1"><span className="mb-1 block text-xs font-semibold md:hidden">KDV (%)</span>
                    {section!=="orders"?<input aria-label="KDV (%)" className={inputClass} min="0" max="100" step="0.01" type="number" value={l.taxRate} onChange={e=>updateLine(i,"taxRate",e.target.value)}/>:<span className="text-xs text-slate-500">—</span>}
                  </label>
                  <div className="text-right md:col-span-2"><span className="mb-1 block text-xs font-semibold md:hidden">Tutar (TL)</span>
                    <strong className="text-xs tabular-nums sm:text-sm">{currency(Number(l.quantity||0)*Number(l.unitPrice||0)*(1+Number(section==="orders"?0:l.taxRate||0)/100))}</strong>
                  </div>
                  <button type="button" className="justify-self-end rounded-lg p-2 text-red-500 md:col-span-1" disabled={lines.length===1} onClick={()=>setLines(old=>old.filter((_,n)=>n!==i))} aria-label="Kalemi sil"><Trash2 size={18}/></button>
                </div>)}
                <div className="mt-2 flex items-center justify-between gap-3"><button type="button" className="rounded-lg border bg-white px-3 py-2 text-xs font-semibold" onClick={()=>setLines(old=>[...old,{...NEW_LINE}])}>+ Ürün satırı</button><strong className="text-sm">Toplam: {currency(total)}</strong></div>
              </div>}
              <div className="mt-4 flex justify-end"><button type="submit" disabled={busy} className={buttonClass}>{busy?"Kaydediliyor...":"Kaydet ve İşle"}</button></div>
            </form>}
            {section==="banks"&&isWriter&&<div className="mb-4 grid gap-3 md:grid-cols-2">
              <form className="rounded-xl border p-3" onSubmit={e=>{e.preventDefault();void submitSpecial("banks",{name:draft.newBank,iban:draft.newIban});}}><h3 className="mb-2 text-sm font-bold">Yeni banka hesabı</h3><input className={inputClass+" mb-2"} placeholder="Banka adı" required value={draft.newBank||""} onChange={e=>put("newBank",e.target.value)}/><input className={inputClass+" mb-2"} placeholder="IBAN (opsiyonel)" value={draft.newIban||""} onChange={e=>put("newIban",e.target.value)}/><button disabled={busy} className={buttonClass}>Banka Ekle</button></form>
              <div className="rounded-xl border p-3"><h3 className="mb-2 text-sm font-bold">Banka bakiyeleri</h3>{banks.map(b=><p key={b.id} className="flex justify-between border-b py-2 text-sm"><span>{b.name}</span><strong>{currency(b.balance)}</strong></p>)}</div>
            </div>}
            {isCariSection&&<section className="mb-4 rounded-2xl border border-[#dce7f4] bg-[#f6faff] p-4" aria-label="Cari liste arama ve filtreleri">
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(220px,290px)]">
                <label className="relative block min-w-0">
                  <span className="mb-1.5 block text-xs font-bold text-[#254c7c]">Cari ara</span>
                  <Search size={18} aria-hidden="true" className="pointer-events-none absolute bottom-3.5 left-3 text-slate-500"/>
                  <input type="search" className={inputClass+" pl-10"} value={cariSearch}
                    onChange={e=>setCariSearch(e.target.value)}
                    placeholder="Firma adı, cari no, hesap kodu, telefon..." aria-label="Cari hesap araması"/>
                </label>
                <label className="block min-w-0">
                  <span className="mb-1.5 block text-xs font-bold text-[#254c7c]">Sırala / filtrele</span>
                  <select className={inputClass} aria-label="Cari sıralama ve bakiye filtresi" value={cariFilter}
                    onChange={e=>setCariFilter(e.target.value as "az"|"debtor"|"creditor"|"recent")}>
                    <option value="az">A'dan Z'ye</option>
                    <option value="debtor">Borçlu Cariler</option>
                    <option value="creditor">Alacaklı Cariler</option>
                    <option value="recent">Son İşlem Yapılan Cariler</option>
                  </select>
                </label>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                {displayed.length} hesap listeleniyor · Cari kartına tıklayarak bilgilerini düzenleyebilirsiniz.
                {section==="parties"&&rows.some(item=>item.type==="both")?
                  " · Eski Müşteri / Tedarikçi kayıtları burada korunur; karttan türü değiştirilebilir.":""}
              </p>
            </section>}
            {section==="products"&&<div className="mb-3 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-sky-100 bg-[#f1f8ff] px-4 py-3 text-xs text-[#235681]">
              <span className="flex items-center gap-2 font-semibold">
                <CheckCircle2 size={16} className="shrink-0 text-emerald-600"/>
                Çalışkan B2B'de Yayında:
                <strong className="text-sm font-extrabold tabular-nums">
                  {productCounts?.storeId===storeId?productCounts.publishedB2B.toLocaleString("tr-TR"):"—"}
                </strong>
                ürün
              </span>
              <span className="flex items-center gap-2 font-semibold sm:ml-auto">
                <Package size={16} className="shrink-0 text-[#17649f]"/>
                Çalışkan Dükkân:
                <strong className="text-sm font-extrabold tabular-nums">
                  {productCounts?.storeId===storeId?productCounts.dukkanTotal.toLocaleString("tr-TR"):"—"}
                </strong>
                ürün
              </span>
            </div>}
            {section==="products"&&<DukkanProductToolbar value={productToolbar} onChange={changeToolbar}
              onClear={()=>setProductToolbar({...DEFAULT_PRODUCT_TOOLBAR})}
              page={pagedProducts} totalProducts={rows.length}/>}
            {section==="stock"&&<DukkanStockWorkspace
              key={storeId}
              storeId={storeId}
              base={base}
              products={products as StockProduct[]}
              canManage={canManageStock}
              onChanged={()=>setRefresh(value=>value+1)}
            />}
            {section!=="stock"&&<div className="overflow-x-auto rounded-2xl border border-[#e8eef7]">
              <table className={"w-full border-collapse text-left text-sm "+(section==="products"?"min-w-[1010px]":isCariSection?"min-w-[1120px]":"min-w-[650px]")}>
                <thead className="bg-[#f0f5fc] text-xs font-bold text-[#58708d]"><tr>
                  {(section==="products"?["Görsel","Stok Kodu","Ürün","Barkod","Miktar","Alış","Satış","B2B Durumu"]:
                    isCariSection?["Cari No","Hesap Kodu","Cari Adı","İl","Türü","Telefon","Bakiye"]:
                    ["sales","purchases","overview"].includes(section)?["Fatura No","Cari","Tür","Toplam","Tarih"]:
                    section==="orders"?["Sipariş No","Cari","Tür","Durum"]:
                    section==="instruments"?["Belge No","Cari","Tür","Tutar","Vade","Durum"]:
                    section==="banks"?["Tarih","Banka","İşlem","Tutar"]:
                    ["Tarih","Cari","Borç","Alacak","Açıklama"]).map(h=><th key={h} className="px-4 py-4 font-semibold">{h}</th>)}
                  {(section==="sales"||section==="purchases"||section==="instruments"||(section==="products"&&canManage))&&<th className="px-3 py-3">İşlem</th>}
                  {isCariSection&&isWriter&&canAccount&&<th className="sticky right-0 z-10 w-[125px] bg-[#f0f5fc] px-3 py-3 text-right">İşlemler</th>}
                </tr></thead>
                <tbody>{tableRows.map(r=><tr key={String(r._source||section)+":"+String(r.id)}
                  className={"group border-t border-[#edf1f7] hover:bg-[#f7faff] "+((section==="products"&&canManage&&(r._source!=="b2b"||(isAdmin&&!r.linked_to_store)))||(isCariSection&&isWriter&&canAccount)?"cursor-pointer":"")}
                  tabIndex={isCariSection&&isWriter&&canAccount?0:undefined}
                  aria-label={isCariSection&&isWriter&&canAccount?String(r.name||"Cari")+" hesabını düzenle":undefined}
                  onKeyDown={event=>{
                    if(!isCariSection||!isWriter||!canAccount||event.target!==event.currentTarget)return;
                    if(event.key==="Enter"||event.key===" "){event.preventDefault();editCari(r);}
                  }}
                  onClick={event=>{
                    if((event.target as HTMLElement).closest("button,a,input,select,textarea"))return;
                    if(isCariSection){if(isWriter&&canAccount)editCari(r);return;}
                    if(section!=="products"||!canManage||(r._source==="b2b"&&(!isAdmin||r.linked_to_store)))return;
                    void editProduct(r);
                  }}>
                  {section==="products" ? <>
                    <td className="px-3 py-2">
                      {r.image_url ? <img src={r.image_url} alt={r.name||"Ürün"} loading="lazy"
                        className="h-14 w-14 rounded-xl border border-slate-100 bg-white object-contain"/> :
                        <span className="grid h-14 w-14 place-items-center rounded-xl bg-slate-100 text-slate-400"><Package size={21}/></span>}
                    </td>
                    {[r.sku,r.name,r.barcode,r.stock,
                      r._source==="b2b"?"—":currency(r.purchase_price),
                      currency(r.sale_price)].map((v,i)=>
                      <td key={i} className={i===1?"min-w-[200px] px-4 py-3.5":"whitespace-nowrap px-4 py-3.5"}>
                        {i===1&&canManage&&(r._source!=="b2b"||(isAdmin&&!r.linked_to_store))?
                          <button type="button" className="max-w-[420px] text-left font-semibold text-[#123b6b] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-sky-500"
                            disabled={editingLoading} onClick={()=>void editProduct(r)}
                            aria-label={String(r.name||"Ürün")+" içeriğini düzenle"}>{fmt(v)}</button>:
                          fmt(v)}
                      </td>)}
                    <td className="min-w-[153px] px-3 py-3">
                      {(()=>{
                        const published=r._source==="b2b"?r.is_active!==false:Boolean(r.publish_b2b);
                        const allowed=canManage&&(r._source!=="b2b"||(isAdmin&&!r.linked_to_store));
                        const identity=(r._source==="b2b"?"b2b:":"dukkan:")+
                          (r._source==="b2b"?String(r._b2bId):String(r.id));
                        return <div className="flex flex-col items-start gap-1.5">
                          {r._source==="b2b"?<span className="text-[10px] font-semibold text-sky-700">B2B Kataloğu</span>:null}
                          {allowed?
                            <button type="button" role="switch" aria-checked={published}
                              aria-label={String(r.name)+" B2B yayını "+(published?"açık":"kapalı")}
                              title={published?"B2B'de yayından kaldır":"B2B'de yayınla"}
                              disabled={busy||Boolean(publishingId)||editingLoading}
                              onClick={event=>{event.stopPropagation();void togglePublication(r);}}
                              className={"inline-flex min-h-9 items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold transition disabled:opacity-50 "+
                                (published?"border-emerald-200 bg-emerald-50 text-emerald-800":"border-slate-200 bg-slate-100 text-slate-600")}>
                              <span className={"relative h-[19px] w-[35px] shrink-0 rounded-full transition-colors "+
                                (published?"bg-emerald-500":"bg-slate-400")}>
                                <span className={"absolute top-[3px] h-[13px] w-[13px] rounded-full bg-white shadow transition-[left] "+
                                  (published?"left-[19px]":"left-[3px]")}/>
                              </span>
                              {publishingId===identity?"Kaydediliyor":published?"Yayında":"Yayında Değil"}
                            </button>:
                            <span className={"rounded-lg px-2.5 py-1.5 text-xs font-bold "+
                              (published?"bg-emerald-100 text-emerald-800":"bg-slate-100 text-slate-600")}>
                              {published?"Yayında":"Yayında Değil"}
                            </span>}
                          {r._source==="b2b"&&r.linked_to_store?
                            <span className="text-[10px] text-amber-700">Başka mağazaya bağlı</span>:null}
                        </div>;
                      })()}
                    </td>
                  </>:(
                    isCariSection?[r.source_cari_no||"—",r.account_code||"—",r.name,r.city||"—",r.type==="both"?"Müşteri / Tedarikçi":r.type==="supplier"?"Tedarikçi":"Müşteri",r.phone||"—",r.balance==null?"—":(Number(r.balance)<0?"Alacak ":Number(r.balance)>0?"Borç ":"Bakiye ")+currency(Math.abs(Number(r.balance)))]:
                    ["sales","purchases","overview"].includes(section)?[r.invoice_no,r.party_name,typeLabel[r.kind]||r.kind,currency(r.grand_total),r.issued_at?.slice(0,10)]:
                    section==="orders"?[r.order_no,r.party_name,typeLabel[r.kind]||r.kind,r.status]:
                    section==="instruments"?[r.document_no,r.party_name,(r.kind==="cheque"?"Çek":"Senet")+" · "+(typeLabel[r.direction]||""),currency(r.amount),r.due_date?.slice(0,10),typeLabel[r.status]||r.status]:
                    section==="banks"?[String(r.created_at).slice(0,10),r.bank_name,r.type,currency(r.amount)]:
                    [String(r.created_at).slice(0,10),r.party_name,currency(r.debit),currency(r.credit),r.description]
                  ).map((v,i)=><td key={i} className="whitespace-nowrap px-4 py-3.5">{fmt(v)}</td>)}
                  {(section==="sales"||section==="purchases")&&<td className="px-3 py-3">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" disabled={pdfBusyId!==null} onClick={()=>void exportPdf(r)}
                        title="Belgenin kaydedilmiş şablonla PDF çıktısını indir" aria-label={"PDF indir: "+r.invoice_no}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-xs font-bold text-sky-800 hover:bg-sky-100 disabled:opacity-40">
                        <Download size={15}/>{pdfBusyId===String(r.id)?"Hazırlanıyor...":"PDF İndir"}
                      </button>
                      <button type="button" disabled={pdfBusyId!==null} onClick={()=>void exportPdf(r,true)}
                        title="Kaydedilmiş form şablonuyla yazdır" aria-label={"Yazdır: "+r.invoice_no}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-[#235780] hover:bg-slate-50 disabled:opacity-40">
                        <FileText size={15}/> Yazdır
                      </button>
                    </div>
                  </td>}
                  {section==="products"&&canManage&&<td className="px-3 py-3">
                    <button type="button" className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-semibold hover:bg-slate-100"
                      onClick={()=>editProduct(r)}>Düzenle</button>
                  </td>}
                  {isCariSection&&isWriter&&canAccount&&<td className="sticky right-0 z-[1] bg-white/95 px-3 py-2 text-right transition-colors group-hover:bg-[#f7faff]">
                    <button type="button" aria-label={String(r.name)+" cari işlemlerini aç"}
                      onClick={event=>{event.stopPropagation();setSelectedCariAction(r);}}
                      className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-xl bg-[#122a51] px-3 py-2 text-xs font-bold text-white shadow-sm transition-all duration-300 ease-out hover:bg-[#1c4f8b] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-400 md:translate-x-2 md:opacity-0 md:group-hover:translate-x-0 md:group-hover:opacity-100 md:group-focus-within:translate-x-0 md:group-focus-within:opacity-100">
                      İşlem Yap <ChevronRight size={14}/>
                    </button>
                  </td>}
                  {section==="instruments"&&<td className="px-3 py-3">{r.status==="pending"&&isWriter?<select className="rounded-md border p-1 text-xs" defaultValue="" onChange={e=>void updateInstrument(r,e.target.value)}><option value="" disabled>Durum değiştir</option><option value="settled">Tahsil/Ödendi</option><option value="bounced">Karşılıksız</option><option value="cancelled">İptal</option></select>:null}</td>}
                </tr>)}</tbody>
              </table>
              {tableRows.length===0&&<div className="py-10 text-center text-sm text-slate-500">
                {section==="products"&&rows.length>0?
                  <>Filtrelerle eşleşen ürün bulunamadı.
                    <button type="button" onClick={()=>setProductToolbar({...DEFAULT_PRODUCT_TOOLBAR})}
                      className="ml-2 font-semibold text-[#17649f] underline">Filtreleri Temizle</button>
                  </>:"Henüz kayıt bulunmuyor."}
              </div>}
            </div>}
          </div>}
          <p className="mt-5 text-center text-xs leading-5 text-slate-500">Çalışkan Dükkan · Merkezi kayıtlar · PDF satış belgesi GİB e-Fatura veya e-Arşiv yerine geçmez.</p>
          </DukkanWorkspaceLayout>
          {selectedCariAction&&isWriter&&canAccount&&(
            <DukkanCariActionsDrawer key={storeId+":"+String(selectedCariAction.id)}
              storeId={storeId} party={selectedCariAction} banks={banks}
              canDelete={isManager}
              onClose={()=>setSelectedCariAction(null)}
              onUpdated={()=>setRefresh(n=>n+1)}
              onDeleted={()=>{setSelectedCariAction(null);setNotice("Cari hesap silindi.");setRefresh(n=>n+1);}}/>
          )}
        </>}
      </div>
    </div>
  );
}
