import { getBusinessReviewFixture } from "./review-fixtures";

function check(condition: unknown, message: string) {
  if (!condition) throw new Error("Apple reviewer test failed: " + message);
}
const overview = getBusinessReviewFixture("/api/admin/dashboard-overview") as {
  orderCount:number; recentOrders:unknown[];
};
check(overview.orderCount===2, "demo dashboard metrics");
check(Array.isArray(overview.recentOrders), "real dashboard data shape");

const orders=getBusinessReviewFixture("/api/admin/orders") as {id:string;order_number:string}[];
const products=getBusinessReviewFixture("/api/admin/b2b-products") as {id:string;name:string}[];
check(orders.length>=2, "orders loaded in production OrdersScreen");
check(products.length>=2, "products loaded in production ProductsScreen");
const detail=getBusinessReviewFixture("/api/admin/orders/"+orders[0].id) as {id:string};
check(detail.id===orders[0].id, "detail available through real OrderDetailScreen");
const product=getBusinessReviewFixture("/api/admin/b2b-products/"+products[0].id) as {id:string};
check(product.id===products[0].id, "product detail available");
check(orders.every(o=>o.order_number.startsWith("DEMO-")), "only sample orders are used");

const customers=getBusinessReviewFixture("/api/admin/b2b-applications") as {id:number;companyName:string}[];
check(customers.length>0 && customers[0].companyName.startsWith("Örnek "), "customer list is synthetic");
let rejected=false;
try {getBusinessReviewFixture("/api/admin/secret");}
catch {rejected=true;}
check(rejected, "unsupported real APIs must not be reached");

console.log("Business reviewer fixture tests passed");
