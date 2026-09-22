export type AuthUser={id:string;email:string;role:string;appAccess:string;isActive:boolean};
export type AuthSession={access_token:string;user:AuthUser};
const KEY="caliskan_auth_token";
const token=()=>localStorage.getItem(KEY);
async function json(res:Response){const p=await res.json().catch(()=>({}));if(!res.ok)throw new Error(p.error||"İşlem başarısız");return p;}
export const authApi={
 async login(email:string,password:string):Promise<AuthSession>{const p=await json(await fetch("/api/auth/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})}));localStorage.setItem(KEY,p.token);return{access_token:p.token,user:p.user};},
 async bootstrap(email:string,password:string):Promise<AuthSession>{const p=await json(await fetch("/api/auth/bootstrap",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({email,password})}));localStorage.setItem(KEY,p.token);return{access_token:p.token,user:p.user};},
 async session():Promise<AuthSession|null>{const t=token();if(!t)return null;const r=await fetch("/api/auth/session",{headers:{Authorization:`Bearer ${t}`}});if(!r.ok){localStorage.removeItem(KEY);return null;}const p=await r.json();return{access_token:t,user:p.user};},
 async logout(){const t=token();if(t)await fetch("/api/auth/logout",{method:"POST",headers:{Authorization:`Bearer ${t}`}}).catch(()=>{});localStorage.removeItem(KEY);}
};
export async function getOwnerUserId(){return (await authApi.session())?.user.id??null;}
export async function getAuthHeaders():Promise<Record<string,string>>{const s=await authApi.session();return s?{Authorization:`Bearer ${s.access_token}`,"X-Owner-User-Id":s.user.id}:{};}
