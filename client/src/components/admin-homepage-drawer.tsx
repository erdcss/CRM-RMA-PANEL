import type {ReactNode} from "react";
import {ChevronDown,ChevronRight} from "lucide-react";

export type HomepageDrawerId="categories"|"campaign"|"banners";
export type HomepageDrawerState=Record<HomepageDrawerId,boolean>;
export const DEFAULT_HOMEPAGE_DRAWERS:HomepageDrawerState={
  categories:true,campaign:false,banners:false,
};
const STORAGE_KEY="caliskan_admin_homepage_drawers_v1";

/** Persist only the UI's expanded state, never unsaved admin form data. */
export function loadHomepageDrawers():HomepageDrawerState{
  if(typeof window==="undefined")return {...DEFAULT_HOMEPAGE_DRAWERS};
  try{
    const raw=window.localStorage.getItem(STORAGE_KEY);
    if(!raw)return {...DEFAULT_HOMEPAGE_DRAWERS};
    const value:unknown=JSON.parse(raw);
    if(!value||typeof value!=="object"||Array.isArray(value))
      return {...DEFAULT_HOMEPAGE_DRAWERS};
    const record=value as Record<string,unknown>;
    return {
      categories:typeof record.categories==="boolean"?record.categories:true,
      campaign:typeof record.campaign==="boolean"?record.campaign:false,
      banners:typeof record.banners==="boolean"?record.banners:false,
    };
  }catch{
    return {...DEFAULT_HOMEPAGE_DRAWERS};
  }
}
export function saveHomepageDrawers(value:HomepageDrawerState):void{
  if(typeof window==="undefined")return;
  try{window.localStorage.setItem(STORAGE_KEY,JSON.stringify(value));}
  catch{/* Private browsing or blocked storage must not affect the editor. */}
}

export function AdminHomepageDrawer({
  id,title,description,open,onToggle,summary,actions,children,
}:{
  id:HomepageDrawerId;
  title:string;description:string;open:boolean;onToggle:()=>void;
  summary?:string;actions?:ReactNode;children:ReactNode;
}){
  const panelId="admin-homepage-drawer-"+id;
  return <section className="mt-5 overflow-hidden rounded-2xl border border-slate-200 bg-background shadow-sm" aria-label={title}>
    <div className="flex min-w-0 flex-wrap items-center justify-between gap-3 bg-background px-4 py-4 sm:px-5">
      <button type="button" aria-expanded={open} aria-controls={panelId}
        onClick={onToggle}
        className="group flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left outline-none focus-visible:ring-2 focus-visible:ring-amber-500"
        aria-label={title+" bölümünü "+(open?"kapat":"aç")}>
        <span className={"flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-colors "+
          (open?"border-amber-300 bg-amber-100 text-amber-950":"border-slate-200 bg-slate-100 text-slate-700")}>
          {open?<ChevronDown className="h-5 w-5"/>:<ChevronRight className="h-5 w-5"/>}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="block text-base font-extrabold text-foreground sm:text-lg">{title}</span>
            {summary&&<span className="rounded-full bg-amber-100 px-2.5 py-1 text-[11px] font-bold text-amber-950">{summary}</span>}
          </span>
          <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground sm:text-sm">{description}</span>
        </span>
        <span className="hidden shrink-0 text-xs font-bold text-muted-foreground sm:block">{open?"Kapat":"Aç"}</span>
      </button>
      {actions?<div className="flex shrink-0 items-center gap-2">{actions}</div>:null}
    </div>
    <div id={panelId} hidden={!open} className="border-t border-slate-200">
      {children}
    </div>
  </section>;
}
