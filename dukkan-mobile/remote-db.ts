import * as Crypto from "expo-crypto";
import type {Collection,Form,RecordRow} from "./local-db";

const API="https://admin.ecalisgan.com";
export type StoreInfo={id:number;name:string;role:string};
export type LoginResult={token:string;stores:StoreInfo[];user:{id:number;username:string}};
let bearer="",currentStore:StoreInfo|undefined;
const num=(v:unknown)=>Number(v||0);
const cents=(v:unknown)=>Math.round(num(v)*100);
const mill=(v:unknown)=>Math.round(num(v)*1000);
const row=(v:any)=>v as RecordRow;
const path=()=>{if(!currentStore)throw Error("Önce mağaza hesabına giriş yapın");return "/api/dukkan/stores/"+currentStore.id;};

async function request<T=any>(endpoint:string,method="GET",body?:unknown,token=bearer):Promise<T>{
 const response=await fetch(API+endpoint,{
  method,headers:{"Content-Type":"application/json",...(token?{Authorization:"Bearer "+token}:{})},
  body:body===undefined?undefined:JSON.stringify(body)
 });
 const value=await response.json().catch(()=>({}));
 if(!response.ok)throw Error(value.error||"Sunucu işlemi tamamlayamadı ("+response.status+")");
 return value as T;
}
export async function login(username:string,password:string):Promise<LoginResult>{
 const result=await request<LoginResult>("/api/dukkan/login","POST",{username:username.trim(),password},"");
 if(!result.token||!Array.isArray(result.stores)||!result.stores.length)throw Error("Mağazaya yetkili hesap bulunamadı");
 return result;
}
export async function availableStores(token:string){return request<StoreInfo[]>("/api/dukkan/stores","GET",undefined,token);}
export async function uploadedLogoUrl(){const v=await request<{dukkan_logo?:string|null}>("/api/public/branding");return v.dukkan_logo&&v.dukkan_logo.startsWith("/api/public/branding-asset/dukkan_logo?")?API+v.dukkan_logo:null;}
export function setStoreSession(token:string,store?:StoreInfo){bearer=token;currentStore=store;}
export function clearStoreSession(){bearer="";currentStore=undefined;}
export function activeStore(){return currentStore;}

