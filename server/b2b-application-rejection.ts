import {pool} from "./db";

export const B2B_REAPPLICATION_URL="https://b2b.ecalisgan.com/kayit-ol";
export const REJECTION_REASON_MIN=10;
export const REJECTION_REASON_MAX=1000;

/** A specific explanation is mandatory; avoid empty, generic or overly long records. */
export function normalizeB2BRejectionReason(value:unknown):string|null{
  if(typeof value!=="string")return null;
  const reason=value.replace(/[\u0000-\u001F\u007F]/g," ").replace(/\s+/g," ").trim();
  return reason.length>=REJECTION_REASON_MIN&&reason.length<=REJECTION_REASON_MAX?reason:null;
}
export function escapeRejectionHtml(value:string):string{
  return value.replace(/[&<>"']/g,ch=>({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;",
  } as Record<string,string>)[ch]);
}
export function rejectionEmail(input:{firstName?:string|null;companyName?:string|null;reason:string}){
  const name=(input.firstName||input.companyName||"Değerli İş Ortağımız").trim();
  const text=[
    `Sayın ${name},`,
    "",
    "Çalışkan B2B firma başvurunuz incelendi ve şu aşamada onaylanmadı.",
    "Başvurunuzun reddedilme nedeni:",
    input.reason,
    "",
    "Lütfen belirtilen eksiklikleri giderip aynı e-posta adresi ve vergi numarasıyla yeniden başvuru gönderin.",
    "Yeniden başvuru adresi: "+B2B_REAPPLICATION_URL,
    "Yeniden başvurunuz ayrıca yönetici incelemesine alınacaktır.",
    "",
    "Çalışkan B2B",
  ].join("\n");
  const html=`<div style="font-family:Arial,sans-serif;color:#172033;line-height:1.6;max-width:620px">
    <h2>Çalışkan B2B başvuru sonucu</h2>
    <p>Sayın ${escapeRejectionHtml(name)},</p>
    <p>Firma başvurunuz incelendi ve şu aşamada onaylanmadı.</p>
    <p><strong>Red nedeni:</strong></p>
    <div style="background:#fff6f6;border-left:4px solid #dc2626;padding:14px;white-space:pre-wrap">${escapeRejectionHtml(input.reason)}</div>
    <p>Lütfen eksiklikleri gidererek <strong>aynı e-posta adresi ve vergi numarasıyla</strong> yeniden başvurun. Yeni başvurunuz tekrar incelenecektir.</p>
    <p><a href="${B2B_REAPPLICATION_URL}" style="background:#fbbf24;color:#0f172a;padding:12px 18px;border-radius:7px;text-decoration:none;font-weight:bold">Yeniden Başvuru Yap</a></p>
    <p>Çalışkan B2B</p>
  </div>`;
  return {subject:"Çalışkan B2B - Firma başvuru sonucu ve yeniden başvuru",text,html};
}

/** Append-only history: reapplications keep the prior rejection and delivery status. */
let tableReady:Promise<void>|null=null;
export async function ensureB2BRejectionTable():Promise<void>{
  if(!pool)throw Error("Veritabanı erişilemiyor");
  if(!tableReady)tableReady=pool.query(`
    CREATE TABLE IF NOT EXISTS b2b_application_rejection_history (
      id BIGSERIAL PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      admin_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      reason TEXT NOT NULL,
      rejected_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      reapplied_at TIMESTAMPTZ,
      email_sent_at TIMESTAMPTZ,
      email_error TEXT,
      email_attempts INTEGER NOT NULL DEFAULT 0,
      push_recorded BOOLEAN NOT NULL DEFAULT FALSE
    );
    CREATE INDEX IF NOT EXISTS b2b_rejection_history_user_idx
    ON b2b_application_rejection_history(user_id,rejected_at DESC,id DESC);
  `).then(()=>undefined).catch(e=>{tableReady=null;throw e;});
  await tableReady;
}

export async function latestB2BRejection(userId:number){
  if(!pool)return null;
  await ensureB2BRejectionTable();
  const result=await pool.query(`SELECT id,reason,rejected_at,email_sent_at,
    email_error,email_attempts,push_recorded
    FROM b2b_application_rejection_history WHERE user_id=$1
    ORDER BY rejected_at DESC,id DESC LIMIT 1`,[userId]);
  const row=result.rows[0];
  return row?{
    id:Number(row.id),reason:String(row.reason),rejectedAt:row.rejected_at,
    emailSentAt:row.email_sent_at||null,emailError:row.email_error||null,
    emailAttempts:Number(row.email_attempts)||0,pushRecorded:row.push_recorded===true,
  }:null;
}
