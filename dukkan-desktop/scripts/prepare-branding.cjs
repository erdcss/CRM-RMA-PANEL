"use strict";
const fs=require("node:fs");
const path=require("node:path");
const sharp=require("sharp");
const ORIGIN=process.env.DUKKAN_BRANDING_ORIGIN||"https://admin.ecalisgan.com";
async function run(){
 const origin=new URL(ORIGIN);
 if(origin.protocol!=="https:")throw Error("Branding kaynağı HTTPS olmalıdır");
 const response=await fetch(new URL("/api/public/branding",origin),{signal:AbortSignal.timeout(20000)});
 if(!response.ok)throw Error("Çalışkan Dükkan logo ayarları yüklenemedi");
 const branding=await response.json();
 if(typeof branding?.dukkan_logo!=="string"||!branding.dukkan_logo.startsWith("/api/public/branding-asset/dukkan_logo?"))
  throw Error("Çalışkan Dükkan logosu yönetim panelinde kaydedilmeli");
 const target=new URL(branding.dukkan_logo,origin);
 if(target.origin!==origin.origin)throw Error("Geçersiz logo adresi");
 const image=await fetch(target,{signal:AbortSignal.timeout(30000)});
 if(!image.ok||!String(image.headers.get("content-type")||"").startsWith("image/"))
  throw Error("Logo görseli okunamadı");
 const bytes=Buffer.from(await image.arrayBuffer());
 if(bytes.length<500||bytes.length>9_000_000)throw Error("Logo boyutu geçersiz");
 const dest=path.join(__dirname,"..","dukkan-icon.png");
 await sharp(bytes,{limitInputPixels:40000000}).resize(512,512,{fit:"contain",background:"#ffffff"}).png().toFile(dest);
 console.log("Windows uygulama ikonu yönetim panelindeki Çalışkan Dükkan logosundan üretildi.");
}
run().catch(e=>{console.error(e.message);process.exitCode=1;});
