// Runs BEFORE Expo native prebuild. Uses only Node built-ins because npm install
// has not happened yet; this guarantees that a remote EAS build reads the newest
// admin-uploaded icon and splash, rather than a stale checked-in asset.
const fs=require("node:fs");
const path=require("node:path");
const {createHash}=require("node:crypto");
const root=path.resolve(__dirname,"..");
const assetsDir=path.join(root,"assets");
const api=(process.env.EXPO_PUBLIC_BRANDING_API_URL||"https://admin.ecalisgan.com").replace(/\\/$/,"");

async function download(value,name){
  if(!value||typeof value!=="string")throw Error("Admin panelinde "+name+" bulunmuyor.");
  let bytes,mime;
  if(value.startsWith("data:image/")){
    const match=/^data:(image\\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/s.exec(value);
    if(!match)throw Error("Geçersiz "+name+" görseli");
    mime=match[1];bytes=Buffer.from(match[2],"base64");
  }else{
    const url=new URL(value,api);
    if(url.origin!==new URL(api).origin)throw Error("Beklenmeyen görsel kaynağı: "+name);
    const response=await fetch(url,{headers:{Accept:"image/*","Cache-Control":"no-cache"},signal:AbortSignal.timeout(20000)});
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
  const response=await fetch(api+"/api/public/mobile-branding/b2b?t="+Date.now(),{
    headers:{Accept:"application/json","Cache-Control":"no-cache"},signal:AbortSignal.timeout(20000)
  });
  if(!response.ok)throw Error("B2B marka ayarları HTTP "+response.status);
  const branding=await response.json();
  const splash=await download(branding.splash,"splash");
  const logo=await download(branding.logo,"logo");
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
  expo.splash={
    ...(expo.splash||{}),image:splash,resizeMode:"cover",backgroundColor:"#101010"
  };
  fs.writeFileSync(configPath,JSON.stringify(content,null,2)+"\n");
  const runtimePath=path.join(root,"lib","managed-splash.ts");
  fs.writeFileSync(runtimePath,"import type { ImageSourcePropType } from 'react-native';\n"+
    "export const managedSplash: ImageSourcePropType = require('../assets/"+
    path.basename(splash)+"');\n");
  console.log("[EAS preinstall] Güncel B2B splash ve logo derleme kaynaklarına işlendi:",path.basename(splash));
}
main().catch(error=>{console.error("[EAS preinstall] Güncel marka varlıkları alınamadığı için build durduruldu:",error.message);process.exit(1);});
