import type { Express, RequestHandler } from "express";
import { randomUUID } from "node:crypto";
import { pool } from "./db";
import { ensureB2BLedgerSchema } from "./b2b-ledger";
import { ensureB2BLedgerImportSchema } from "./b2b-ledger-import";

/** Customer-private double-posted commercial ledger actions.
 * Locked owner row serializes balances and idempotency. All posting is committed atomically.
 * Canonical sign: customer receivable +, supplier debt -.
 */
const INIT = [
  "CREATE TABLE IF NOT EXISTS b2b_ledger_operations (id BIGSERIAL PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,contact_id BIGINT NOT NULL REFERENCES b2b_ledger_contacts(id) ON DELETE RESTRICT,target_contact_id BIGINT REFERENCES b2b_ledger_contacts(id) ON DELETE RESTRICT,wallet_id BIGINT REFERENCES b2b_ledger_wallets(id) ON DELETE RESTRICT,type VARCHAR(16) NOT NULL CHECK(type IN ('sale','collection','purchase','payment','transfer')),amount_cents BIGINT NOT NULL CHECK(amount_cents>0 AND amount_cents<=999999999),effective_on DATE NOT NULL,category VARCHAR(120) NOT NULL DEFAULT '',description VARCHAR(500) NOT NULL DEFAULT '',request_key UUID NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(user_id,request_key))",
  "CREATE INDEX IF NOT EXISTS b2b_ledger_operations_owner_date_idx ON b2b_ledger_operations(user_id,effective_on DESC,id DESC)",
  "ALTER TABLE b2b_ledger_operations ADD COLUMN IF NOT EXISTS voided_at TIMESTAMPTZ",
  "ALTER TABLE b2b_ledger_operations ADD COLUMN IF NOT EXISTS void_reason VARCHAR(300)",
  "ALTER TABLE b2b_ledger_entries ADD COLUMN IF NOT EXISTS operation_id BIGINT REFERENCES b2b_ledger_operations(id)",
  "ALTER TABLE b2b_ledger_wallet_movements ADD COLUMN IF NOT EXISTS operation_id BIGINT REFERENCES b2b_ledger_operations(id)",
  "CREATE TABLE IF NOT EXISTS b2b_ledger_categories (id BIGSERIAL PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,name VARCHAR(120) NOT NULL,UNIQUE(user_id,name))",
];
let schema: Promise<void> | undefined;
async function ready() {
  await ensureB2BLedgerSchema();
  await ensureB2BLedgerImportSchema();
  if(!pool) throw Error("Veritabanı hazır değil");
  if(!schema) schema=(async()=>{for(const sql of INIT) await pool!.query(sql);})().catch(err=>{schema=undefined;throw err;});
  await schema;
}
function owner(res: any) {return Number(res.locals.b2bUser.id);}
function id(v:unknown): string|null {const s=String(v??"");return /^[1-9]\d{0,17}$/.test(s)?s:null;}
function uuid(v:unknown) {return typeof v==="string"&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v);}
function txt(v:unknown,n:number){return typeof v==="string"?v.trim().slice(0,n):"";}
function amount(v:unknown):string|null {
  const s=String(v??"").trim().replace(",",".");
  if(!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(s)) return null;
  const [whole,dec=""]=s.split(".");
  const cents=BigInt(whole)*100n+BigInt(dec.padEnd(2,"0")||"0");
  return cents>0n&&cents<=999999999n?cents.toString():null;
}
function day(v:unknown):string|null {
  const s=String(v??"");
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return null;
  const dt=new Date(s+"T00:00:00Z");
  return !Number.isNaN(dt.valueOf())&&dt.toISOString().slice(0,10)===s?s:null;
}
function fail(res:any,error:unknown){console.error("[b2b-ledger-advanced]",error);return res.status(500).json({error:"Defter işlemi tamamlanamadı."});}
const ENTRY:Record<string,string>={sale:"receivable",collection:"collection",purchase:"debt",payment:"payment"};
const TYPES=new Set(["sale","collection","purchase","payment","transfer"]);

