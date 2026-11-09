import {Platform} from 'react-native';
import {requireNativeModule} from 'expo-modules-core';

type NativeTikTokEvents = {
  isConfigured():Promise<boolean>;
  initializeWithConsent():Promise<boolean>;
  stopTracking():Promise<void>;
  requestAppleTrackingAuthorization():Promise<number>;
  trackEvent(name:string):Promise<boolean>;
  trackCommerceEvent(name:'ViewContent'|'Search'|'AddToCart'|'Checkout'|'Purchase',data:{eventId:string;value?:number;currency?:string;query?:string;contents?:Array<{contentId:string;price:number;quantity:number;contentName?:string;brand?:string;contentCategory?:string}>}):Promise<boolean>;
};

let cached:NativeTikTokEvents|null=null;
export function getTikTokEventsModule():NativeTikTokEvents|null{
  if(Platform.OS!=='ios')return null;
  if(cached)return cached;
  try{cached=requireNativeModule<NativeTikTokEvents>('CaliskanTiktokAppEvents');}
  catch{cached=null;}
  return cached;
}
