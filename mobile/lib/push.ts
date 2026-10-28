import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import { localAuth } from '@/lib/supabase';

if (Platform.OS !== 'web') {
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});
}

export async function registerB2BPush():Promise<boolean> {
  if(Platform.OS === 'web') return false;
  try {
    if(Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default',{
        name:'Genel Bildirimler',importance:Notifications.AndroidImportance.HIGH,sound:'default'
      });
      await Notifications.setNotificationChannelAsync('b2b-custom',{
        name:'Çalışkan B2B Özel Bildirim',
        importance:Notifications.AndroidImportance.HIGH,
        sound:'b2b-custom.wav',
      }).catch(() => undefined);
    }
    const existing=await Notifications.getPermissionsAsync();
    const permission=existing.granted?existing:await Notifications.requestPermissionsAsync();
    if(!permission.granted) return false;
    const projectId=Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if(!projectId)return false;
    const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
    const session=await localAuth.getSession();
    if(!session?.access_token)return false;
    const api=(process.env.EXPO_PUBLIC_API_URL||'https://b2b.ecalisgan.com').replace(/\/$/,'');
    const r=await fetch(`${api}/api/push/register`,{
      method:'POST',
      headers:{'Content-Type':'application/json',Authorization:`Bearer ${session.access_token}`},
      body:JSON.stringify({app:'b2b',expoToken:token,platform:Platform.OS}),
    });
    if(r.ok)await AsyncStorage.setItem('b2b-last-registered-push-token',token);
    return r.ok;
  }catch(error) {
    console.warn('[push] B2B device registration unavailable:',error);
    return false;
  }
}

/** Register the device as signed out without revoking notification permission.
 * Only this previously authenticated device can be updated. */
export async function markB2BPushSignedOut(accessToken:string):Promise<void>{
  if(Platform.OS==='web'||!accessToken)return;
  const expoToken=await AsyncStorage.getItem('b2b-last-registered-push-token');
  if(!expoToken)return;
  const api=(process.env.EXPO_PUBLIC_API_URL||'https://b2b.ecalisgan.com').replace(/\/$/,'');
  try{
    const response=await fetch(api+'/api/push/session',{
      method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+accessToken},
      body:JSON.stringify({expoToken,sessionActive:false}),
      signal:AbortSignal.timeout(4000),
    });
    if(!response.ok)console.warn('[push] signed-out device state not acknowledged',response.status);
  }catch(error){console.warn('[push] signed-out status unavailable',error);}
}

/** Explicit optional opt-in for users whose signup application is pending.
 * Registration returns a short-lived one-time receipt, not an auth session.
 * This device can only receive admin-selected generic campaign notices until
 * the user later signs in. No account details are exposed here. */
export async function enrollPendingB2BPush(enrollmentToken:string):Promise<boolean>{
  if(Platform.OS==='web'||!enrollmentToken)return false;
  try{
    if(Platform.OS==='android'){
      await Notifications.setNotificationChannelAsync('default',{
        name:'Genel Bildirimler',importance:Notifications.AndroidImportance.HIGH,sound:'default'
      });
    }
    const current=await Notifications.getPermissionsAsync();
    const permission=current.granted?current:await Notifications.requestPermissionsAsync();
    if(!permission.granted)return false;
    const projectId=Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
    if(!projectId)return false;
    const token=(await Notifications.getExpoPushTokenAsync({projectId})).data;
    const api=(process.env.EXPO_PUBLIC_API_URL||'https://b2b.ecalisgan.com').replace(/\/$/,'');
    const response=await fetch(api+'/api/push/b2b-enroll',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({enrollmentToken,expoToken:token,platform:Platform.OS,marketingConsent:true}),
      signal:AbortSignal.timeout(10000),
    });
    if(response.ok){
      await AsyncStorage.setItem('b2b-last-registered-push-token',token);
      return true;
    }
    console.warn('[push] Pending B2B device enrollment failed',response.status);
    return false;
  }catch(error){
    console.warn('[push] Pending B2B notification enrollment unavailable',error);
    return false;
  }
}
