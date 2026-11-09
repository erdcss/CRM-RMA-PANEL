import {Platform} from 'react-native';
import {requireNativeModule} from 'expo-modules-core';

type NativeTikTokEvents = {
  isConfigured():Promise<boolean>;
  initializeWithConsent():Promise<boolean>;
  stopTracking():Promise<void>;
  trackEvent(name:string):Promise<boolean>;
};

let cached:NativeTikTokEvents|null=null;
export function getTikTokEventsModule():NativeTikTokEvents|null{
  if(Platform.OS!=='ios')return null;
  if(cached)return cached;
  try{cached=requireNativeModule<NativeTikTokEvents>('CaliskanTiktokAppEvents');}
  catch{cached=null;}
  return cached;
}
