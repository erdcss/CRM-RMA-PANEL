import type { Express, RequestHandler } from "express";
import { createHash } from "node:crypto";
import { pool } from "./db";
import { notifyB2BEvent } from "./b2b-notification-center";

let initialized:Promise<void>|null=null;
async function ensureDocuments() {
  if(!pool) throw new Error("Veritabanı kullanılamıyor");
  if(!initialized)initialized=pool.query(`
    CREATE TABLE IF NOT EXISTS b2b_invoice_documents (
      invoice_id BIGINT PRIMARY KEY REFERENCES b2b_invoices(id) ON DELETE CASCADE,
      order_id BIGINT NOT NULL UNIQUE REFERENCES b2b_orders(id) ON DELETE CASCADE,
      document BYTEA NOT NULL,
      sha256 TEXT NOT NULL,
      file_name TEXT NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `).then(()=>undefined).catch(e=>{initialized=null;throw e;});
  return initialized;
}

const maxPdfBytes=5*1024*1024;
function sendPdf(res:any,content:Buffer,filename:string){
  const name=filename.replace(/[^a-zA-Z0-9._-]/g,"_").slice(0,120)||"fatura.pdf";
  res.setHeader("Content-Type","application/pdf");
  res.setHeader("Content-Disposition",`inline; filename="${name}"`);
  res.setHeader("X-Content-Type-Options","nosniff");
  res.setHeader("Cache-Control","private, no-store");
  return res.send(content);
}

