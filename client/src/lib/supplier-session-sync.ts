import { queryClient } from "@/lib/queryClient";

// A timestamp only; no account IDs, credentials, products or customer data
// are ever written to shared browser storage.
const KEY="caliskan-b2b-supplier-session-changed";

export function announceSupplierSessionChange(){
  try{
    window.localStorage.setItem(KEY,String(Date.now())+"-"+Math.random().toString(36).slice(2));
  }catch{
    // Storage may be blocked in a private browser. Reload in the current tab
    // still guarantees local tenant data is discarded.
  }
}

export function listenForSupplierSessionChange(){
  function onStorage(event:StorageEvent){
    if(event.key!==KEY || !event.newValue)return;
    // A different tab logged in or out: discard previous seller's entire cache.
    queryClient.clear();
    window.location.reload();
  }
  window.addEventListener("storage",onStorage);
  return ()=>window.removeEventListener("storage",onStorage);
}
