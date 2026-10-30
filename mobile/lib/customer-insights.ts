import { AppState } from "react-native";
import { localAuth } from "./supabase";
import { API_BASE_URL } from "./api";

const sessionId = "m-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2,14);

async function send(type: "session"|"product_view"|"product_duration", productId?:string, productName?:string, seconds?:number) {
  try {
    const { token } = await localAuth.getRequestCredentials();
    if (!token) return;
    await fetch(API_BASE_URL + "/api/b2b/usage-event", {
      method:"POST",
      headers:{"Content-Type":"application/json",Authorization:"Bearer " + token},
      body:JSON.stringify({sessionId,platform:"mobile",type,productId,productName,seconds}),
    });
  } catch { /* Device analytics should never block navigation. */ }
}

export const trackMobileSession = () => send("session");
export const trackMobileProductVisit = (id:string,name:string) => send("product_view",id,name);
export const trackMobileProductSeconds = (id:string,name:string,seconds:number) =>
  seconds>0 ? send("product_duration",id,name,Math.min(300,Math.floor(seconds))) : Promise.resolve();

export function monitorMobileProduct(id:string,name:string) {
  let active = AppState.currentState === "active";
  let since = Date.now();
  const flush = () => {
    if (!active) return;
    const elapsed = Math.floor((Date.now()-since)/1000);
    since=Date.now();
    if (elapsed>0 && elapsed<=120) void trackMobileProductSeconds(id,name,elapsed);
  };
  void trackMobileProductVisit(id,name);
  const interval=setInterval(flush,30000);
  const listener=AppState.addEventListener("change",next=>{
    if (next==="active") {active=true;since=Date.now();}
    else {flush();active=false;}
  });
  return () => {flush();clearInterval(interval);listener.remove();};
}
