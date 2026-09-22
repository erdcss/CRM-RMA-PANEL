import AsyncStorage from '@react-native-async-storage/async-storage';
const API_URL=(process.env.EXPO_PUBLIC_API_URL??'').replace(/\/$/,'');const KEY='caliskan_auth_token';
export type AuthUser={id:string;email:string;role:string;appAccess:string;isActive:boolean};export type AuthSession={access_token:string;user:AuthUser};
async function parse(r:Response){const p=await r.json().catch(()=>({}));if(!r.ok)throw new Error(p.error||'İşlem başarısız');return p;}
export const localAuth={
 async getSession():Promise<AuthSession|null>{const t=await AsyncStorage.getItem(KEY);if(!t||!API_URL)return null;const r=await fetch(`${API_URL}/api/auth/session`,{headers:{Authorization:`Bearer ${t}`}});if(!r.ok){await AsyncStorage.removeItem(KEY);return null;}const p=await r.json();return{access_token:t,user:p.user};},
 async signIn(email:string,password:string){if(!API_URL)throw new Error('EXPO_PUBLIC_API_URL tanımlı değil.');const p=await parse(await fetch(`${API_URL}/api/auth/login`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:email.trim(),password})}));await AsyncStorage.setItem(KEY,p.token);return{access_token:p.token,user:p.user} as AuthSession;},
 async signOut(){const t=await AsyncStorage.getItem(KEY);if(t&&API_URL)await fetch(`${API_URL}/api/auth/logout`,{method:'POST',headers:{Authorization:`Bearer ${t}`}}).catch(()=>{});await AsyncStorage.removeItem(KEY);}
};
