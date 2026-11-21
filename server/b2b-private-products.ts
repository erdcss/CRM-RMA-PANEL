import {pool} from "./db";
export {parseAssignedCustomerId,canReadProductForCustomer} from "../shared/b2b-private-product-policy";

// Public products have no recipient. A private product always has exactly one
// approved customer recipient; never downgrade a deleted recipient to public.
let schemaReady:Promise<void>|null=null;
export function ensurePrivateProductSchema():Promise<void>{
  if(!pool)return Promise.reject(new Error("Veritabanı bağlantısı yok"));
  if(!schemaReady){
    schemaReady=(async()=>{
      await pool.query("ALTER TABLE b2b_products ADD COLUMN IF NOT EXISTS assigned_customer_id INTEGER REFERENCES users(id) ON DELETE CASCADE");
      await pool.query("CREATE INDEX IF NOT EXISTS b2b_products_assigned_customer_idx ON b2b_products(assigned_customer_id) WHERE assigned_customer_id IS NOT NULL");
    })().catch(error=>{schemaReady=null;throw error});
  }
  return schemaReady;
}
export async function approvedCustomerExists(id:number):Promise<boolean>{
  if(!pool)return false;
  const result=await pool.query("SELECT 1 FROM users WHERE id=$1 AND role='b2b_customer' AND is_active=1 AND application_status='approved' LIMIT 1",[id]);
  return Boolean(result.rowCount);
}
