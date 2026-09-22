import type { Express, NextFunction, Request, Response } from "express";
import crypto from "crypto";
import { pool } from "./db";

export type LocalAuthUser = { id:string; email:string; role:string; appAccess:string; isActive:boolean };
declare global { namespace Express { interface Request { authUser?: LocalAuthUser } } }

const q=async(text:string,params:any[]=[])=>(pool as any).query(text,params);
const hashPassword=(password:string,salt=crypto.randomBytes(16).toString("hex"))=>{
  const hash=crypto.scryptSync(password,salt,64).toString("hex"); return `${salt}:${hash}`;
};
const verifyPassword=(password:string,stored:string)=>{
  const [salt,expected]=stored.split(":"); if(!salt||!expected)return false;
  const actual=crypto.scryptSync(password,salt,64); const exp=Buffer.from(expected,"hex");
  return actual.length===exp.length && crypto.timingSafeEqual(actual,exp);
};
const tokenHash=(token:string)=>crypto.createHash("sha256").update(token).digest("hex");

export async function ensureAuthSchema(){
 if(!pool) throw new Error("Railway PostgreSQL is required for production authentication");
 await q(`CREATE TABLE IF NOT EXISTS auth_users(
   id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL,
   role TEXT NOT NULL DEFAULT 'customer', app_access TEXT NOT NULL DEFAULT 'b2b',
   is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 ); CREATE TABLE IF NOT EXISTS auth_sessions(
   id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
   token_hash TEXT NOT NULL UNIQUE, expires_at TIMESTAMPTZ NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
 ); CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
 CREATE TABLE IF NOT EXISTS app_branding(
   app TEXT NOT NULL, kind TEXT NOT NULL, mime TEXT NOT NULL, content BYTEA NOT NULL,
   updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), PRIMARY KEY(app,kind)
 );`);
}
function mapUser(r:any):LocalAuthUser{return {id:r.id,email:r.email,role:r.role,appAccess:r.app_access,isActive:r.is_active};}
export async function userFromToken(token?:string){
 if(!token)return null; const h=tokenHash(token);
 const r=await q(`SELECT u.* FROM auth_sessions s JOIN auth_users u ON u.id=s.user_id WHERE s.token_hash=$1 AND s.expires_at>NOW() AND u.is_active=TRUE`,[h]);
 return r.rows[0]?mapUser(r.rows[0]):null;
}
export function bearer(req:Request){const v=req.header("Authorization")||"";const m=v.match(/^Bearer\s+(.+)$/i);return m?.[1]?.trim();}
export async function authMiddleware(req:Request,res:Response,next:NextFunction){
 if(!req.path.startsWith("/api")||req.path.startsWith("/api/auth/")||req.path.startsWith("/api/app-branding/")) return next();
 try{const user=await userFromToken(bearer(req)); if(!user)return res.status(401).json({error:"Authentication required"});
 req.authUser=user; req.headers["x-owner-user-id"]=user.id; next();}catch(e){next(e);}
}
export function requireAdmin(req:Request){return req.authUser && ["super_admin","admin"].includes(req.authUser.role)?req.authUser:null;}
async function createSession(userId:string){const token=crypto.randomBytes(48).toString("base64url"); await q("INSERT INTO auth_sessions(id,user_id,token_hash,expires_at) VALUES($1,$2,$3,NOW()+INTERVAL '30 days')",[crypto.randomUUID(),userId,tokenHash(token)]);return token;}
export function registerAuthRoutes(app:Express){
 app.post("/api/auth/login",async(req,res)=>{try{const email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");const r=await q("SELECT * FROM auth_users WHERE email=$1",[email]);let row=r.rows[0];if(!row){const count=await q("SELECT COUNT(*)::int n FROM auth_users");if(Number(count.rows[0].n)===0&&email.includes("@")&&password.length>=10){const id=crypto.randomUUID();await q("INSERT INTO auth_users(id,email,password_hash,role,app_access) VALUES($1,$2,$3,'super_admin','all')",[id,email,hashPassword(password)]);row={id,email,password_hash:hashPassword(password),role:"super_admin",app_access:"all",is_active:true};}else return res.status(401).json({error:"E-posta veya şifre hatalı"});}if(!row.is_active||!verifyPassword(password,row.password_hash))return res.status(401).json({error:"E-posta veya şifre hatalı"});const token=await createSession(row.id);res.json({token,user:mapUser(row)});}catch(e){console.error(e);res.status(500).json({error:"Giriş yapılamadı"});}});
 app.get("/api/auth/session",async(req,res)=>{try{const user=await userFromToken(bearer(req));if(!user)return res.status(401).json({error:"Oturum bulunamadı"});res.json({user});}catch{res.status(401).json({error:"Oturum bulunamadı"});}});
 app.post("/api/auth/logout",async(req,res)=>{const t=bearer(req);if(t)await q("DELETE FROM auth_sessions WHERE token_hash=$1",[tokenHash(t)]);res.json({ok:true});});
 app.post("/api/auth/bootstrap",async(req,res)=>{try{const count=await q("SELECT COUNT(*)::int n FROM auth_users");if(Number(count.rows[0].n)>0)return res.status(409).json({error:"İlk yönetici zaten oluşturulmuş"});const email=String(req.body?.email||"").trim().toLowerCase(),password=String(req.body?.password||"");if(!email.includes("@")||password.length<10)return res.status(400).json({error:"Geçerli e-posta ve en az 10 karakter şifre gerekli"});const id=crypto.randomUUID();await q("INSERT INTO auth_users(id,email,password_hash,role,app_access) VALUES($1,$2,$3,'super_admin','all')",[id,email,hashPassword(password)]);const token=await createSession(id);res.status(201).json({token,user:{id,email,role:"super_admin",appAccess:"all",isActive:true}});}catch(e:any){res.status(500).json({error:e.message||"Yönetici oluşturulamadı"});}});
}
export { hashPassword, q };
