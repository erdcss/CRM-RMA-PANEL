import { apiFetch } from "./api";
export type ApplicationStatus = "pending" | "approved" | "rejected";
export type B2BApplication = {
  id:number; username:string; email?:string|null; companyName?:string|null;
  firstName?:string|null;lastName?:string|null;companyCategory?:string|null;
  taxNumber?:string|null;taxOffice?:string|null; taxVerified:boolean;
  applicationStatus?:ApplicationStatus|string|null; mustChangePassword:boolean;
  isActive:boolean;createdAt?:string|null;approvedAt?:string|null;credentialsSentAt?:string|null;
};
export type B2BStats = {
  orderCount:number;orderTotal:number;paidTotal:number;awaitingPayment:number;
  returnCount:number;invoiceCount:number;invoiceTotal:number;supportCount:number;
  openSupport:number;addressCount:number;ledgerEntryCount:number;
};
export type CenterRecord = {
  id:string;order_number?:string|null;status?:string|null;payment_status?:string|null;
  payment_method?:string|null;shipping_method?:string|null;item_count?:number|null;
  total_amount?:number|string|null;invoice_number?:string|null;reason?:string|null;
  subject?:string|null;title?:string|null;address_line?:string|null;
  recipient?:string|null;phone?:string|null;city?:string|null;district?:string|null;
  postal_code?:string|null;is_default?:boolean|null;contact_name?:string|null;
  type?:string|null;description?:string|null;amount_cents?:string|null;
  voided_at?:string|null;created_at?:string|null;
};
export type CenterDetail = {
  customer:B2BApplication;stats:B2BStats;orders:CenterRecord[];
  returns:CenterRecord[];invoices:CenterRecord[];support:CenterRecord[];
  addresses:CenterRecord[];ledger:CenterRecord[];listLimit?:number;
};
export type ActivityRecord = {
  id:string;type:string;title:string;detail?:string|null;amount?:number|string|null;
  status?:string|null;happened_at?:string|null;
};
export type ActivityPage = {rows:ActivityRecord[];page:number;total:number;hasMore:boolean;};
export const getApplications = () => apiFetch<B2BApplication[]>("/api/admin/b2b-applications");
export const getCustomers = () => apiFetch<B2BApplication[]>("/api/admin/b2b-customers");
// Applications remain the canonical source where both old and newly approved
// accounts have the same field shape. No guessing profile fields from emails.
export const getApprovedApplications=async()=> (await getApplications()).filter(
  item=>item.applicationStatus==="approved"&&item.isActive===true);
export const getCenter = (id:string) =>
  apiFetch<CenterDetail>("/api/admin/b2b-customer-center/"+encodeURIComponent(id));
export const getTimeline = (id:string,page:number) =>
  apiFetch<ActivityPage>("/api/admin/b2b-customer-center/"+encodeURIComponent(id)+
    "/activity?page="+encodeURIComponent(String(page)));
export const changeApplication = (id:string,action:"approve"|"reject"|"resend-password") =>
  apiFetch<{message?:string}>("/api/admin/b2b-applications/"+encodeURIComponent(id)+"/"+action,{method:"POST"});
export const statusName=(s?:string|null)=>({
  pending:"Onay bekliyor",approved:"Onaylandı",rejected:"Reddedildi",
  SUCCESS:"Ödeme alındı",bank_confirmed:"Havale onaylandı",paid:"Ödendi",
  FAILURE:"Başarısız",open:"Açık",issued:"Kesildi",voided:"İptal edildi",
  customer_reported_paid:"Ödeme bildirildi",awaiting_bank_confirmation:"Havale kontrolü"
} as Record<string,string>)[String(s||"")]||String(s||"Belirtilmedi");
export const fullName=(c:B2BApplication)=>[c.firstName,c.lastName].filter(Boolean).join(" ")||"Yetkili belirtilmedi";
export const moneyTR=(v:unknown)=>Number(v||0).toLocaleString("tr-TR",{style:"currency",currency:"TRY"});
export const formatDate=(v?:string|null)=>{
  if(!v)return "—";const d=new Date(v);
  return Number.isNaN(d.getTime())?"—":d.toLocaleString("tr-TR",{dateStyle:"short",timeStyle:"short"});
};
