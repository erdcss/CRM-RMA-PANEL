import type { AdminOrder, B2BProduct, DashboardOverview, SupportItem } from "../types";

/**
 * Isolated sample records for the real Business screens. These objects contain
 * no actual company/client data. The API gateway must never forward a
 * business_reviewer request (read or write) to a privileged backend endpoint.
 */
const orders: AdminOrder[] = [
  {
    id: "900001", order_number: "DEMO-2026-001", customer_name: "Örnek Bayi A",
    customer_email: "bayi-a@example.com", created_at: "2026-10-15T08:30:00.000Z",
    status: "approved", payment_method: "card", payment_status: "paid",
    total_amount: 2450, item_count: 2,
    billing_details: {companyName:"Örnek Bayi A"},
    shipping_address: {city:"İstanbul",district:"Başakşehir",addressLine:"Örnek adres"},
    items:[{id:"demo-101",name:"Örnek Çay Makinesi",sku:"DEMO-101",quantity:1,price:2450,total:2450}],
  },
  {
    id: "900002", order_number: "DEMO-2026-002", customer_name: "Örnek Bayi B",
    customer_email: "bayi-b@example.com", created_at: "2026-10-14T10:30:00.000Z",
    status: "approved",payment_method:"bank_transfer",payment_status:"bank_confirmed",
    total_amount:1180,item_count:1,
    billing_details:{companyName:"Örnek Bayi B"},
    shipping_address:{city:"Ankara",district:"Çankaya",addressLine:"Örnek adres"},
    items:[{id:"demo-102",name:"Örnek Çelik Cezve",sku:"DEMO-102",quantity:2,price:590,total:1180}],
  },
];

const products: B2BProduct[] = [
  {id:"demo-101",sku:"DEMO-101",name:"Örnek Çay Makinesi",brand:"Örnek Marka",
    category:"Elektronik",price:2450,stock:24,units_per_box:4,min_order_qty:1,is_active:true},
  {id:"demo-102",sku:"DEMO-102",name:"Örnek Çelik Cezve",brand:"Örnek Marka",
    category:"Elektronik",price:590,stock:6,units_per_box:12,min_order_qty:1,is_active:true},
  {id:"demo-103",sku:"DEMO-103",name:"Örnek Elektrikli Ev Aleti",brand:"Örnek Marka",
    category:"Elektronik",price:1350,stock:18,units_per_box:6,min_order_qty:1,is_active:true},
];

const customers = [
  {id:990001,username:"bayi-a@example.com",email:"bayi-a@example.com",
    companyName:"Örnek Bayi A",firstName:"Örnek",lastName:"Müşteri",
    companyCategory:"Toptan Ticaret",taxNumber:null,taxOffice:null,
    taxVerified:false,applicationStatus:"approved",mustChangePassword:false,isActive:true,
    createdAt:"2026-10-10T10:00:00.000Z",approvedAt:"2026-10-11T10:00:00.000Z"},
  {id:990002,username:"bayi-b@example.com",email:"bayi-b@example.com",
    companyName:"Örnek Bayi B",firstName:"Örnek",lastName:"Müşteri",
    companyCategory:"Market & Perakende",taxNumber:null,taxOffice:null,
    taxVerified:false,applicationStatus:"approved",mustChangePassword:false,isActive:true,
    createdAt:"2026-10-11T10:00:00.000Z",approvedAt:"2026-10-12T10:00:00.000Z"},
];

const dashboard:DashboardOverview = {
  sessionUsers:3,liveUsers:1,conversionRate:25,orderCount:orders.length,
  activeReturns:0,openSupport:1,lowStock:1,todayRevenue:3630,
  recentOrders:orders,recentApprovedOrders:orders,recentReturns:[],
};

const support: SupportItem[] = [
  {id:"demo-s1",subject:"Teslimat bilgisi",message:"Örnek müşteri destek talebi.",
    customer_name:"Örnek Bayi A",status:"open",created_at:"2026-10-15T12:00:00.000Z"},
];

export function getBusinessReviewFixture(path:string):unknown {
  // Never construct fixture data from live API responses or remote input.
  const route=path.split("?")[0];
  if(route==="/api/admin/dashboard-overview")return dashboard;
  if(route==="/api/admin/orders")return orders;
  if(route==="/api/admin/b2b-products")return products;
  if(route==="/api/admin/b2b-applications"||route==="/api/admin/b2b-customers")return customers;
  if(route==="/api/admin/b2b-support")return support;
  if(route==="/api/admin/returns")return [];
  if(/^\/api\/admin\/orders\/\d+$/.test(route)) {
    const match=orders.find(order=>String(order.id)===route.split("/").pop());
    if(!match)throw new Error("Örnek sipariş bulunamadı");
    return match;
  }
  const customerMatch=/^\/api\/admin\/b2b-customer-center\/(\d+)(?:\/(activity|insights))?$/.exec(route);
  if(customerMatch){
    const customer=customers.find(item=>String(item.id)===customerMatch[1]);
    if(!customer)throw new Error("Örnek firma bulunamadı");
    if(customerMatch[2]==="activity")return {rows:[],page:1,total:0,hasMore:false};
    if(customerMatch[2]==="insights")return {
      periodDays:30,summary:{product_views:2,active_days:1,sessions:1,web_sessions:1,
        mobile_sessions:0,seconds:125,last_seen:"2026-10-15T08:00:00.000Z"},
      products:[],daily:[],recent:[],
      note:"Bu veriler yalnızca inceleme amaçlı temsilî kayıtlardır.",
    };
    return {customer,stats:{orderCount:1,orderTotal:2450,paidTotal:2450,
      awaitingPayment:0,returnCount:0,invoiceCount:0,invoiceTotal:0,
      supportCount:0,openSupport:0,addressCount:0,ledgerEntryCount:0},
      orders:[],returns:[],invoices:[],support:[],addresses:[],ledger:[],listLimit:25};
  }
  const moduleLists=new Set([
    "/api/admin/users","/api/admin/reels","/api/tickets","/api/customers",
    "/api/warehouses","/api/suppliers","/api/invoices",
  ]);
  if(moduleLists.has(route))return [];
  if(route==="/api/stats")return {total:0,open:0,completed:0};
  if(route==="/api/admin/payment-settings")return {};
  if(route==="/api/admin/homepage")return {};
  if(route==="/api/admin/branding")return {};
  throw new Error("Bu bölümde örnek veri bulunmuyor. İnceleme hesabı gerçek işletme kayıtlarına erişemez.");
}
