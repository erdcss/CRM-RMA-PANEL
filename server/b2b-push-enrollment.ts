import {createHash,randomBytes} from "node:crypto";
import {pool} from "./db";

let enrollmentReady:Promise<void>|null=null;
async function ensureEnrollmentTable(){
 if(!pool)throw Error("Veritabanı bağlantısı yok");
 if(!enrollmentReady)enrollmentReady=pool.query(`
   CREATE TABLE IF NOT EXISTS b2b_mobile_push_enrollments(
     user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
     token_hash TEXT NOT NULL UNIQUE,
     expires_at TIMESTAMPTZ NOT NULL,
     consumed_at TIMESTAMPTZ,
     created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
   );
 `).then(()=>{}).catch(error=>{enrollmentReady=null;throw error;});
 await enrollmentReady;
}
const sha256=(value:string)=>createHash("sha256").update(value).digest("hex");

/** Created only as part of a successfully submitted B2B registration.
 * The random secret is presented once in the register response. Never
 * accept user IDs or email addresses from the anonymous enroll request. */
export async function createMobileSignupEnrollment(userId:number){
 await ensureEnrollmentTable();
 if(!pool)throw Error("DB unavailable");
 const secret=randomBytes(32).toString("base64url");
 await pool.query(`
   INSERT INTO b2b_mobile_push_enrollments(user_id,token_hash,expires_at,consumed_at)
   VALUES ($1,$2,NOW()+INTERVAL '30 minutes',NULL)
   ON CONFLICT(user_id) DO UPDATE SET
     token_hash=EXCLUDED.token_hash,expires_at=EXCLUDED.expires_at,
     consumed_at=NULL,created_at=NOW()
 `,[userId,sha256(secret)]);
 return secret;
}
export async function claimMobileSignupEnrollment(secret:string):Promise<number|null>{
 if(!/^[A-Za-z0-9_-]{43}$/.test(secret))return null;
 await ensureEnrollmentTable();
 if(!pool)return null;
 const result=await pool.query<{user_id:number}>(`
   UPDATE b2b_mobile_push_enrollments e
   SET consumed_at=NOW()
   FROM users u
   WHERE e.token_hash=$1
     AND e.user_id=u.id AND u.role='b2b_customer'
     AND e.consumed_at IS NULL AND e.expires_at>NOW()
   RETURNING e.user_id
 `,[sha256(secret)]);
 return result.rows[0]?.user_id||null;
}
