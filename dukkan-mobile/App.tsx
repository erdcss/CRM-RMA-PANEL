import React, { useEffect, useRef, useState } from "react";
import { ActivityIndicator, BackHandler, Image, Linking, SafeAreaView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import { WebView } from "react-native-webview";

const TARGET = process.env.EXPO_PUBLIC_DUKKAN_URL || "https://admin.ecalisgan.com/dukkan";
const ORIGIN = new URL(TARGET).origin;

export default function App() {
  const web = useRef<WebView>(null);
  const [canBack,setCanBack]=useState(false);
  const [loading,setLoading]=useState(true);
  const [logo,setLogo]=useState<string|null>(null);
  const [splash,setSplash]=useState<string|null>(null);
  useEffect(()=>{
    let alive=true;
    fetch(ORIGIN+"/api/public/mobile-branding/dukkan",{cache:"no-store"}).then(r=>r.json()).then(data=>{
      const asset=(v: unknown) => typeof v==="string" && v ? new URL(v,ORIGIN).toString() : null;
      if(alive){setLogo(asset(data.logo));setSplash(asset(data.splash));}
    }).catch(()=>{});
    return()=>{alive=false;};
  },[]);
  useEffect(()=>{
    const listener=BackHandler.addEventListener("hardwareBackPress",()=>{
      if(canBack){web.current?.goBack();return true;}return false;
    });
    return()=>listener.remove();
  },[canBack]);
  return <SafeAreaView style={{flex:1,backgroundColor:"#f5f7fb"}}>
    <StatusBar style="dark"/>
    <WebView
      ref={web}
      source={{uri:TARGET}}
      style={{flex:1}}
      sharedCookiesEnabled
      thirdPartyCookiesEnabled={false}
      javaScriptEnabled
      domStorageEnabled
      allowsBackForwardNavigationGestures
      onNavigationStateChange={state=>setCanBack(state.canGoBack)}
      onLoadEnd={()=>setLoading(false)}
      onShouldStartLoadWithRequest={request=>{
        try{
          if(new URL(request.url).origin===ORIGIN)return true;
          if(request.url.startsWith("https://"))void Linking.openURL(request.url);
        }catch{}
        return false;
      }}
      renderError={()=> <View style={{flex:1,alignItems:"center",justifyContent:"center",padding:24}}><Text style={{fontSize:17,fontWeight:"700"}}>Sunucuya bağlanılamadı</Text><Text>İnternet bağlantısını kontrol edip uygulamayı yeniden açın.</Text></View>}
    />
    {loading && <View style={{position:"absolute",inset:0,alignItems:"center",justifyContent:"center",backgroundColor:"#f5f7fb"}}>
      {splash?<Image source={{uri:splash}} resizeMode="contain" style={{width:"95%",height:"65%"}}/>:logo?<Image source={{uri:logo}} resizeMode="contain" style={{width:144,height:144}}/>:<Text style={{fontSize:25,fontWeight:"900",color:"#111827"}}>Çalışkan Dükkan</Text>}
      <ActivityIndicator size="large" color="#111827" style={{marginTop:28}}/>
    </View>}
  </SafeAreaView>;
}
