import {Alert,Linking,Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';
import {localAuth} from '@/lib/supabase';

const TASK='caliskan-store-nearby-v1';
const CONSENT_PREFIX='b2b-store-nearby-consent:';
const ACTIVE='b2b-store-nearby-user';
const SENT_PREFIX='b2b-store-nearby-sent:';
const ZONE='Europe/Istanbul';
type LocationConfig={enabled:boolean;coordinates_verified:boolean;latitude:number;longitude:number;
 radius_m:number;start_hour:number;end_hour:number;title:string;message:string;updated_at:string};
const CONFIG_KEY='b2b-location-campaign-config';
const DEVICE_KEY='b2b-location-device-id';
const API=(process.env.EXPO_PUBLIC_API_URL||'https://b2b.ecalisgan.com').replace(/\/$/,'');
async function deviceId(){
 let id=await AsyncStorage.getItem(DEVICE_KEY);
 if(!id){id='b2b'+Date.now().toString(36)+Math.random().toString(36).slice(2)+Math.random().toString(36).slice(2);
  await AsyncStorage.setItem(DEVICE_KEY,id);}
 return id;
}
async function authenticatedPost(path:string,body:Record<string,unknown>){
 const session=await localAuth.getSession();
 if(!session?.access_token)return null;
 return fetch(API+path,{method:'POST',headers:{'Content-Type':'application/json',
  Authorization:'Bearer '+session.access_token},body:JSON.stringify(body),signal:AbortSignal.timeout(7000)});
}
async function cachedConfig():Promise<LocationConfig|null>{
 try{
  const value=await AsyncStorage.getItem(CONFIG_KEY);
  return value?JSON.parse(value) as LocationConfig:null;
 }catch{return null;}
}
async function refreshConfig():Promise<LocationConfig|null>{
 try{
  const session=await localAuth.getSession();
  if(!session?.access_token)return null;
  const response=await fetch(API+'/api/b2b/location/config',{headers:{
   Authorization:'Bearer '+session.access_token},signal:AbortSignal.timeout(7000)});
  if(!response.ok)return null;
  const cfg=await response.json() as LocationConfig;
  await AsyncStorage.setItem(CONFIG_KEY,JSON.stringify(cfg));
  return cfg;
 }catch{return null;}
}
async function reportPermission(user:string,consented:boolean){
 if(!user||Platform.OS==='web')return;
 try{
  const [background,notifications]=await Promise.all([
   Location.getBackgroundPermissionsAsync(),Notifications.getPermissionsAsync()]);
  await authenticatedPost('/api/b2b/location/consent',{
   deviceId:await deviceId(),consented,
   backgroundPermission:background.granted,notificationsPermission:notifications.granted,
   platform:Platform.OS
  });
 }catch(error){console.warn('[store-geofence] consent report failed',error);}
}
const regionFrom=(cfg:LocationConfig):Location.LocationRegion=>({
 identifier:'caliskan-istoc-store-v2',latitude:cfg.latitude,longitude:cfg.longitude,
 radius:cfg.radius_m,notifyOnEnter:true,notifyOnExit:false
});
let dispatching=false;
function istanbulDate(){
  return new Intl.DateTimeFormat('en-CA',{timeZone:ZONE,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
}
function distanceMeters(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){
  const rad=Math.PI/180,dlat=(a.latitude-b.latitude)*rad,dlon=(a.longitude-b.longitude)*rad;
  const q=Math.sin(dlat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dlon/2)**2;
  return 6371000*2*Math.asin(Math.min(1,Math.sqrt(q)));
}
async function notifyOnce(userId:string){
 if(dispatching||Platform.OS==='web')return;
 dispatching=true;
 try{
   if(await AsyncStorage.getItem(CONSENT_PREFIX+userId)!=='yes')return;
   const cfg=await cachedConfig();
   if(!cfg?.enabled||!cfg.coordinates_verified)return;
   const hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:ZONE,hour:'2-digit',hourCycle:'h23'}).format(new Date()));
   if(hour<cfg.start_hour||hour>=cfg.end_hour)return;
   const key=SENT_PREFIX+userId+':'+istanbulDate();
   if(await AsyncStorage.getItem(key))return;
   const permission=await Notifications.getPermissionsAsync();
   if(!permission.granted)return;
   // Global per-account daily uniqueness is enforced by the backend before any
   // local notification. Offline checks skip rather than risk sending twice.
   const device=await deviceId();
   const response=await authenticatedPost('/api/b2b/location/claim',{deviceId:device});
   if(!response?.ok)return;
   const result=await response.json() as {allowed:boolean;title?:string;message?:string};
   if(!result.allowed)return;
   try{
     await Notifications.scheduleNotificationAsync({content:{
       title:result.title||cfg.title,
       body:result.message||cfg.message,
       sound:Platform.OS==='android'?'b2b_custom.wav':'b2b-custom.wav',
       data:{kind:'store_nearby'},
     },trigger:null});
     await AsyncStorage.setItem(key,'sent');
     void authenticatedPost('/api/b2b/location/receipt',{deviceId:device,status:'scheduled'});
   }catch(error){
     void authenticatedPost('/api/b2b/location/receipt',{deviceId:device,status:'failed'});
     throw error;
   }
 }catch(error){console.warn('[store-geofence] notification:',error);}
 finally{dispatching=false;}
}
// TaskManager tasks must be registered at module scope, not inside React hooks.
TaskManager.defineTask(TASK,async ({data,error})=>{
  if(error||!data)return;
  const event=data as {eventType:number;region?:Location.LocationRegion};
  if(event.eventType!==Location.GeofencingEventType.Enter)return;
  const user=await AsyncStorage.getItem(ACTIVE);
  const cfg=await cachedConfig();
  if(user&&cfg?.enabled&&cfg.coordinates_verified&&event.region?.identifier===regionFrom(cfg).identifier)
    await notifyOnce(user);
});
async function checkCurrentlyNearby(user:string){
  try{
    const p=await Location.getLastKnownPositionAsync({maxAge:120000,requiredAccuracy:250});
    const loc=p||await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
    if(loc.coords.accuracy&&loc.coords.accuracy>1000)return;
    const cfg=await cachedConfig();
    if(cfg?.enabled&&cfg.coordinates_verified&&
      distanceMeters(loc.coords,{latitude:cfg.latitude,longitude:cfg.longitude})<=cfg.radius_m)
      await notifyOnce(user);
  }catch{/* GPS temporarily unavailable: geofence entry event remains active. */}
}
export async function stopStoreNearby(){
  if(Platform.OS==='web')return;
  try{if(await Location.hasStartedGeofencingAsync(TASK))await Location.stopGeofencingAsync(TASK);}catch{}
  await AsyncStorage.removeItem(ACTIVE);
}
export async function revokeStoreNearby(user:string){
  await AsyncStorage.setItem(CONSENT_PREFIX+user,'no');
  await reportPermission(user,false);
  await stopStoreNearby();
}
export async function isStoreNearbyEnabled(user:string){
  return (await AsyncStorage.getItem(CONSENT_PREFIX+user))==='yes';
}
async function startForUser(user:string){
  if(Platform.OS==='web')return;
  const foreground=await Location.getForegroundPermissionsAsync();
  const background=await Location.getBackgroundPermissionsAsync();
  const notice=await Notifications.getPermissionsAsync();
  await reportPermission(user,true);
  if(!foreground.granted||!background.granted||!notice.granted){
    if(await Location.hasStartedGeofencingAsync(TASK))await Location.stopGeofencingAsync(TASK);
    return;
  }
  const cfg=await refreshConfig();
  if(!cfg?.enabled||!cfg.coordinates_verified){
    if(await Location.hasStartedGeofencingAsync(TASK))await Location.stopGeofencingAsync(TASK);
    return;
  }
  await AsyncStorage.setItem(ACTIVE,user);
  await Location.startGeofencingAsync(TASK,[regionFrom(cfg)]);
  await checkCurrentlyNearby(user);
}
// Opt-in is offered after the initial signed-in launch; it can be changed
// later in Settings > Privacy. Android marketing geofencing remains disabled
// by the platform-specific stub and the Google Play manifest policy.
let permissionRequestPending=false;
export async function getStoreNearbyPermissionStatus(user:string){
  if(Platform.OS==='web')return {consented:false,ready:false};
  const [consented,foreground,background,notifications]=await Promise.all([
    isStoreNearbyEnabled(user),Location.getForegroundPermissionsAsync(),
    Location.getBackgroundPermissionsAsync(),Notifications.getPermissionsAsync()
  ]);
  return {consented,ready:consented&&foreground.granted&&background.granted&&notifications.granted};
}
function openPermissionSettings(title:string,message:string){
  Alert.alert(title,message,[
    {text:'Kapat',style:'cancel'},
    {text:'Uygulama ayarları',onPress:()=>{void Linking.openSettings().catch(
      error=>console.warn('[store-geofence] settings:',error));}}
  ]);
}
async function grantStoreNearbyPermissions(user:string):Promise<boolean>{
  if(permissionRequestPending)return false;
  permissionRequestPending=true;
  try{
    const foreground=await Location.getForegroundPermissionsAsync();
    if(!foreground.granted){
      if(!foreground.canAskAgain){
        openPermissionSettings('Konum izni kapalı',
          'Android veya iPhone uygulama ayarlarından Çalışkan B2B için konum erişimini açın.');
        return false;
      }
      const allowed=await Location.requestForegroundPermissionsAsync();
      if(!allowed.granted){
        Alert.alert('Konum izni verilmedi',
          'Mağaza yakınlık hatırlatmaları için uygulama kullanılırken konum izni gereklidir.');
        return false;
      }
    }
    const background=await Location.getBackgroundPermissionsAsync();
    if(!background.granted){
      // On Android 11+ Expo opens the OS permission settings screen here.
      // The user must select "Allow all the time"; never imply consent is automatic.
      const allowed=await Location.requestBackgroundPermissionsAsync();
      if(!allowed.granted){
        openPermissionSettings('Arka plan konum izni gerekli',
          Platform.OS==='android'
            ? 'Android Ayarlar > Uygulamalar > Çalışkan B2B > İzinler > Konum bölümünden "Her zaman izin ver" seçeneğini açın.'
            : 'iPhone Ayarları > Çalışkan B2B > Konum bölümünden "Her Zaman" iznini açın.');
        return false;
      }
    }
    const notification=await Notifications.getPermissionsAsync();
    if(!notification.granted){
      const result=await Notifications.requestPermissionsAsync();
      if(!result.granted){
        openPermissionSettings('Bildirim izni gerekli',
          'Mağaza yakınlık hatırlatmalarını görebilmek için Çalışkan B2B bildirimlerini etkinleştirin.');
        return false;
      }
    }
    await AsyncStorage.setItem(CONSENT_PREFIX+user,'yes');
    await startForUser(user);
    return true;
  }catch(error){
    console.warn('[store-geofence] permission request:',error);
    Alert.alert('Konum izni tamamlanamadı','Lütfen tekrar deneyin veya uygulama izinlerini kontrol edin.');
    return false;
  }finally{permissionRequestPending=false;}
}
export async function requestStoreNearbyOptIn(user:string):Promise<boolean>{
  if(Platform.OS==='web'||!user)return false;
  const cfg=await refreshConfig();
  if(!cfg){
    Alert.alert('Mağaza bilgisi alınamadı',
      'Mağaza konum ayarları sunucudan alınamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.');
    return false;
  }
  if(!cfg.enabled||!cfg.coordinates_verified){
    Alert.alert('Yakınlık bildirimi henüz aktif değil',
      'Mağaza yakınlık kampanyasının yönetici tarafından açılması ve mağaza koordinatlarının doğrulanması gerekiyor.');
    return false;
  }
  return new Promise(resolve=>{
    Alert.alert('Konum verilerinin kullanımı',
      'Çalışkan B2B, isteğe bağlı mağaza yakınlık hatırlatmaları için konum verilerinize uygulama kapalıyken veya kullanılmıyorken de erişir. İSTOÇ mağazamızın 3 km çevresine girdiğinizde günde en fazla bir bildirim gösterir. Konum geçmişiniz sunucuya gönderilmez. Dilediğiniz zaman Ayarlar ekranından kapatabilirsiniz.',
      [
        {text:'Şimdi değil',style:'cancel',onPress:()=>{
          void AsyncStorage.setItem(CONSENT_PREFIX+user,'no');resolve(false);
        }},
        {text:'İzin ver',onPress:()=>{
          void grantStoreNearbyPermissions(user).then(resolve).catch(error=>{
            console.warn('[store-geofence] opt-in:',error);resolve(false);
          });
        }}
      ],{cancelable:false});
  });
}
export async function configureStoreNearby(user:string){
  if(Platform.OS==='web')return;
  const cfg=await refreshConfig();
  if(!cfg?.enabled||!cfg.coordinates_verified){
    // Never request an unused sensitive permission while the campaign is off.
    if(await AsyncStorage.getItem(CONSENT_PREFIX+user)==='yes')
      await reportPermission(user,true);
    await stopStoreNearby();
    return;
  }
  if(await AsyncStorage.getItem(CONSENT_PREFIX+user)==='yes'){
    await startForUser(user).catch(err=>console.warn('[store-geofence] start:',err));
    return;
  }
  // A prior decline must never trigger another automatic prompt.
  if(await AsyncStorage.getItem(CONSENT_PREFIX+user))return;
  await requestStoreNearbyOptIn(user);
}
