import type { Express, Request } from "express";
import type { Pool, PoolClient } from "pg";
import {createHash,randomBytes} from "node:crypto";
import {z} from "zod";

export const DUKKAN_SETUP_TTL_MINUTES=15;
export const isDukkanSetupCode=(value:string)=>/^DUK-[A-F0-9]{32}$/.test(value);
export const generateDukkanSetupCode=()=> "DUK-"+randomBytes(16).toString("hex").toUpperCase();
const digest=(value:string)=>createHash("sha256").update(value).digest("hex");
type Db=Pool|PoolClient;
async function ensure(db:Db){
  await db.query("CREATE TABLE IF NOT EXISTS dukkan_staff_password_codes (user_id INTEGER PRIMARY KEY REFERENCES users(id), store_id BIGINT NOT NULL REFERENCES dukkan_stores(id), issued_by INTEGER NOT NULL REFERENCES users(id), code_hash TEXT NOT NULL UNIQUE, password_fingerprint TEXT NOT NULL, expires_at TIMESTAMPTZ NOT NULL, issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), consumed_at TIMESTAMPTZ)");
}
const eligibleSql="u.role='staff' AND u.is_active=1 AND m.role IN ('manager','accountant','cashier','viewer') AND NOT EXISTS(SELECT 1 FROM dukkan_members other WHERE other.user_id=u.id AND other.store_id<>m.store_id)";
const validSql="SELECT c.user_id,u.password FROM dukkan_staff_password_codes c JOIN users u ON u.id=c.user_id JOIN dukkan_members m ON m.user_id=c.user_id AND m.store_id=c.store_id JOIN dukkan_members issuer ON issuer.store_id=c.store_id AND issuer.user_id=c.issued_by JOIN users owner ON owner.id=c.issued_by WHERE c.user_id=$1 AND c.code_hash=$2 AND c.consumed_at IS NULL AND c.expires_at>NOW() AND issuer.role='owner' AND owner.is_active=1 AND owner.role IN ('admin','super_admin') AND "+eligibleSql;
async function findCode(db:Db,userId:number,code:string,lock=false){
  if(!isDukkanSetupCode(code))return null;
  const r=await db.query(validSql+(lock?" FOR UPDATE OF c,u,m,issuer,owner":""),[userId,digest(code)]);
  const row=r.rows[0];if(!row)return null;
  // A password change through another workflow invalidates a previously issued code.
  const check=await db.query("SELECT password_fingerprint FROM dukkan_staff_password_codes WHERE user_id=$1",[userId]);
  return check.rows[0]?.password_fingerprint===digest(row.password)?row:null;
}
export async function validDukkanSetupCode(db:Pool,userId:number,code:string){
  await ensure(db);
  return Boolean(await findCode(db,userId,code));
}
export function registerDukkanStaffPasswordRoutes(app:Express,db:Pool|null|undefined,
  sessionUserId:(req:Request)=>number|undefined,hashPassword:(password:string)=>string){
  app.post("/api/dukkan/stores/:storeId/members/:userId/temporary-code",async(req,res)=>{
    res.setHeader("Cache-Control","no-store");
    const actor=sessionUserId(req), sid=Number(req.params.storeId), uid=Number(req.params.userId);
    if(!actor)return res.status(401).json({error:"Giriş yapmanız gerekiyor"});
    if(!db)return res.status(503).json({error:"Mağaza veritabanına erişilemiyor"});
    if(!Number.isSafeInteger(sid)||sid<=0||!Number.isSafeInteger(uid)||uid<=0||uid===actor)return res.status(400).json({error:"Geçersiz personel"});
    let c:PoolClient|undefined;
    try{
      await ensure(db);c=await db.connect();await c.query("BEGIN");
      const owner=await c.query("SELECT 1 FROM dukkan_members m JOIN users u ON u.id=m.user_id WHERE m.store_id=$1 AND m.user_id=$2 AND m.role='owner' AND u.role IN ('admin','super_admin') AND u.is_active=1 AND u.must_change_password=0 FOR SHARE OF m,u",[sid,actor]);
      if(!owner.rowCount){await c.query("ROLLBACK");return res.status(403).json({error:"Yalnızca yetkili mağaza sahibi geçici kod oluşturabilir."});}
      const target=await c.query("SELECT u.id,u.username,u.password FROM users u JOIN dukkan_members m ON m.user_id=u.id WHERE m.store_id=$1 AND u.id=$2 AND "+eligibleSql+" FOR UPDATE OF u,m",[sid,uid]);
      if(!target.rowCount){await c.query("ROLLBACK");return res.status(403).json({error:"Kod yalnızca bu mağazaya atanmış aktif, yönetici olmayan personel hesabı için oluşturulabilir."});}
      const code=generateDukkanSetupCode();
      const r=await c.query("INSERT INTO dukkan_staff_password_codes(user_id,store_id,issued_by,code_hash,password_fingerprint,expires_at) VALUES($1,$2,$3,$4,$5,NOW()+INTERVAL '15 minutes') ON CONFLICT(user_id) DO UPDATE SET store_id=EXCLUDED.store_id,issued_by=EXCLUDED.issued_by,code_hash=EXCLUDED.code_hash,password_fingerprint=EXCLUDED.password_fingerprint,expires_at=EXCLUDED.expires_at,issued_at=NOW(),consumed_at=NULL RETURNING expires_at",[uid,sid,actor,digest(code),digest(target.rows[0].password)]);
      await c.query("COMMIT");return res.status(201).json({code,username:target.rows[0].username,expiresAt:r.rows[0].expires_at});
    }catch(e){await c?.query("ROLLBACK").catch(()=>{});console.error("Dukkan staff code creation failed");return res.status(503).json({error:"Geçici kod oluşturulamadı."});}finally{c?.release();}
  });
  app.post("/api/dukkan/password-setup",async(req,res)=>{
    res.setHeader("Cache-Control","no-store");
    if(!db)return res.status(503).json({error:"Mağaza veritabanına erişilemiyor"});
    const body=z.object({username:z.string().trim().min(1).max(254),code:z.string().refine(isDukkanSetupCode),password:z.string().min(10).max(128).refine(v=>!isDukkanSetupCode(v)&&v.trim()===v)}).safeParse(req.body);
    if(!body.success)return res.status(400).json({error:"Kod ve en az 10 karakterli, geçerli yeni şifre gerekli."});
    let c:PoolClient|undefined;
    try{
      await ensure(db);c=await db.connect();await c.query("BEGIN");
      // Locate by the high-entropy code rather than ambiguous username/e-mail matching.
      const match=await c.query("SELECT c.user_id FROM dukkan_staff_password_codes c JOIN users u ON u.id=c.user_id WHERE c.code_hash=$1 AND lower(u.username)=lower($2)",[digest(body.data.code),body.data.username]);
      if(!match.rowCount){await c.query("ROLLBACK");return res.status(401).json({error:"Geçici kod geçersiz veya süresi dolmuş."});}
      const uid=Number(match.rows[0].user_id);
      const valid=await findCode(c,uid,body.data.code,true);
      if(!valid){await c.query("ROLLBACK");return res.status(401).json({error:"Geçici kod geçersiz veya süresi dolmuş."});}
      await c.query("UPDATE users SET password=$1,must_change_password=0 WHERE id=$2",[hashPassword(body.data.password),uid]);
      await c.query("UPDATE dukkan_staff_password_codes SET consumed_at=NOW() WHERE user_id=$1",[uid]);
      // Existing browser sessions are invalidated; no new authentication is granted here.
      // user_sessions exists on the production PostgreSQL session store.
      const sessionTable=await c.query("SELECT to_regclass('user_sessions') AS name");
      if(sessionTable.rows[0]?.name)await c.query("DELETE FROM user_sessions WHERE sess->>'userId'=$1",[String(uid)]);
      await c.query("COMMIT");return res.json({ok:true});
    }catch(e){await c?.query("ROLLBACK").catch(()=>{});console.error("Dukkan staff password setup failed");return res.status(503).json({error:"Şifre kaydedilemedi."});}finally{c?.release();}
  });
}
