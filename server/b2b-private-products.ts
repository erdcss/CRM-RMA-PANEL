import {pool} from "./db";

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
export function parseAssignedCustomerId(raw:unknown):{ok:true;id:number|null}|{ok:false}{
  if(raw===null||raw===undefined||raw==="")return {ok:true,id:null};
  if(typeof raw!=="number"&&typeof raw!=="string")return {ok:false};
  if(!/^[1-9][0-9]{0,9}$/.test(String(raw)))return {ok:false};
  const value=Number(raw);
  return Number.isSafeInteger(value)&&value>0&&value<=2147483647?{ok:true,id:value}:{ok:false};
}
export async function approvedCustomerExists(id:number):Promise<boolean>{
  if(!pool)return false;
  const result=await pool.query("SELECT 1 FROM users WHERE id=$1 AND role='b2b_customer' AND is_active=1 AND application_status='approved' LIMIT 1",[id]);
  return Boolean(result.rowCount);
}
export function canReadProductForCustomer(assignedId:number|null,viewerId:number|null):boolean{
  return assignedId===null||(viewerId!==null&&assignedId===viewerId);
}
