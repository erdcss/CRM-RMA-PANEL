import AsyncStorage from '@react-native-async-storage/async-storage';
import {Platform} from 'react-native';
import {getTikTokEventsModule} from '../modules/tiktok-app-events/src';

const CONSENT_KEY='caliskan_b2b_tiktok_app_events_consent_v1';
let started=false;
let startupEventSent=false;
let initialising:Promise<boolean>|null=null;

export async function getTikTokAppEventsConsent():Promise<boolean>{
  try{return (await AsyncStorage.getItem(CONSENT_KEY))==='granted';}
  catch{return false;}
}
export async function isTikTokAppEventsConfigured():Promise<boolean>{
  const native=Platform.OS==='ios'?getTikTokEventsModule():null;
  if(!native)return false;
  try{return await native.isConfigured();}
  catch{return false;}
}
async function startTikTokSDK():Promise<boolean>{
  if(!(await getTikTokAppEventsConsent()))return false;
  const native=getTikTokEventsModule();
  if(!native)return false;
  if(started)return true;
  if(initialising)return initialising;
  initialising=(async()=>{
    try{
      if(!(await native.isConfigured()))return false;
      started=await native.initializeWithConsent();
      return started;
    }catch(e){
      console.warn('[tiktok-app-events] Native initialization unavailable',e);
      return false;
    }finally{
      initialising=null;
    }
  })();
  return initialising;
}
export async function setTikTokAppEventsConsent(value:boolean):Promise<boolean>{
  await AsyncStorage.setItem(CONSENT_KEY,value?'granted':'denied');
  const native=getTikTokEventsModule();
  if(!value){
    started=false;
    startupEventSent=false;
    // A previously initialized SDK cannot be removed, but its tracking
    // is suspended immediately when the user revokes permission.
    if(native)await native.stopTracking().catch(()=>{});
    return true;
  }
  const ready=await startTikTokSDK();
  if(!ready){
    // Consent must match the visible toggle; never leave 'granted' stored
    // after the app tells the user that initialization was rejected.
    await AsyncStorage.setItem(CONSENT_KEY,'denied');
    started=false;
  }
  return ready;
}
export async function initializeTikTokIfConsented():Promise<void>{
  if(!(await getTikTokAppEventsConsent()))return;
  if(!(await startTikTokSDK())||startupEventSent)return;
  const native=getTikTokEventsModule();
  if(!native)return;
  startupEventSent=true;
  try{await native.trackEvent('LaunchAPP');}
  catch{startupEventSent=false;}
}
/** Separate OS permission. Call from a tap only after TikTok opt-in. */
export async function requestTikTokAppleTrackingAuthorization():Promise<number|null>{
  if(!(await getTikTokAppEventsConsent()))return null;
  if(!(await startTikTokSDK()))return null;
  try{return await getTikTokEventsModule()?.requestAppleTrackingAuthorization()??null;}
  catch{return null;}
}
/** All commerce events route through the same separate TikTok consent check. */
export async function sendTikTokNativeCommerceEvent(
  name:'ViewContent'|'Search'|'AddToCart'|'Checkout'|'Purchase',
  payload:{eventId:string;value?:number;currency?:string;query?:string;
    contents?:Array<{contentId:string;price:number;quantity:number;
      contentName?:string;brand?:string;contentCategory?:string}>}
):Promise<boolean>{
  if(!(await getTikTokAppEventsConsent()))return false;
  if(!(await startTikTokSDK()))return false;
  try{return (await getTikTokEventsModule()?.trackCommerceEvent(name,payload))===true;}
  catch{return false;}
}
/** Explicit diagnostic after opt-in; SDK acceptance is not proof of TikTok receipt. */
export async function runTikTokConnectionTest():Promise<'no_consent'|'not_configured'|'submitted'|'error'>{
  if(!(await getTikTokAppEventsConsent()))return 'no_consent';
  if(!(await isTikTokAppEventsConfigured()))return 'not_configured';
  if(!(await startTikTokSDK()))return 'error';
  const native=getTikTokEventsModule();
  try{return (await native?.trackEvent('LaunchAPP'))?'submitted':'error';}
  catch{return 'error';}
}
