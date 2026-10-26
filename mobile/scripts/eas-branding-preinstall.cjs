// Runs BEFORE Expo native prebuild. Uses only Node built-ins before npm install.
// Embed the current iOS launch image so the first frame is not empty. The
// React splash remains live from Admin; the native launch image is only used
// before JavaScript has initialized and requires a new binary to update.
const fs=require("node:fs");
const path=require("node:path");
const {createHash}=require("node:crypto");
const root=path.resolve(__dirname,"..");
const assetsDir=path.join(root,"assets");
const api=(process.env.EXPO_PUBLIC_BRANDING_API_URL||"https://admin.ecalisgan.com").replace(/\/$/,"");

async function fetchAdminWithRetry(url,options={}){
  let lastError;
  for(let attempt=0;attempt<5;attempt++){
    try{
      const response=await fetch(url,{...options,headers:{...(options.headers||{}),"Cache-Control":"no-cache"},signal:AbortSignal.timeout(20000)});
      if(response.ok||![408,429,500,502,503,504].includes(response.status)||attempt===4)return response;
      lastError=new Error("Admin HTTP "+response.status);
    }catch(error){
      lastError=error;
      if(attempt===4)throw error;
    }
    console.warn("[EAS preinstall] Geçici Admin yanıtı, yeniden deneniyor:",String(lastError?.message||lastError));
    await new Promise(resolve=>setTimeout(resolve,Math.min(8000,1200*2**attempt)));
  }
  throw lastError||new Error("Admin bağlantısı kurulamadı");
}
async function download(value,name){
  if(!value||typeof value!=="string")throw Error("Admin panelinde "+name+" bulunmuyor.");
  let bytes,mime;
  if(value.startsWith("data:image/")){
    const match=/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/s.exec(value);
    if(!match)throw Error("Geçersiz "+name+" görseli");
    mime=match[1];bytes=Buffer.from(match[2],"base64");
  }else{
    const url=new URL(value,api);
    if(url.origin!==new URL(api).origin)throw Error("Beklenmeyen görsel kaynağı: "+name);
    const response=await fetchAdminWithRetry(url,{headers:{Accept:"image/*"}});
    if(!response.ok)throw Error(name+" HTTP "+response.status);
    mime=(response.headers.get("content-type")||"").split(";")[0].trim();
    bytes=Buffer.from(await response.arrayBuffer());
  }
  if(!["image/png","image/jpeg","image/webp"].includes(mime)||bytes.length<100||bytes.length>8*1024*1024)
    throw Error(name+" için geçersiz boyut veya format");
  if(name==="splash"&&mime!=="image/png")throw Error("Native B2B splash için PNG yükleyin.");
  if(name==="logo"&&mime!=="image/png")throw Error("Native B2B logo için PNG yükleyin.");
  const ext=mime==="image/png"?"png":mime==="image/jpeg"?"jpg":"webp";
  const hash=createHash("sha256").update(bytes).digest("hex").slice(0,12);
  fs.mkdirSync(assetsDir,{recursive:true});
  const fileName="managed-"+name+"-"+hash+"."+ext;
  fs.writeFileSync(path.join(assetsDir,fileName),bytes);
  return "./assets/"+fileName;
}
async function main(){
  const response=await fetchAdminWithRetry(api+"/api/public/mobile-branding/b2b?t="+Date.now(),{
    headers:{Accept:"application/json"}
  });
  if(!response.ok)throw Error("B2B marka ayarları HTTP "+response.status);
  const branding=await response.json();
  const logo=await download(branding.logo,"logo");
  const splash=branding.splash?await download(branding.splash,"splash"):null;
  const androidIcon=branding.androidIcon?await download(branding.androidIcon,"android-icon"):logo;
  const configPath=path.join(root,"app.json");
  const content=JSON.parse(fs.readFileSync(configPath,"utf8"));
  const expo=content.expo||(content.expo={});
  expo.icon=logo;
  expo.ios=expo.ios||{};expo.ios.icon=logo;
  expo.android=expo.android||{};
  expo.android.adaptiveIcon={
    ...(expo.android.adaptiveIcon||{}),foregroundImage:androidIcon
  };
  // Native SDK54 plugin builds an actual first-frame iOS LaunchScreen image.
  // Legacy ios.splash on its own was producing a blank launch screen.
  expo.plugins=Array.isArray(expo.plugins)?expo.plugins:[];
  expo.plugins=expo.plugins.filter(p=>!(typeof p==="string"?p==="expo-splash-screen":Array.isArray(p)&&p[0]==="expo-splash-screen"));
  expo.plugins.push(["expo-splash-screen",{
    backgroundColor:"#101010",
    enableFullScreenImage_legacy:true,
    ios:{backgroundColor:"#101010",...(splash?{image:splash,resizeMode:"cover"}:{})},
    android:{backgroundColor:"#101010"}
  }]);
  expo.splash=splash?{image:splash,resizeMode:"cover",backgroundColor:"#101010"}:{backgroundColor:"#101010"};
  // Android 12+ uses a system-controlled icon splash; keep the native icon
  // centered while the full-bleed admin-managed image loads in React.
  expo.android.splash={backgroundColor:"#101010"};
  if(splash){
    expo.ios.splash={image:splash,resizeMode:"cover",backgroundColor:"#101010"};
  }else{
    delete expo.ios.splash;
  }
  fs.writeFileSync(configPath,JSON.stringify(content,null,2)+"\n");
  const runtimePath=path.join(root,"lib","managed-splash.ts");
  fs.writeFileSync(runtimePath,"import type { ImageSourcePropType } from 'react-native';\n"+
    "export const managedSplash: ImageSourcePropType | null = null;\n");
  console.log("[EAS preinstall] B2B simgesi ve iOS ilk kare splash senkronlandı:",path.basename(logo),splash?path.basename(splash):"splash kaldırıldı");
}
main().catch(error=>{console.error("[EAS preinstall] Güncel marka varlıkları alınamadığı için build durduruldu:",error.message);process.exit(1);});