const RESOURCES:Partial<Record<Collection,string>>={
 products:"products",parties:"parties",invoices:"invoices",movements:"stock-movements",ledger:"cari-movements",
 banks:"banks",bank_movements:"bank-movements",payments:"payments",instruments:"instruments",orders:"orders"
};
export async function list(kind:Collection):Promise<RecordRow[]>{
 const resource=RESOURCES[kind];
 if(!resource)throw Error("Bu modül merkezi Dükkan sisteminde henüz etkin değil: "+kind);
 const entries=await request<any[]>(path()+"/data/"+resource);
 return entries.map(e=>{
  switch(kind){
   case "products":return row({...e,code:e.sku,stock_milli:mill(e.stock),purchase_cents:cents(e.purchase_price),sale_cents:cents(e.sale_price)});
   case "parties":return row({...e,kind:e.type,balance:cents(e.balance)});
   case "invoices":return row({...e,number:e.invoice_no,date:String(e.issued_at||"").slice(0,10),total_cents:cents(e.grand_total)});
   case "movements":return row({...e,delta_milli:mill(e.delta)});
   case "ledger":return row({...e,amount_cents:cents(num(e.debit)-num(e.credit)),description:e.description});
   case "banks":return row({...e,balance:cents(e.balance)});
   case "bank_movements":return row({...e,amount_cents:cents(e.amount),description:e.note});
   case "payments":return row({...e,kind:e.direction,amount_cents:cents(e.amount)});
   case "instruments":return row({...e,kind:e.kind==="promissory"?"note":e.kind,number:e.document_no,
     due_date:e.due_date,amount_cents:cents(e.amount),status:e.status==="settled"?"collected":e.status});
   case "orders":return row({...e,number:e.order_no});
   default:return row(e);
  }
 });
}
export async function summary(){
 const r=await request<any>(path()+"/report");
 return {sales:cents(r.sales),purchases:cents(r.purchases),stockCost:cents(r.stock?.stock_cost),
  receivables:0,payables:0,cash:0,bank:cents(r.bankBalance),products:num(r.stock?.product_count),
  documents:(await list("invoices")).length,overdue:num(r.overdue?.count)};
}
export async function report(){
 const invoices=await list("invoices");
 const perMonth=new Map<string,{month:string;sales:number;purchases:number}>();
 for(const r of invoices){
  const month=String(r.date||"").slice(0,7);
  if(!/^\d{4}-\d{2}$/.test(month))continue;
  const item=perMonth.get(month)||{month,sales:0,purchases:0};
  if(r.kind==="sale")item.sales+=num(r.total_cents);
  if(r.kind==="sale_return")item.sales-=num(r.total_cents);
  if(r.kind==="purchase")item.purchases+=num(r.total_cents);
  if(r.kind==="purchase_return")item.purchases-=num(r.total_cents);
  perMonth.set(month,item);
 }
 return {monthly:Array.from(perMonth.values()).sort((a,b)=>b.month.localeCompare(a.month)).slice(0,24)};
}
export type SalesDocument={
 invoice:{id:number;invoice_no:string;kind:"sale"|"sale_return";issued_at:string;party_name:string;party_tax_number?:string|null;party_phone?:string|null;store_name:string;subtotal:string|number;tax_total:string|number;grand_total:string|number};
 lines:Array<{id:number;quantity:string|number;unit_price:string|number;tax_rate:string|number;line_total:string|number;sku:string;product_name:string;unit:string}>;
 disclaimer:string;officialInvoice:false;
};
export async function getSaleDocument(id:number):Promise<SalesDocument>{
 return request<SalesDocument>(path()+"/invoices/"+id+"/pdf-data");
}
export async function settings(){return {company:currentStore?.name||"Çalışkan Dükkan"};}
type InputLine={productId:string|number;qty:string|number;price:string|number;vat:string|number};
const lines=(v:InputLine[],isOrder=false)=>v.map(l=>({
 productId:Number(l.productId),quantity:Number(l.qty),unitPrice:Number(l.price),taxRate:isOrder?0:Number(l.vat)
}));
export async function add(kind:string,f:Form):Promise<any>{
 switch(kind){
  case "party":return request(path()+"/parties","POST",{name:f.name,type:f.kind||"customer",taxNumber:f.tax||"",phone:f.phone||"",email:f.email||""});
  case "product":return request(path()+"/products","POST",{name:f.name,sku:f.code,barcode:f.barcode||"",unit:f.unit||"adet",purchasePrice:Number(f.purchase),salePrice:Number(f.sale)});
  case "productEdit":return request(path()+"/products/"+Number(f.id),"PATCH",{name:f.name,sku:f.code,barcode:f.barcode||"",unit:f.unit||"adet",purchasePrice:Number(f.purchase),salePrice:Number(f.sale)});
  case "stock":return request(path()+"/stock-movements","POST",{productId:Number(f.productId),delta:Number(f.qty)*(f.direction==="decrease"?-1:1),note:f.notes||""});
  case "invoice":return request(path()+"/invoices","POST",{partyId:Number(f.partyId),kind:f.kind,date:f.date,requestKey:Crypto.randomUUID(),lines:lines(f.lines)});
  case "order":return request(path()+"/orders","POST",{partyId:Number(f.partyId),kind:f.kind,number:f.number,lines:lines(f.lines,true)});
  case "bank":return request(path()+"/banks","POST",{name:f.name,iban:f.iban||""});
  case "bankMovement":return request(path()+"/bank-movements","POST",{bankId:Number(f.bankId),type:f.direction==="out"?"withdrawal":"deposit",amount:Number(f.amount),note:f.notes||""});
  case "payment":return request(path()+"/payments","POST",{partyId:Number(f.partyId),direction:f.kind,method:f.method,bankId:f.method==="bank"?Number(f.bankId):undefined,amount:Number(f.amount),note:f.notes||""});
  case "instrument":return request(path()+"/instruments","POST",{partyId:Number(f.partyId),kind:f.kind==="note"?"promissory":f.kind,direction:f.direction,number:f.number,amount:Number(f.amount),dueDate:f.dueDate,note:f.notes||""});
  default:throw Error("Bu işlem bağlantılı Dükkan sürümünde kullanılamıyor.");
 }
}
export async function setStatus(kind:"order"|"instrument",id:number,status:string){
 if(kind!=="instrument")throw Error("Sipariş durum yönetimi henüz etkin değil.");
 return request(path()+"/instruments/"+id,"PATCH",{status:status==="collected"?"settled":status});
}