export function registerB2BInvoiceDocumentRoutes(
  app:Express,requireAdmin:RequestHandler,requireB2B:RequestHandler,
) {
  app.get("/api/admin/orders/:id/invoice",requireAdmin,async(req,res)=>{
    try {
      await ensureDocuments();
      const r=await pool!.query(`SELECT i.id,i.invoice_number,i.order_number,i.total_amount,i.created_at,
        d.file_name,d.updated_at FROM b2b_invoice_documents d
        JOIN b2b_invoices i ON i.id=d.invoice_id WHERE d.order_id::text=$1 LIMIT 1`,
        [String(req.params.id)]);
      return res.json(r.rows[0]||null);
    }catch(e){console.error("Admin invoice metadata",e);return res.status(500).json({error:"Fatura bilgisi alınamadı"});}
  });

  app.post("/api/admin/orders/:id/invoice",requireAdmin,async(req,res)=>{
    if(!pool)return res.status(503).json({error:"Veritabanı kullanılamıyor"});
    const invoiceNumber=String(req.body?.invoiceNumber||"").trim().slice(0,100);
    const dataUrl=typeof req.body?.dataUrl==="string"?req.body.dataUrl:"";
    const match=/^data:application\/pdf;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
    if(!invoiceNumber)return res.status(400).json({error:"Fatura numarası zorunludur"});
    if(!match)return res.status(400).json({error:"PDF formatında fatura yükleyin"});
    const bytes=Buffer.from(match[1],"base64");
    if(bytes.length<100||bytes.length>maxPdfBytes||bytes.subarray(0,5).toString()!=="%PDF-"){
      return res.status(400).json({error:"Geçersiz PDF veya 5 MB dosya sınırı aşıldı"});
    }
    const checksum=createHash("sha256").update(bytes).digest("hex");
    const client=await pool.connect();
    let event:{userId:number;orderNumber:string;total:number;dedupe:string}|null=null;
    try{
      await ensureDocuments();
      await client.query("BEGIN");
      const lookup=await client.query(`
        SELECT o.id,o.order_number,o.customer_email,o.total_amount,o.user_id,o.status,
          COALESCE(u.id,u2.id) AS customer_id
        FROM b2b_orders o
        LEFT JOIN users u ON u.id=o.user_id AND u.role='b2b_customer'
        LEFT JOIN users u2 ON LOWER(u2.email)=LOWER(o.customer_email)
          AND u2.role='b2b_customer'
        WHERE o.id::text=$1 LIMIT 1 FOR UPDATE OF o`,
        [String(req.params.id)]);
      const order=lookup.rows[0];
      if(!order||!order.customer_id || order.status==="payment_failed"){
        await client.query("ROLLBACK");
        return res.status(404).json({error:"Fatura ilişkilendirilecek geçerli müşteri siparişi bulunamadı"});
      }
      const userId=Number(order.customer_id);
      const previous=await client.query(
        "SELECT invoice_id,sha256 FROM b2b_invoice_documents WHERE order_id=$1 FOR UPDATE",
        [order.id],
      );
      let invoiceId: number;
      if(previous.rows[0]){
        invoiceId=Number(previous.rows[0].invoice_id);
        await client.query(
          "UPDATE b2b_invoices SET invoice_number=$2,total_amount=$3,download_url=$4 WHERE id=$1",
          [invoiceId,invoiceNumber,order.total_amount,`/api/b2b/invoices/${invoiceId}/file`],
        );
        await client.query(
          `UPDATE b2b_invoice_documents SET document=$2,sha256=$3,file_name=$4,updated_at=NOW()
            WHERE invoice_id=$1`,
          [invoiceId,bytes,checksum,`fatura-${invoiceNumber}.pdf`],
        );
      }else{
        const created=await client.query(
          `INSERT INTO b2b_invoices (user_id,invoice_number,order_number,total_amount)
           VALUES($1,$2,$3,$4) RETURNING id`,
          [userId,invoiceNumber,order.order_number,order.total_amount],
        );
        invoiceId=Number(created.rows[0].id);
        await client.query("UPDATE b2b_invoices SET download_url=$2 WHERE id=$1",
          [invoiceId,`/api/b2b/invoices/${invoiceId}/file`]);
        await client.query(
          `INSERT INTO b2b_invoice_documents(invoice_id,order_id,document,sha256,file_name)
           VALUES($1,$2,$3,$4,$5)`,
          [invoiceId,order.id,bytes,checksum,`fatura-${invoiceNumber}.pdf`],
        );
      }
      event={userId,orderNumber:String(order.order_number),total:Number(order.total_amount||0),
        dedupe:`invoice_issued:${order.id}:${checksum}`};
      await client.query("COMMIT");
      // Send once per new/replaced PDF, not on repeated identical uploads.
      if(!previous.rows[0]||previous.rows[0].sha256!==checksum) {
        const notification=event;
        void notifyB2BEvent(notification.userId,"invoice_issued",{
          orderNumber:notification.orderNumber,
          amount:notification.total.toLocaleString("tr-TR",{style:"currency",currency:"TRY"}),
          date:new Date().toLocaleDateString("tr-TR",{timeZone:"Europe/Istanbul"}),
        },notification.dedupe).catch(e=>console.error("Invoice alert failure",e));
      }
      return res.json({ok:true,invoiceId,invoiceNumber,orderNumber:event.orderNumber});
    }catch(error){
      await client.query("ROLLBACK").catch(()=>undefined);
      console.error("Invoice PDF upload failed",error);
      return res.status(500).json({error:"Fatura yüklenemedi"});
    }finally{client.release();}
  });

  app.get("/api/admin/orders/:id/invoice/file",requireAdmin,async(req,res)=>{
    try{
      await ensureDocuments();
      const q=await pool!.query(`SELECT d.document,d.file_name FROM b2b_invoice_documents d
        WHERE d.order_id::text=$1 LIMIT 1`,[String(req.params.id)]);
      return q.rows[0]?sendPdf(res,q.rows[0].document,q.rows[0].file_name):res.status(404).end();
    }catch(error){console.error("Admin invoice download",error);return res.status(500).end();}
  });

  app.get("/api/b2b/invoices/:id/file",requireB2B,async(req,res)=>{
    try{
      await ensureDocuments();
      const user=(res.locals as any).b2bUser;
      const q=await pool!.query(
        `SELECT d.document,d.file_name FROM b2b_invoice_documents d
        JOIN b2b_invoices i ON i.id=d.invoice_id
        WHERE i.id::text=$1 AND i.user_id=$2 LIMIT 1`,
        [String(req.params.id),user.id],
      );
      return q.rows[0]?sendPdf(res,q.rows[0].document,q.rows[0].file_name):res.status(404).json({error:"Fatura bulunamadı"});
    }catch(error){console.error("B2B invoice download",error);return res.status(500).json({error:"Fatura açılamadı"});}
  });
}
