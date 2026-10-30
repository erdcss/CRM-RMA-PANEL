import type {Express,RequestHandler} from "express";
import {storage} from "./storage";
import {pool} from "./db";

const eligible=(u:any)=>u?.role==="b2b_customer" && u.companyName!=="Çalışkan B2B - Apple İnceleme"
  && ["pending","approved","rejected"].includes(String(u.applicationStatus));
const safe=(u:any)=>({
  id:u.id,username:u.username,email:u.email,phone:u.phone,companyName:u.companyName,
  firstName:u.firstName,lastName:u.lastName,companyCategory:u.companyCategory,
  taxNumber:u.taxNumber,taxOffice:u.taxOffice,taxVerified:u.taxVerified===1,
  applicationStatus:u.applicationStatus,isActive:u.isActive===1,
  mustChangePassword:u.mustChangePassword===1,createdAt:u.createdAt,
  approvedAt:u.approvedAt,credentialsSentAt:u.credentialsSentAt,
});
const validId=(raw:unknown)=>{
  const v=String(raw||"");
  return /^[1-9]\d{0,9}$/.test(v)&&Number.isSafeInteger(Number(v))?Number(v):null;
};
function fail(res:any,error:unknown){
  console.error("[b2b-admin-customer-center]",error);
  return res.status(500).json({error:"B2B müşteri verileri alınamadı."});
}
const noStore=(res:any)=>res.setHeader("Cache-Control","private, no-store");

