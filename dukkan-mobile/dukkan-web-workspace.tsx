import React,{useMemo,useState} from "react";
import {ActivityIndicator,Linking,Pressable,Text,View} from "react-native";
import {WebView} from "react-native-webview";

const ORIGIN="https://admin.ecalisgan.com";
// Native-only web presentation: preserve web controls while softening typography
// on screens opened inside the iOS/Android app. No global website CSS change.
const MOBILE_TYPOGRAPHY=`(function(){
  var style=document.createElement("style");
  style.textContent="body,body * {letter-spacing:normal !important;}"+
    "body .font-black,body .font-extrabold,body .font-bold,body h1,body h2,body h3 {font-weight:500 !important;}"+
    "body .font-semibold,body .font-medium {font-weight:400 !important;}";
  (document.head||document.documentElement).appendChild(style);
})(); true;`;
export type WebModule="overview"|"sales"|"purchases"|"products"|"stock"|"orders"|
  "instruments"|"banks"|"parties"|"suppliers"|"reports"|"settings";

export function DukkanWebWorkspace({token,storeId,module="overview",onClose}:{
  token:string;storeId:number;module?:WebModule;onClose:()=>void;
}){
  const [loading,setLoading]=useState(true);
  const [error,setError]=useState("");
  const [retry,setRetry]=useState(0);
  const request=useMemo(()=>({
    uri:ORIGIN+"/api/dukkan/mobile-web-session",
    method:"POST" as const,
    headers:{"Content-Type":"application/json"},
    body:JSON.stringify({token,storeId,tab:module}),
  }),[token,storeId,module,retry]);
  const allowed=(url:string)=>url==="about:blank"||
    url.startsWith("blob:"+ORIGIN+"/")||
    url===ORIGIN||url.startsWith(ORIGIN+"/")||url.startsWith(ORIGIN+"?");
  return <View style={{flex:1,backgroundColor:"#f4f7fb"}}>
    <View style={{paddingHorizontal:16,paddingVertical:11,flexDirection:"row",
      alignItems:"center",justifyContent:"space-between",backgroundColor:"#eaf1fa"}}>
      <View style={{flex:1}}>
        <Text style={{fontWeight:"600",fontSize:16,color:"#122d50"}}>Tam Yönetim</Text>
        <Text style={{color:"#506781",fontSize:11,marginTop:3}}>Web panelindeki mağaza yetkileriniz geçerlidir</Text>
      </View>
      <Pressable accessibilityRole="button" onPress={onClose}
        style={{padding:10,borderRadius:10,backgroundColor:"#d8e7f7"}}>
        <Text style={{fontWeight:"500",color:"#164a7d"}}>Kapat</Text>
      </Pressable>
    </View>
    {error?<View style={{padding:20,gap:12}}>
      <Text style={{color:"#b42331",fontWeight:"500"}}>{error}</Text>
      <Pressable accessibilityRole="button" onPress={()=>{setError("");setLoading(true);setRetry(v=>v+1);}}
        style={{padding:12,backgroundColor:"#154d83",borderRadius:12}}>
        <Text style={{color:"white",fontWeight:"500",textAlign:"center"}}>Tekrar dene</Text>
      </Pressable>
    </View>:null}
    <WebView key={storeId+"-"+module+"-"+retry}
      style={{flex:1,opacity:error?0:1}}
      source={request}
      incognito
      sharedCookiesEnabled={false}
      thirdPartyCookiesEnabled={false}
      originWhitelist={[ORIGIN,"blob:*","about:blank"]}
      javaScriptEnabled
      injectedJavaScriptBeforeContentLoaded={MOBILE_TYPOGRAPHY}
      domStorageEnabled
      startInLoadingState
      onLoadStart={()=>setLoading(true)}
      onLoadEnd={()=>setLoading(false)}
      onHttpError={event=>{
        if(event.nativeEvent.statusCode>=400&&
          event.nativeEvent.url.startsWith(ORIGIN+"/api/dukkan/mobile-web-session"))
          setError("İşlem erişimi reddedildi veya oturum açılamadı (HTTP "+
            event.nativeEvent.statusCode+").");
      }}
      onError={()=>{setLoading(false);setError("Güvenli mağaza bağlantısı kurulamadı.");}}
      onShouldStartLoadWithRequest={event=>{
        if(allowed(event.url))return true;
        if(/^https:\/\//i.test(event.url))void Linking.openURL(event.url).catch(()=>undefined);
        return false;
      }}
      allowsBackForwardNavigationGestures
      bounces={false}
      setSupportMultipleWindows={false}
    />
    {loading&&!error?<View pointerEvents="none" style={{position:"absolute",top:78,right:14,
      padding:8,backgroundColor:"#ffffffcc",borderRadius:8}}>
      <ActivityIndicator color="#154d83" size="small"/>
    </View>:null}
  </View>;
}
