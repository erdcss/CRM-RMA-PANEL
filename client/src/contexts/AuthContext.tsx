import {createContext,useCallback,useContext,useEffect,useMemo,useState,type ReactNode} from "react";
import {queryClient} from "@/lib/queryClient";
import {authApi,type AuthSession,type AuthUser} from "@/lib/supabase";
type AuthContextValue={session:AuthSession|null;user:AuthUser|null;loading:boolean;signIn:(email:string,password:string)=>Promise<void>;signUp:(email:string,password:string)=>Promise<void>;signOut:()=>Promise<void>};
const AuthContext=createContext<AuthContextValue|undefined>(undefined);
export function AuthProvider({children}:{children:ReactNode}){const[session,setSession]=useState<AuthSession|null>(null),[loading,setLoading]=useState(true);
 useEffect(()=>{authApi.session().then(setSession).catch(()=>setSession(null)).finally(()=>setLoading(false));},[]);
 const signIn=useCallback(async(email:string,password:string)=>{const s=await authApi.login(email,password);setSession(s);queryClient.clear();},[]);
 const signUp=useCallback(async(email:string,password:string)=>{const s=await authApi.bootstrap(email,password);setSession(s);queryClient.clear();},[]);
 const signOut=useCallback(async()=>{await authApi.logout();setSession(null);queryClient.clear();},[]);
 const value=useMemo(()=>({session,user:session?.user??null,loading,signIn,signUp,signOut}),[session,loading,signIn,signUp,signOut]);return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>}
export function useAuth(){const c=useContext(AuthContext);if(!c)throw new Error("useAuth must be used within AuthProvider");return c;}
