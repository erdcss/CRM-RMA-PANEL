import type { Express, RequestHandler } from "express";
import { createHash, randomUUID } from "node:crypto";
import { pool } from "./db";
import { ensureB2BLedgerSchema } from "./b2b-ledger";
import { extractTextLayerPdf, parseDefterBalancePdf, type LedgerPdfResult } from "./b2b-ledger-pdf";

const TABLES = [
  "CREATE TABLE IF NOT EXISTS b2b_ledger_imports (id UUID PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, file_hash CHAR(64) NOT NULL, file_name VARCHAR(150) NOT NULL, extracted JSONB NOT NULL, imported_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours'), UNIQUE(user_id,file_hash))",
  "CREATE TABLE IF NOT EXISTS b2b_ledger_wallets (id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, name VARCHAR(140) NOT NULL, kind VARCHAR(8) NOT NULL CHECK(kind IN ('cash','bank')), opening_cents BIGINT NOT NULL DEFAULT 0, import_id UUID REFERENCES b2b_ledger_imports(id), created_at TIMESTAMPTZ NOT NULL DEFAULT NOW())",
  "CREATE INDEX IF NOT EXISTS b2b_ledger_wallets_owner_idx ON b2b_ledger_wallets(user_id,kind,id)",
  "CREATE TABLE IF NOT EXISTS b2b_ledger_wallet_movements (id BIGSERIAL PRIMARY KEY, user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, wallet_id BIGINT NOT NULL REFERENCES b2b_ledger_wallets(id) ON DELETE RESTRICT, direction VARCHAR(3) NOT NULL CHECK(direction IN ('in','out')), amount_cents BIGINT NOT NULL CHECK(amount_cents>0 AND amount_cents<=999999999), description VARCHAR(500) NOT NULL DEFAULT '', effective_on DATE NOT NULL DEFAULT CURRENT_DATE, request_key UUID NOT NULL, voided_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), UNIQUE(user_id,request_key))"
];
let initialized: Promise<void> | null = null;
export async function ensureB2BLedgerImportSchema() {
  if(!pool) throw Error("Veritabanı bulunamadı");
  if(!initialized) initialized = pool.query(TABLES.join(";\n")+";").then(()=>undefined).catch(err=>{initialized=null;throw err;});
  await Promise.all([initialized,ensureB2BLedgerSchema()]);
}
const owner=(res:any)=>Number(res.locals.b2bUser.id);
const idOk=(v:unknown)=>/^[1-9]\d{0,17}$/.test(String(v||""));
const uuidOk=(v:unknown)=>typeof v==="string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i.test(v);
function invalid(res:any,msg:string){return res.status(400).json({error:msg});}
function fail(res:any,err:unknown){console.error("[ledger-import]",err);return res.status(500).json({error:"Defter aktarımı gerçekleştirilemedi."});}
function cents(value:unknown){
  const raw=String(value??"").trim().replace(",",".");
  if(!/^(?:0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(raw)) return null;
  const [units,decimals=""]=raw.split(".");
  const amount=BigInt(units)*100n+BigInt(decimals.padEnd(2,"0")||"0");
  return amount>0n && amount<=999999999n?amount.toString():null;
}
const walletSql = "SELECT w.id::text,w.name,w.kind,w.opening_cents::text, " +
  "(w.opening_cents + COALESCE(SUM(CASE WHEN m.voided_at IS NULL AND m.direction='in' THEN m.amount_cents WHEN m.voided_at IS NULL AND m.direction='out' THEN -m.amount_cents ELSE 0 END),0))::text AS balance_cents, " +
  "COUNT(m.id) FILTER(WHERE m.voided_at IS NULL)::int AS movement_count " +
  "FROM b2b_ledger_wallets w LEFT JOIN b2b_ledger_wallet_movements m ON m.wallet_id=w.id AND m.user_id=w.user_id";

export function registerB2BLedgerImportRoutes(app:Express,requireB2B:RequestHandler) {
  app.post("/api/b2b/ledger/import/pdf/preview",requireB2B,async(req,res)=>{
    const fileName=String(req.body?.fileName||"").slice(0,150);
    const base64=req.body?.dataBase64;
    if(!fileName.toLowerCase().endsWith(".pdf") || typeof base64!=="string" ||
      base64.length<100 || base64.length>7_000_000 || !/^[A-Za-z0-9+/=\r\n]+$/.test(base64)) {
      return invalid(res,"En fazla 5 MB olan geçerli bir PDF yükleyin.");
    }
    try {
      const bytes=Buffer.from(base64.replace(/\s/g,""),"base64");
      const parsed=parseDefterBalancePdf(extractTextLayerPdf(bytes));
      if(!parsed.verified) return invalid(res,"PDF genel toplamı doğrulanamadı; bu dosyanın otomatik aktarımı güvenli değil.");
      await ensureB2BLedgerImportSchema();
      const hash=createHash("sha256").update(bytes).digest("hex");
      const existing=await pool!.query("SELECT id,imported_at FROM b2b_ledger_imports WHERE user_id=$1 AND file_hash=$2",[owner(res),hash]);
      if(existing.rows[0]?.imported_at) return res.status(409).json({error:"Bu PDF daha önce içe aktarılmış."});
      const stored=await pool!.query(
        "INSERT INTO b2b_ledger_imports(id,user_id,file_hash,file_name,extracted,expires_at) VALUES($1,$2,$3,$4,$5::jsonb,NOW()+INTERVAL '2 hours') " +
        "ON CONFLICT(user_id,file_hash) DO UPDATE SET extracted=EXCLUDED.extracted,file_name=EXCLUDED.file_name,expires_at=EXCLUDED.expires_at " +
        "WHERE b2b_ledger_imports.imported_at IS NULL RETURNING id",
        [existing.rows[0]?.id || randomUUID(),owner(res),hash,fileName,JSON.stringify(parsed)],
      );
      const contacts=await pool!.query("SELECT name FROM b2b_ledger_contacts WHERE user_id=$1 AND is_archived=FALSE",[owner(res)]);
      const names=new Set(contacts.rows.map(x=>String(x.name).trim().toLocaleLowerCase("tr-TR")));
      res.setHeader("Cache-Control","private,no-store");
      return res.json({
        previewId:stored.rows[0].id,sourceLabel:parsed.sourceLabel,reportDate:parsed.reportDate,
        verified:parsed.verified,totals:parsed.totals,
        rows:parsed.rows.map((x,i)=>({...x,index:i,exists:x.section==="cari"&&names.has(x.name.trim().toLocaleLowerCase("tr-TR"))})),
      });
    } catch(err) {
      if(err instanceof Error && /PDF|hesap|toplam|sınır|OCR|şifre|boyut|desteklenmiyor|sayfa|geçerli/.test(err.message)) return invalid(res,err.message);
      return fail(res,err);
    }
  });

  app.post("/api/b2b/ledger/import/pdf/confirm",requireB2B,async(req,res)=>{
    const previewId=req.body?.previewId, positiveMeans=req.body?.positiveMeans;
    if(!uuidOk(previewId) || !["receivable","debt"].includes(positiveMeans)) return invalid(res,"Önizleme ve bakiye yönü seçilmelidir.");
    if(!pool) return res.status(503).json({error:"Veritabanına erişilemiyor."});
    const client=await pool.connect();
    try {
      await ensureB2BLedgerImportSchema();
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[owner(res)]);
      const result=await client.query("SELECT extracted,file_name,imported_at,expires_at FROM b2b_ledger_imports WHERE id=$1 AND user_id=$2 FOR UPDATE",[previewId,owner(res)]);
      if(!result.rows.length){await client.query("ROLLBACK");return res.status(404).json({error:"Önizleme bulunamadı."});}
      const record=result.rows[0];
      if(record.imported_at){await client.query("ROLLBACK");return res.status(409).json({error:"PDF zaten aktarılmış."});}
      if(new Date(record.expires_at).getTime()<Date.now()){await client.query("ROLLBACK");return res.status(410).json({error:"Önizleme süresi doldu; PDF'yi tekrar yükleyin."});}
      const source:LedgerPdfResult=record.extracted;
      const skip=req.body?.skipIndices;
      if(!Array.isArray(skip)||skip.length>source.rows.length||skip.some((x:unknown)=>!Number.isInteger(x)||Number(x)<0||Number(x)>=source.rows.length)) {
        await client.query("ROLLBACK");return invalid(res,"Atlanan hesaplar geçersiz.");
      }
      const skipped=new Set<number>(skip);
      const current=await client.query("SELECT name FROM b2b_ledger_contacts WHERE user_id=$1 AND is_archived=FALSE",[owner(res)]);
      const names=new Set(current.rows.map(x=>String(x.name).trim().toLocaleLowerCase("tr-TR")));
      const wallets=await client.query("SELECT name,kind FROM b2b_ledger_wallets WHERE user_id=$1",[owner(res)]);
      const walletNames=new Set(wallets.rows.map(x=>x.kind+":"+String(x.name).trim().toLocaleLowerCase("tr-TR")));
      let createdContacts=0,createdWallets=0,skippedExisting=0,skippedByUser=0;
      const effective=source.reportDate&&/^\d{4}-\d{2}-\d{2}$/.test(source.reportDate)?source.reportDate:new Date().toISOString().slice(0,10);
      for(let i=0;i<source.rows.length;i++){
        const row=source.rows[i], key=row.name.trim().toLocaleLowerCase("tr-TR");
        if(skipped.has(i)){skippedByUser++;continue;}
        if(row.section==="cari"){
          if(names.has(key)){skippedExisting++;continue;}
          if(current.rows.length+createdContacts>=250){await client.query("ROLLBACK");return res.status(409).json({error:"250 aktif defter sınırına ulaşıldı."});}
          const inserted=await client.query("INSERT INTO b2b_ledger_contacts(user_id,name,kind,description) VALUES($1,$2,'other',$3) RETURNING id",
            [owner(res),row.name,"PDF açılış bakiyesi: "+String(record.file_name).slice(0,110)]);
          const signed=BigInt(row.signedCents);
          if(signed!==0n){
            const type=signed>0n?positiveMeans:positiveMeans==="receivable"?"debt":"receivable";
            await client.query(
              "INSERT INTO b2b_ledger_entries(user_id,contact_id,type,amount_cents,description,effective_on,request_key) VALUES($1,$2,$3,$4,$5,$6::date,$7::uuid)",
              [owner(res),inserted.rows[0].id,type,(signed<0n?-signed:signed).toString(),"PDF'den açılış bakiyesi · "+String(record.file_name).slice(0,100),effective,randomUUID()],
            );
          }
          names.add(key);createdContacts++;
        }else{
          const walletKey=row.section+":"+key;
          if(walletNames.has(walletKey)){skippedExisting++;continue;}
          if(wallets.rows.length+createdWallets>=100){await client.query("ROLLBACK");return res.status(409).json({error:"100 kasa/banka hesabı sınırına ulaşıldı."});}
          await client.query("INSERT INTO b2b_ledger_wallets(user_id,name,kind,opening_cents,import_id) VALUES($1,$2,$3,$4,$5::uuid)",
            [owner(res),row.name,row.section,row.signedCents,previewId]);
          walletNames.add(walletKey);createdWallets++;
        }
      }
      await client.query("UPDATE b2b_ledger_imports SET imported_at=NOW() WHERE id=$1 AND user_id=$2",[previewId,owner(res)]);
      await client.query("COMMIT");
      return res.json({createdContacts,createdWallets,skippedExisting,skippedByUser});
    }catch(err){await client.query("ROLLBACK").catch(()=>undefined);return fail(res,err);}
    finally{client.release();}
  });

  app.get("/api/b2b/ledger/wallets",requireB2B,async(_req,res)=>{
    try{await ensureB2BLedgerImportSchema();const r=await pool!.query(walletSql+" WHERE w.user_id=$1 GROUP BY w.id ORDER BY w.kind,w.id DESC LIMIT 100",[owner(res)]);
      res.setHeader("Cache-Control","private,no-store");return res.json(r.rows);
    }catch(err){return fail(res,err);}
  });
  app.get("/api/b2b/ledger/wallets/:id",requireB2B,async(req,res)=>{
    if(!idOk(req.params.id))return invalid(res,"Geçersiz hesap.");
    try{
      await ensureB2BLedgerImportSchema();
      const [account,movements]=await Promise.all([
        pool!.query(walletSql+" WHERE w.user_id=$1 AND w.id=$2 GROUP BY w.id",[owner(res),req.params.id]),
        pool!.query("SELECT id::text,direction,amount_cents::text,description,effective_on,created_at,voided_at FROM b2b_ledger_wallet_movements WHERE user_id=$1 AND wallet_id=$2 ORDER BY id DESC LIMIT 500",
          [owner(res),req.params.id]),
      ]);
      if(!account.rowCount)return res.status(404).json({error:"Hesap bulunamadı."});
      return res.json({...account.rows[0],movements:movements.rows});
    }catch(err){return fail(res,err);}
  });
  app.post("/api/b2b/ledger/wallets/:id/movements",requireB2B,async(req,res)=>{
    if(!idOk(req.params.id))return invalid(res,"Geçersiz hesap.");
    const amount=cents(req.body?.amount),direction=req.body?.direction,key=req.body?.requestKey,date=String(req.body?.effectiveOn||"");
    const description=typeof req.body?.description==="string"?req.body.description.trim().slice(0,500):"";
    if(!amount||!["in","out"].includes(direction)||!uuidOk(key)||!/^\d{4}-\d{2}-\d{2}$/.test(date)||Number.isNaN(Date.parse(date)))
      return invalid(res,"Hareket tutarı, türü veya tarihi geçersiz.");
    if(!pool)return res.status(503).json({error:"Veritabanı hazır değil."});
    let client;
    try{
      await ensureB2BLedgerImportSchema();
      client=await pool.connect();
      await client.query("BEGIN");
      await client.query("SELECT id FROM users WHERE id=$1 FOR UPDATE",[owner(res)]);
      const existing=await client.query(
        "SELECT id::text,wallet_id::text,direction,amount_cents::text,description,effective_on::text FROM b2b_ledger_wallet_movements WHERE user_id=$1 AND request_key=$2::uuid",
        [owner(res),key]);
      if(existing.rows.length){
        const old=existing.rows[0];
        const same=old.wallet_id===req.params.id&&old.direction===direction&&old.amount_cents===amount&&
          old.effective_on===date&&old.description===description;
        await client.query("ROLLBACK");
        return same?res.json({id:old.id,alreadySaved:true}):res.status(409).json({error:"Bu işlem anahtarı daha önce farklı kayıt için kullanıldı."});
      }
      const wallet=await client.query(
        "SELECT id,(opening_cents+COALESCE((SELECT SUM(CASE WHEN direction='in' THEN amount_cents ELSE -amount_cents END) FROM b2b_ledger_wallet_movements WHERE wallet_id=w.id AND user_id=$2 AND voided_at IS NULL),0))::text balance "+
        "FROM b2b_ledger_wallets w WHERE w.id=$1 AND w.user_id=$2",
        [req.params.id,owner(res)]);
      if(!wallet.rowCount){await client.query("ROLLBACK");return res.status(404).json({error:"Kasa/banka hesabı bulunamadı."});}
      if(direction==="out"&&BigInt(wallet.rows[0].balance)<BigInt(amount)){
        await client.query("ROLLBACK");return res.status(409).json({error:"Hesap bakiyesi yetersiz. Negatif bakiyeye izin verilmiyor."});
      }
      const saved=await client.query(
        "INSERT INTO b2b_ledger_wallet_movements(user_id,wallet_id,direction,amount_cents,description,effective_on,request_key) "+
        "VALUES($1,$2,$3,$4,$5,$6::date,$7::uuid) RETURNING id::text",
        [owner(res),req.params.id,direction,amount,description,date,key]);
      await client.query("COMMIT");return res.status(201).json(saved.rows[0]);
    }catch(err){
      if(client)await client.query("ROLLBACK").catch(()=>undefined);
      return fail(res,err);
    }finally{client?.release();}
  });
}