export function registerB2BAdminCustomerCenter(app:Express,requireAdmin:RequestHandler) {
  app.get("/api/admin/b2b-customers",requireAdmin,async(_req,res)=>{
    noStore(res);
    try {
      const users=await storage.listUsers();
      return res.json(users.filter(u=>eligible(u)&&u.applicationStatus==="approved"&&u.isActive===1).map(safe));
    }catch(error){return fail(res,error);}
  });

  // Manual tax verification is an authenticated administrator action, never a public
  // taxpayer-service response. Record the actor and previous values for accountability.
  app.patch("/api/admin/b2b-customer-center/:id/tax",requireAdmin,async(req,res)=>{
    noStore(res);
    const id=validId(req.params.id);
    if(!id)return res.status(400).json({error:"Geçersiz firma numarası."});
    const taxOffice=typeof req.body?.taxOffice==="string" ? req.body.taxOffice.trim().slice(0,180) : "";
    const verified=req.body?.taxVerified;
    const note=typeof req.body?.note==="string" ? req.body.note.trim().slice(0,500) : "";
    if(typeof verified!=="boolean" || (verified && taxOffice.length<2)){
      return res.status(400).json({error:"Vergi dairesi ve manuel teyit durumunu kontrol edin."});
    }
    const actor=Number((req.session as {userId?:number})?.userId || 0);
    if(!actor)return res.status(401).json({error:"Yönetici oturumu gerekiyor."});
    if(!pool)return res.status(503).json({error:"Veritabanı erişilemiyor."});
    const transaction=await pool.connect();
    try {
      await transaction.query("BEGIN");
      const existing=await transaction.query(
        "SELECT id,role,tax_office,tax_verified FROM users WHERE id=$1 FOR UPDATE",[id],
      );
      if(existing.rows[0]?.role!=="b2b_customer"){
        await transaction.query("ROLLBACK");
        return res.status(404).json({error:"B2B firması bulunamadı."});
      }
      await transaction.query(
        "CREATE TABLE IF NOT EXISTS b2b_tax_verification_audit ("+
        "id BIGSERIAL PRIMARY KEY,customer_id INTEGER NOT NULL,admin_id INTEGER NOT NULL,"+
        "old_tax_office TEXT,new_tax_office TEXT,old_verified BOOLEAN NOT NULL,"+
        "new_verified BOOLEAN NOT NULL,note TEXT,created_at TIMESTAMPTZ DEFAULT NOW())",
      );
      await transaction.query("UPDATE users SET tax_office=$2,tax_verified=$3 WHERE id=$1",
        [id,taxOffice||null,verified?1:0]);
      await transaction.query(
        "INSERT INTO b2b_tax_verification_audit "+
        "(customer_id,admin_id,old_tax_office,new_tax_office,old_verified,new_verified,note) "+
        "VALUES($1,$2,$3,$4,$5,$6,$7)",
        [id,actor,existing.rows[0].tax_office,taxOffice||null,existing.rows[0].tax_verified===1,verified,note||null],
      );
      await transaction.query("COMMIT");
      return res.json({ok:true,taxOffice:taxOffice||null,taxVerified:verified,
        verificationMethod:verified?"manual":"unverified"});
    }catch(error){
      await transaction.query("ROLLBACK").catch(()=>{});
      return fail(res,error);
    }finally{transaction.release();}
  });

  app.get("/api/admin/b2b-customer-center/:id",requireAdmin,async(req,res)=>{
    noStore(res);
    const id=validId(req.params.id);
    if(!id)return res.status(400).json({error:"Geçersiz firma numarası."});
    try {
      const user=await storage.getUser(id);
      if(!eligible(user))return res.status(404).json({error:"B2B firması bulunamadı."});
      const customer=safe(user);
      const empty={orderCount:0,orderTotal:0,paidTotal:0,awaitingPayment:0,
        returnCount:0,invoiceCount:0,invoiceTotal:0,supportCount:0,openSupport:0,
        addressCount:0,ledgerEntryCount:0};
      if(customer.applicationStatus!=="approved"||!pool) {
        return res.json({customer,stats:empty,orders:[],returns:[],invoices:[],support:[],addresses:[],ledger:[]});
      }
      const email=String(user!.email||user!.username||"").toLowerCase();
      // Legacy orders without a user_id can still be matched by their original email.
      const ordersQuery=`FROM b2b_orders o WHERE (o.user_id=$1 OR
         (o.user_id IS NULL AND LOWER(COALESCE(o.customer_email,''))=$2))
         AND COALESCE(o.status,'') <> 'payment_failed'
         AND COALESCE(o.payment_status,'') NOT IN ('FAILURE','initialize_failed')
         AND COALESCE(o.payment_status,'') NOT LIKE '3ds_failed%'`;
      const [s,orders,returns,invoices,support,addresses,misc,reg]=await Promise.all([
        pool.query(`SELECT COUNT(*)::int AS count,
          COALESCE(SUM(o.total_amount),0)::text AS order_total,
          COALESCE(SUM(CASE WHEN o.payment_status IN ('SUCCESS','bank_confirmed')
            THEN o.total_amount ELSE 0 END),0)::text AS paid_total,
          COUNT(*) FILTER (WHERE o.payment_status IS NULL OR
            o.payment_status NOT IN ('SUCCESS','bank_confirmed'))::int AS awaiting_payment
          `+ordersQuery,[id,email]),
        pool.query(`SELECT o.id::text,o.order_number,o.status,o.item_count,o.total_amount::text,
          o.payment_status,o.payment_method,o.shipping_method,o.created_at
          `+ordersQuery+` ORDER BY o.created_at DESC,o.id DESC LIMIT 100`,[id,email]),
        pool.query(`SELECT id::text,order_number,status,reason,created_at FROM b2b_returns
          WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`,[id]),
        pool.query(`SELECT id::text,invoice_number,order_number,total_amount::text,created_at
          FROM b2b_invoices WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`,[id]),
        pool.query(`SELECT id::text,subject,status,created_at FROM b2b_support_tickets
          WHERE user_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`,[id]),
        pool.query(`SELECT id::text,title,recipient,phone,city,district,address_line,postal_code,
          is_default,created_at FROM b2b_addresses
          WHERE user_id=$1 ORDER BY is_default DESC,created_at DESC LIMIT 50`,[id]),
        pool.query(`SELECT
          (SELECT COUNT(*)::int FROM b2b_returns WHERE user_id=$1) AS returns,
          (SELECT COUNT(*)::int FROM b2b_invoices WHERE user_id=$1) AS invoices,
          (SELECT COALESCE(SUM(total_amount),0)::text FROM b2b_invoices WHERE user_id=$1) AS invoice_total,
          (SELECT COUNT(*)::int FROM b2b_support_tickets WHERE user_id=$1) AS support,
          (SELECT COUNT(*)::int FROM b2b_support_tickets WHERE user_id=$1 AND status IN ('open','pending')) AS open_support,
          (SELECT COUNT(*)::int FROM b2b_addresses WHERE user_id=$1) AS addresses`,[id]),
        pool.query("SELECT to_regclass('public.b2b_ledger_entries') IS NOT NULL AS registered"),
      ]);
      let ledger:any[]=[];
      let ledgerEntryCount=0;
      if(reg.rows[0]?.registered){
        const [items,ct]=await Promise.all([
          pool.query(`SELECT e.id::text,e.type,e.amount_cents::text,e.description,
            e.effective_on,e.created_at,e.voided_at,c.name AS contact_name
            FROM b2b_ledger_entries e
            JOIN b2b_ledger_contacts c ON c.id=e.contact_id AND c.user_id=e.user_id
            WHERE e.user_id=$1 ORDER BY e.created_at DESC,e.id DESC LIMIT 100`,[id]),
          pool.query("SELECT COUNT(*)::int AS count FROM b2b_ledger_entries WHERE user_id=$1",[id]),
        ]);
        ledger=items.rows;
        ledgerEntryCount=Number(ct.rows[0]?.count||0);
      }
      const a=s.rows[0]||{},b=misc.rows[0]||{};
      return res.json({customer,stats:{
        orderCount:Number(a.count||0),orderTotal:Number(a.order_total||0),
        paidTotal:Number(a.paid_total||0),awaitingPayment:Number(a.awaiting_payment||0),
        returnCount:Number(b.returns||0),invoiceCount:Number(b.invoices||0),
        invoiceTotal:Number(b.invoice_total||0),supportCount:Number(b.support||0),
        openSupport:Number(b.open_support||0),addressCount:Number(b.addresses||0),
        ledgerEntryCount,
      },orders:orders.rows,returns:returns.rows,invoices:invoices.rows,
        support:support.rows,addresses:addresses.rows,ledger,
        listLimit:100});
    }catch(error){return fail(res,error);}
  });

  // All rows are pageable, unlike the 100-row overview. Payment card data,
  // passwords and private authentication tokens are excluded.
  app.get("/api/admin/b2b-customer-center/:id/activity",requireAdmin,async(req,res)=>{
    noStore(res);
    const id=validId(req.params.id);
    if(!id)return res.status(400).json({error:"Geçersiz firma numarası."});
    const page=Math.max(1,Math.min(10000,Number.parseInt(String(req.query.page||"1"),10)||1));
    try {
      const user=await storage.getUser(id);
      if(!eligible(user))return res.status(404).json({error:"B2B firması bulunamadı."});
      if(!pool||user!.applicationStatus!=="approved")return res.json({rows:[],page,total:0,hasMore:false});
      const email=String(user!.email||user!.username||"").toLowerCase();
      const reg=await pool.query("SELECT to_regclass('public.b2b_ledger_entries') IS NOT NULL AS registered");
      const ledgerSql=reg.rows[0]?.registered ? `
        UNION ALL SELECT e.id::text,'ledger'::text,
          (CASE e.type WHEN 'debt' THEN 'Borç' WHEN 'payment' THEN 'Ödeme'
            WHEN 'receivable' THEN 'Alacak' ELSE 'Tahsilat' END)::text,
          LEFT(COALESCE(c.name,'')||' · '||COALESCE(e.description,''),240),
          (e.amount_cents::numeric/100)::text,
          (CASE WHEN e.voided_at IS NOT NULL THEN 'voided' ELSE e.type END)::text,e.created_at
          FROM b2b_ledger_entries e
          LEFT JOIN b2b_ledger_contacts c ON c.id=e.contact_id AND c.user_id=e.user_id
          WHERE e.user_id=$1` : "";
      const query=`WITH events AS (
        SELECT o.id::text AS id,'order'::text AS type,'Sipariş'::text AS title,
          LEFT(COALESCE(o.order_number,''),240) AS detail,o.total_amount::text AS amount,
          COALESCE(o.payment_status,o.status,'')::text AS status,o.created_at AS happened_at
          FROM b2b_orders o WHERE (o.user_id=$1 OR
            (o.user_id IS NULL AND LOWER(COALESCE(o.customer_email,''))=$2))
        UNION ALL SELECT r.id::text,'return'::text,'İade talebi'::text,
          LEFT(COALESCE(r.order_number,'')||' · '||COALESCE(r.reason,''),240),
          NULL::text,COALESCE(r.status,''),r.created_at
          FROM b2b_returns r WHERE r.user_id=$1
        UNION ALL SELECT i.id::text,'invoice'::text,'Fatura'::text,
          LEFT(COALESCE(i.invoice_number,'')||' · '||COALESCE(i.order_number,''),240),
          i.total_amount::text,'issued'::text,i.created_at
          FROM b2b_invoices i WHERE i.user_id=$1
        UNION ALL SELECT t.id::text,'support'::text,'Destek talebi'::text,
          LEFT(COALESCE(t.subject,''),240),NULL::text,COALESCE(t.status,''),t.created_at
          FROM b2b_support_tickets t WHERE t.user_id=$1
        UNION ALL SELECT a.id::text,'address'::text,'Adres eklendi'::text,
          LEFT(COALESCE(a.title,'')||' · '||COALESCE(a.city,''),240),
          NULL::text,'saved'::text,a.created_at
          FROM b2b_addresses a WHERE a.user_id=$1`+ledgerSql+
        `) SELECT *,COUNT(*) OVER()::int AS total_count
        FROM events ORDER BY happened_at DESC NULLS LAST,type,id DESC
        LIMIT $3 OFFSET $4`;
      const result=await pool.query(query,[id,email,40,(page-1)*40]);
      const total=Number(result.rows[0]?.total_count||0);
      const rows=result.rows.map(({total_count,...row}:any)=>row);
      return res.json({rows,page,total,hasMore:page*40<total});
    }catch(error){return fail(res,error);}
  });
}
