import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { localAuth } from '@/lib/supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

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
    return r.ok;
  }catch(error) {
    console.warn('[push] B2B device registration unavailable:',error);
    return false;
  }
}
