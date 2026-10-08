export type MainTab = "dashboard" | "orders" | "products" | "customers" | "more";

export type Screen =
  | { name: "login" }
  | { name: "dashboard" }
  | { name: "orders" }
  | { name: "orderDetail"; id: string }
  | { name: "products" }
  | { name: "customers" }
  | { name: "customerDetail"; id: string }
  | { name: "support" }
  | { name: "more" }
  | { name: "module"; slug: string };

export type AdminOrder = {
  id: string | number;
  order_number?: string | null;
  customer_email?: string | null;
  customer_name?: string | null;
  status?: string | null;
  item_count?: number | null;
  total_amount?: string | number | null;
  payment_method?: string | null;
  payment_provider?: string | null;
  payment_status?: string | null;
  card_last4?: string | null;
  card_association?: string | null;
  shipping_method?: string | null;
  shipping_details?: Record<string, any> | null;
  billing_details?: Record<string, any> | null;
  shipping_address?: Record<string, any> | null;
  items?: Array<Record<string, any>>;
  cancel_requested_at?: string | null;
  created_at?: string | null;
  checkout_trace?: Record<string, any> | null;
  transfer_code?: string | null;
};

export type DashboardOverview = {
  sessionUsers: number;
  liveUsers: number;
  conversionRate: number;
  orderCount: number;
  activeReturns: number;
  openSupport?: number;
  lowStock?: number;
  todayRevenue?: number;
  recentOrders?: AdminOrder[];
  recentReturns?: Array<{
    id: string | number;
    name?: string | null;
    brand?: string | null;
    customer_name?: string | null;
    status?: string | null;
  }>;
};

export type B2BCustomer = {
  id: string | number;
  company_name?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  contact_name?: string | null;
  email?: string | null;
  phone?: string | null;
  city?: string | null;
  district?: string | null;
  address_line?: string | null;
  postal_code?: string | null;
  tax_number?: string | null;
  tax_office?: string | null;
  is_active?: number | boolean | null;
  application_status?: string | null;
  segment?: "aktif" | "riskli" | "yeni" | "vip" | string;
  total_orders?: number | null;
  total_revenue?: string | number | null;
  current_balance?: string | number | null;
  credit_limit?: string | number | null;
  last_order_at?: string | null;
  created_at?: string | null;
  addresses?: Array<Record<string, any>>;
  orders?: AdminOrder[];
};

export type B2BProduct = {
  id: string | number;
  sku?: string | null;
  name?: string | null;
  brand?: string | null;
  category?: string | null;
  price?: string | number | null;
  stock?: number | null;
  units_per_box?: number | null;
  min_order_qty?: number | null;
  image_data?: string | null;
  images?: string[];
  barcode?: string | null;
  is_active?: boolean | null;
};

export type SupportItem = {
  id: string | number;
  title?: string | null;
  subject?: string | null;
  message?: string | null;
  code?: string | null;
  customer_name?: string | null;
  customer_email?: string | null;
  status?: string | null;
  created_at?: string | null;
};