export function registerB2BLedgerAdvancedRoutes(app:Express,requireB2B:RequestHandler) {
  app.get("/api/b2b/ledger/reports",requireB2B,async(_req,res)=>{
    try{
      await ready();
      const person=owner(res);
      const [operations,legacy,wallets,counts]=await Promise.all([
        pool!.query(
          "SELECT COALESCE(SUM(CASE WHEN type='collection' AND effective_on=(NOW() AT TIME ZONE 'Europe/Istanbul')::date THEN amount_cents ELSE 0 END),0)::text today_in,"+
          "COALESCE(SUM(CASE WHEN type='payment' AND effective_on=(NOW() AT TIME ZONE 'Europe/Istanbul')::date THEN amount_cents ELSE 0 END),0)::text today_out,"+
          "COALESCE(SUM(CASE WHEN type='collection' AND effective_on >= (NOW() AT TIME ZONE 'Europe/Istanbul')::date-INTERVAL '29 days' THEN amount_cents ELSE 0 END),0)::text month_in,"+
          "COALESCE(SUM(CASE WHEN type='payment' AND effective_on >= (NOW() AT TIME ZONE 'Europe/Istanbul')::date-INTERVAL '29 days' THEN amount_cents ELSE 0 END),0)::text month_out,"+
          "COALESCE(SUM(CASE WHEN type='payment' THEN amount_cents ELSE 0 END),0)::text all_out "+
          "FROM b2b_ledger_operations WHERE user_id=$1 AND voided_at IS NULL",[person]),
        pool!.query(
          "SELECT COALESCE(SUM(CASE WHEN type='collection' AND effective_on=(NOW() AT TIME ZONE 'Europe/Istanbul')::date THEN amount_cents ELSE 0 END),0)::text today_in,"+
          "COALESCE(SUM(CASE WHEN type='payment' AND effective_on=(NOW() AT TIME ZONE 'Europe/Istanbul')::date THEN amount_cents ELSE 0 END),0)::text today_out,"+
          "COALESCE(SUM(CASE WHEN type='collection' AND effective_on >= (NOW() AT TIME ZONE 'Europe/Istanbul')::date-INTERVAL '29 days' THEN amount_cents ELSE 0 END),0)::text month_in,"+
          "COALESCE(SUM(CASE WHEN type='payment' AND effective_on >= (NOW() AT TIME ZONE 'Europe/Istanbul')::date-INTERVAL '29 days' THEN amount_cents ELSE 0 END),0)::text month_out,"+
          "COALESCE(SUM(CASE WHEN type='payment' THEN amount_cents ELSE 0 END),0)::text all_out "+
          "FROM b2b_ledger_entries WHERE user_id=$1 AND operation_id IS NULL AND voided_at IS NULL",[person]),
        pool!.query(
          "SELECT w.kind, COALESCE(SUM(w.opening_cents + COALESCE((SELECT SUM(CASE WHEN m.direction='in' THEN m.amount_cents ELSE -m.amount_cents END) FROM b2b_ledger_wallet_movements m WHERE m.wallet_id=w.id AND m.user_id=w.user_id AND m.voided_at IS NULL),0)),0)::text balance_cents "+
          "FROM b2b_ledger_wallets w WHERE w.user_id=$1 GROUP BY w.kind",[person]),
        pool!.query("SELECT (SELECT COUNT(*)::int FROM b2b_ledger_contacts WHERE user_id=$1 AND is_archived=FALSE) contacts, "+
          "(SELECT COUNT(*)::int FROM b2b_ledger_wallets WHERE user_id=$1) wallets",[person])
      ]);
      const a=operations.rows[0],b=legacy.rows[0];const combined:any={};
      for(const k of ["today_in","today_out","month_in","month_out","all_out"])combined[k]=(BigInt(a[k]||0)+BigInt(b[k]||0)).toString();
      res.setHeader("Cache-Control","private,no-store");
      return res.json({...combined,cash_cents:wallets.rows.find((w:any)=>w.kind==="cash")?.balance_cents||"0",
        bank_cents:wallets.rows.find((w:any)=>w.kind==="bank")?.balance_cents||"0",...counts.rows[0]});
    }catch(error){return fail(res,error);}
  });

  app.get("/api/b2b/ledger/categories",requireB2B,async(_req,res)=>{
    try{await ready();const result=await pool!.query("SELECT id::text,name FROM b2b_ledger_categories WHERE user_id=$1 ORDER BY name LIMIT 120",[owner(res)]);return res.json(result.rows);}
    catch(err){return fail(res,err);}
  });
  app.post("/api/b2b/ledger/categories",requireB2B,async(req,res)=>{
    const name=txt(req.body?.name,120);if(!name)return res.status(400).json({error:"Kategori adı gereklidir."});
    try{await ready();const r=await pool!.query("INSERT INTO b2b_ledger_categories(user_id,name) VALUES($1,$2) ON CONFLICT(user_id,name) DO UPDATE SET name=EXCLUDED.name RETURNING id::text,name",[owner(res),name]);return res.status(201).json(r.rows[0]);}
    catch(err){return fail(res,err);}
  });

  app.post("/api/b2b/ledger/wallets",requireB2B,async(req,res)=>{
    const name=txt(req.body?.name,140),kind=req.body?.kind;
    if(!name||!["cash","bank"].includes(kind))return res.status(400).json({error:"Hesap adı ve türünü seçin."});
    try{
      await ready();
      // Creation uses zero opening balance; PDF import is the only nonzero opening path.
      const r=await pool!.query(
        "INSERT INTO b2b_ledger_wallets(user_id,name,kind,opening_cents) "+
        "SELECT $1,$2,$3,0 WHERE (SELECT COUNT(*) FROM b2b_ledger_wallets WHERE user_id=$1)<100 "+
        "RETURNING id::text,name,kind,opening_cents::text",[owner(res),name,kind]);
      if(!r.rowCount)return res.status(409).json({error:"En fazla 100 kasa/banka hesabı açılabilir."});
      return res.status(201).json(r.rows[0]);
    }catch(err){return fail(res,err);}
  });

  app.get("/api/b2b/ledger/notes/global",requireB2B,async(_req,res)=>{
    try{await ready();const r=await pool!.query("SELECT id::text,content,created_at,updated_at FROM b2b_ledger_notes WHERE user_id=$1 AND contact_id IS NULL ORDER BY id DESC LIMIT 150",[owner(res)]);return res.json(r.rows);}
    catch(err){return fail(res,err);}
  });
  app.post("/api/b2b/ledger/notes/global",requireB2B,async(req,res)=>{
    const content=txt(req.body?.content,4000);if(!content)return res.status(400).json({error:"Not yazın."});
    try{await ready();const r=await pool!.query("INSERT INTO b2b_ledger_notes(user_id,content) VALUES($1,$2) RETURNING id::text,content,created_at,updated_at",[owner(res),content]);return res.status(201).json(r.rows[0]);}
    catch(err){return fail(res,err);}
  });

  app.post("/api/b2b/ledger/operations",requireB2B,async(req,res)=>{
    const type=String(req.body?.type||""),contactId=id(req.body?.contactId),walletId=id(req.body?.walletId),targetId=id(req.body?.targetContactId);
    const cents=amount(req.body?.amount),effective=day(req.body?.effectiveOn),requestKey=req.body?.requestKey;
    const category=txt(req.body?.category,120),description=txt(req.body?.description,500);
    if(!TYPES.has(type)||!contactId||!cents||!effective||!uuid(requestKey))
      return res.status(400).json({error:"Hesap, işlem, tutar veya tarih geçersiz."});
    if(["collection","payment"].includes(type)&&!walletId)
      return res.status(400).json({error:"Tahsilat/ödeme için kasa veya banka seçin."});
    if(type==="transfer"&&(!targetId||targetId===contactId))
      return res.status(400).json({error:"Farklı bir hedef cari seçin."});
    if((type==="sale"||type==="purchase")&&(walletId||targetId)||
      type==="transfer"&&walletId||
      ["collection","payment"].includes(type)&&targetId)
      return res.status(400).json({error:"İşlemde gereksiz hesap seçimi var."});
    if(!pool)return res.status(503).json({error:"Veritabanı bağlantısı yok."});
    let client;
    try{
      await ready();client=await pool.connect();
      await client.query("BEGIN");
      // All writes via this endpoint serialize per owner, not just per account.
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[owner(res)]);
      const prev=await client.query(
        "SELECT id::text,contact_id::text,target_contact_id::text,wallet_id::text,type,amount_cents::text,effective_on::text,category,description FROM b2b_ledger_operations WHERE user_id=$1 AND request_key=$2::uuid",[owner(res),requestKey]);
      if(prev.rows.length){
        const r=prev.rows[0];
        const same=r.contact_id===contactId&&r.type===type&&r.amount_cents===cents&&r.effective_on===effective&&r.category===category&&r.description===description&&(r.wallet_id||null)===(walletId||null)&&(r.target_contact_id||null)===(targetId||null);
        await client.query("ROLLBACK");
        return same?res.json({id:r.id,alreadySaved:true}):res.status(409).json({error:"İşlem anahtarı farklı kayıtta kullanıldı."});
      }
      const person=await client.query("SELECT id FROM b2b_ledger_contacts WHERE id=$1 AND user_id=$2 AND is_archived=FALSE",[contactId,owner(res)]);
      if(!person.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Aktif cari hesap bulunamadı."});}
      if(targetId){
        const other=await client.query("SELECT id FROM b2b_ledger_contacts WHERE id=$1 AND user_id=$2 AND is_archived=FALSE",[targetId,owner(res)]);
        if(!other.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Hedef cari bulunamadı."});}
      }
      if(walletId){
        const wallet=await client.query(
          "SELECT w.id, (w.opening_cents+COALESCE((SELECT SUM(CASE WHEN m.direction='in' THEN m.amount_cents ELSE -m.amount_cents END) FROM b2b_ledger_wallet_movements m WHERE m.wallet_id=w.id AND m.user_id=$2 AND m.voided_at IS NULL),0))::text AS balance FROM b2b_ledger_wallets w WHERE w.id=$1 AND w.user_id=$2",
          [walletId,owner(res)]);
        if(!wallet.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Kasa/banka hesabı bulunamadı."});}
        if(type==="payment"&&BigInt(wallet.rows[0].balance)<BigInt(cents)){
          await client.query("ROLLBACK");return res.status(409).json({error:"Seçilen hesap bakiyesi ödemeye yetmiyor. Negatif bakiyeye izin verilmiyor."});
        }
      }
      if(type==="transfer"){
        const r=await client.query("SELECT COALESCE(SUM(CASE WHEN type='receivable' THEN amount_cents WHEN type='collection' THEN -amount_cents ELSE 0 END),0)::text available FROM b2b_ledger_entries WHERE user_id=$1 AND contact_id=$2 AND voided_at IS NULL",
          [owner(res),contactId]);
        if(BigInt(r.rows[0].available)<BigInt(cents)){await client.query("ROLLBACK");return res.status(409).json({error:"Kaynak carinin alacak bakiyesi transfer için yetersiz."});}
      }
      const op=await client.query(
        "INSERT INTO b2b_ledger_operations(user_id,contact_id,target_contact_id,wallet_id,type,amount_cents,effective_on,category,description,request_key) VALUES($1,$2,$3,$4,$5,$6,$7::date,$8,$9,$10::uuid) RETURNING id::text",
        [owner(res),contactId,targetId,walletId,type,cents,effective,category,description,requestKey]);
      const operationId=op.rows[0].id;
      async function entry(forId:string,entryType:string) {
        await client!.query(
          "INSERT INTO b2b_ledger_entries(user_id,contact_id,type,amount_cents,description,effective_on,request_key,operation_id) VALUES($1,$2,$3,$4,$5,$6::date,$7::uuid,$8)",
          [owner(res),forId,entryType,cents,description||category||type,effective,randomUUID(),operationId]);
      }
      if(type==="transfer"){await entry(contactId,"collection");await entry(targetId!,"receivable");}
      else await entry(contactId,ENTRY[type]);
      if(walletId){
        await client.query(
          "INSERT INTO b2b_ledger_wallet_movements(user_id,wallet_id,direction,amount_cents,description,effective_on,request_key,operation_id) VALUES($1,$2,$3,$4,$5,$6::date,$7::uuid,$8)",
          [owner(res),walletId,type==="collection"?"in":"out",cents,description||type,effective,randomUUID(),operationId]);
      }
      await client.query("COMMIT");
      return res.status(201).json({id:operationId,alreadySaved:false});
    }catch(error){
      if(client)await client.query("ROLLBACK").catch(()=>undefined);
      return fail(res,error);
    }finally{client?.release();}
  });

  app.post("/api/b2b/ledger/operations/:id/void",requireB2B,async(req,res)=>{
    const operation=id(req.params.id),reason=txt(req.body?.reason,300);
    if(!operation||reason.length<3)return res.status(400).json({error:"Geçerli işlem ve en az 3 harflik iptal nedeni girin."});
    if(!pool)return res.status(503).json({error:"Veritabanı hazır değil."});
    let client;
    try{
      await ready();client=await pool.connect();await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[owner(res)]);
      const op=await client.query(
        "UPDATE b2b_ledger_operations SET voided_at=NOW(),void_reason=$3 WHERE id=$1 AND user_id=$2 AND voided_at IS NULL RETURNING id",
        [operation,owner(res),reason]);
      if(!op.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Aktif işlem bulunamadı."});}
      await client.query("UPDATE b2b_ledger_entries SET voided_at=NOW(),void_reason=$3 WHERE operation_id=$1 AND user_id=$2 AND voided_at IS NULL",
        [operation,owner(res),reason]);
      await client.query("UPDATE b2b_ledger_wallet_movements SET voided_at=NOW() WHERE operation_id=$1 AND user_id=$2 AND voided_at IS NULL",
        [operation,owner(res)]);
      await client.query("COMMIT");return res.json({voided:true});
    }catch(error){if(client)await client.query("ROLLBACK").catch(()=>undefined);return fail(res,error);}
    finally{client?.release();}
  });

  app.get("/api/b2b/ledger/contacts/:id/statement",requireB2B,async(req,res)=>{
    const contact=id(req.params.id);
    const offset=Number(req.query.offset||0);
    if(!contact||!Number.isSafeInteger(offset)||offset<0||offset>100000)
      return res.status(400).json({error:"Hesap veya sayfalama hatalı."});
    try{
      await ready();
      const r=await pool!.query(
        `SELECT e.id::text,e.type,e.amount_cents::text,e.effective_on,e.description,
          e.voided_at,e.void_reason,o.type AS operation_type,o.category,
          o.target_contact_id::text,w.name AS wallet_name,t.name AS target_name
         FROM b2b_ledger_entries e
         JOIN b2b_ledger_contacts c ON c.id=e.contact_id AND c.user_id=e.user_id
         LEFT JOIN b2b_ledger_operations o ON o.id=e.operation_id AND o.user_id=e.user_id
         LEFT JOIN b2b_ledger_wallets w ON w.id=o.wallet_id AND w.user_id=e.user_id
         LEFT JOIN b2b_ledger_contacts t ON t.id=o.target_contact_id AND t.user_id=e.user_id
         WHERE e.user_id=$1 AND e.contact_id=$2
         ORDER BY e.effective_on DESC,e.id DESC LIMIT 301 OFFSET $3`,
        [owner(res),contact,offset],
      );
      res.setHeader("Cache-Control","private,no-store");
      return res.json({items:r.rows.slice(0,300),hasMore:r.rows.length>300});
    }catch(err){return fail(res,err);}
  });

  app.get("/api/b2b/ledger/contacts/:id/operations",requireB2B,async(req,res)=>{
    const contact=id(req.params.id);if(!contact)return res.status(400).json({error:"Geçersiz cari."});
    try{await ready();const r=await pool!.query(
      "SELECT op.id::text,op.type,op.amount_cents::text,op.effective_on,op.description,op.category,op.wallet_id::text,op.target_contact_id::text,op.created_at,op.voided_at,op.void_reason, "+
      "w.name AS wallet_name, c2.name AS target_name "+
      "FROM b2b_ledger_operations op LEFT JOIN b2b_ledger_wallets w ON w.id=op.wallet_id AND w.user_id=op.user_id "+
      "LEFT JOIN b2b_ledger_contacts c2 ON c2.id=op.target_contact_id AND c2.user_id=op.user_id "+
      "WHERE op.user_id=$1 AND (op.contact_id=$2 OR op.target_contact_id=$2) ORDER BY op.effective_on DESC,op.id DESC LIMIT 500",[owner(res),contact]);
      return res.json(r.rows);
    }catch(err){return fail(res,err);}
  });
}
