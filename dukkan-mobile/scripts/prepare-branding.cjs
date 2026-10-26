"use strict";
const fs=require("node:fs");
const path=require("node:path");
const sharp=require("sharp");

const ORIGIN=process.env.DUKKAN_BRANDING_ORIGIN||"https://admin.ecalisgan.com";
async function main(){
 const origin=new URL(ORIGIN);
 if(origin.protocol!=="https:")throw new Error("Branding source must be HTTPS");
 const res=await fetch(new URL("/api/public/branding",origin),{signal:AbortSignal.timeout(20000)});
 if(!res.ok)throw Error("Cannot load administrator branding ("+res.status+")");
 const branding=await res.json();
 const logo=branding?.dukkan_logo;
 if(typeof logo!=="string"||!logo.startsWith("/api/public/branding-asset/dukkan_logo?"))
  throw Error("Çalışkan Admin: Dükkan logosu has not been published yet. Do not create a mismatched app build.");
 const imageUrl=new URL(logo,origin);
 if(imageUrl.origin!==origin.origin)throw Error("Untrusted branding URL");
 const image=await fetch(imageUrl,{signal:AbortSignal.timeout(30000)});
 if(!image.ok||!String(image.headers.get("content-type")||"").startsWith("image/"))
  throw Error("Admin logo image is not available as an image");
 const bytes=Buffer.from(await image.arrayBuffer());
 if(bytes.length<500||bytes.length>9_000_000)throw Error("Admin logo size invalid");
 const dest=path.join(__dirname,"..","assets");
 fs.mkdirSync(dest,{recursive:true});
 await sharp(bytes,{limitInputPixels:40000000}).resize(1024,1024,{fit:"contain",background:"#ffffff"}).png().toFile(path.join(dest,"dukkan-icon.png"));
 console.log("Verified Çalışkan Admin Dükkan logo and generated a 1024x1024 native icon.");
}
main().catch(e=>{console.error(e.message);process.exitCode=1;});
