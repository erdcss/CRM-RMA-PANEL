import * as Notifications from "expo-notifications";
import Constants from "expo-constants";
import { Platform } from "react-native";
import { localAuth } from "@/lib/supabase";

export async function registerB2BPush(){
 const permission=await Notifications.requestPermissionsAsync();
 if(permission.status!=="granted") return false;
 if(Platform.OS==="android") await Notifications.setNotificationChannelAsync("default",{name:"Genel Bildirimler",importance:Notifications.AndroidImportance.HIGH,sound:"default"});
 const projectId=Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
 const token=(await Notifications.getExpoPushTokenAsync(projectId?{projectId}:undefined)).data;
 const session=await localAuth.getSession(); if(!session?.access_token)return false;
 const api=(process.env.EXPO_PUBLIC_API_URL||"").replace(/\/$/,"");
 const r=await fetch(`${api}/api/push/register`,{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${session.access_token}`},body:JSON.stringify({app:"b2b",expoToken:token,platform:Platform.OS})});
 return r.ok;
}
