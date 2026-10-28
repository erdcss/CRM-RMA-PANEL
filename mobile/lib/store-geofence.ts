import {Alert,Platform} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import * as Notifications from 'expo-notifications';

const TASK='caliskan-store-nearby-v1';
const CONSENT_PREFIX='b2b-store-nearby-consent:';
const ACTIVE='b2b-store-nearby-user';
const SENT_PREFIX='b2b-store-nearby-sent:';
const ZONE='Europe/Istanbul';
// Mahmutbey İSTOÇ 19. Ada 2438. Sokak No:23.
// Centre is approximate based on nearby mapped addresses; confirm precise
// storefront coordinates before deploying this as a production campaign.
const STORE={identifier:'caliskan-istoc-19-ada-23',latitude:41.06383,longitude:28.82002,radius:3000,notifyOnEnter:true,notifyOnExit:false};
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
   const key=SENT_PREFIX+userId+':'+istanbulDate();
   if(await AsyncStorage.getItem(key))return;
   const p=await Notifications.getPermissionsAsync();
   if(!p.granted)return;
   // Set before dispatch so process restarts/duplicate geofence events cannot spam.
   await AsyncStorage.setItem(key,'sent');
   try{
     await Notifications.scheduleNotificationAsync({content:{
       title:'Çalışkan B2B',
       body:'Çalışkan’a uğramayı unutmayın! Yakınınızdayız.',
       sound:'b2b-custom.wav',
       data:{kind:'store_nearby'},
     },trigger:null});
   }catch(error){await AsyncStorage.removeItem(key);throw error;}
 }catch(error){console.warn('[store-geofence] notification:',error);}
 finally{dispatching=false;}
}
// TaskManager tasks must be registered at module scope, not inside React hooks.
TaskManager.defineTask(TASK,async ({data,error})=>{
  if(error||!data)return;
  const event=data as {eventType:number;region?:Location.LocationRegion};
  if(event.eventType!==Location.GeofencingEventType.Enter)return;
  const user=await AsyncStorage.getItem(ACTIVE);
  if(user)await notifyOnce(user);
});
async function checkCurrentlyNearby(user:string){
  try{
    const p=await Location.getLastKnownPositionAsync({maxAge:120000,requiredAccuracy:250});
    const loc=p||await Location.getCurrentPositionAsync({accuracy:Location.Accuracy.Balanced});
    if(loc.coords.accuracy&&loc.coords.accuracy>1000)return;
    if(distanceMeters(loc.coords,STORE)<=STORE.radius)await notifyOnce(user);
  }catch{/* GPS temporarily unavailable: geofence entry event remains active. */}
}
export async function stopStoreNearby(){
  if(Platform.OS==='web')return;
  try{if(await Location.hasStartedGeofencingAsync(TASK))await Location.stopGeofencingAsync(TASK);}catch{}
  await AsyncStorage.removeItem(ACTIVE);
}
export async function revokeStoreNearby(user:string){
  await AsyncStorage.setItem(CONSENT_PREFIX+user,'no');
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
  if(!foreground.granted||!background.granted||!notice.granted)return;
  await AsyncStorage.setItem(ACTIVE,user);
  const active=await Location.hasStartedGeofencingAsync(TASK);
  if(!active)await Location.startGeofencingAsync(TASK,[STORE]);
  await checkCurrentlyNearby(user);
}
export async function configureStoreNearby(user:string){
  if(Platform.OS==='web')return;
  if(await AsyncStorage.getItem(CONSENT_PREFIX+user)==='yes'){
    await startForUser(user).catch(err=>console.warn('[store-geofence] start:',err));
    return;
  }
  if(await AsyncStorage.getItem(CONSENT_PREFIX+user))return;
  // Not a settings toggle: explicit, optional, one-time opt-in disclosure.
  Alert.alert('Yakındaki Çalışkan mağazası',
    'İSTOÇ’taki mağazamızın 3 km çevresine girdiğinizde günde en fazla bir kez hatırlatma almak ister misiniz? Uygulama arka plandayken de konum kullanılabilir. Konum geçmişi sunucumuza gönderilmez. Bu izni Bildirimler ekranından durdurabilirsiniz.',
    [{text:'İstemiyorum',style:'cancel',onPress:()=>{void AsyncStorage.setItem(CONSENT_PREFIX+user,'no');}},
     {text:'İzin ver',onPress:()=>{void (async()=>{
       try{
         const notification=await Notifications.requestPermissionsAsync();
         if(!notification.granted)return;
         const fg=await Location.requestForegroundPermissionsAsync();
         if(!fg.granted)return;
         const bg=await Location.requestBackgroundPermissionsAsync();
         if(!bg.granted){Alert.alert('Konum izni','iPhone Ayarları > Çalışkan B2B > Konum > Her Zaman seçeneğine izin vermelisiniz.');return;}
         await AsyncStorage.setItem(CONSENT_PREFIX+user,'yes');
         await startForUser(user);
       }catch(error){console.warn('[store-geofence] opt-in:',error);}
     })();}}],
  );
}
