#!/usr/bin/env node
// Run from the Business Expo project: npm run testflight
// Uses the existing EAS "testflight" build & submit profiles for com.caliskangroup.business.
const {spawnSync} = require("node:child_process");
const {resolve} = require("node:path");
const {readFileSync} = require("node:fs");

const cwd=resolve(__dirname,"..");
const app=JSON.parse(readFileSync(resolve(cwd,"app.json"),"utf8")).expo;
const eas=JSON.parse(readFileSync(resolve(cwd,"eas.json"),"utf8"));
if(app?.ios?.bundleIdentifier!=="com.caliskangroup.business"
  || !eas?.build?.testflight || !eas?.submit?.testflight?.ios?.ascAppId){
  console.error("Çalışkan Business TestFlight yapılandırması bulunamadı; B2B uygulaması için yanlışlıkla build oluşturulmayacak.");
  process.exit(1);
}
function command(cmd,args,label){
  console.log("\n=== "+label+" ===");
  // On Windows, npm/npx are .cmd shims and must be executed through cmd.exe.
  // All commands and their arguments are static release instructions.
  const run=spawnSync(cmd,args,{cwd,stdio:"inherit",shell:process.platform==="win32",env:process.env});
  if(run.error) {
    console.error("Komut çalıştırılamadı:",run.error.message);
    process.exit(1);
  }
  if(run.status!==0){
    console.error("\nİşlem durduruldu ("+label+"). Sonraki aşamaya geçilmedi.");
    if(label==="Expo hesabı kontrolü")
      console.error("Önce 'npx eas-cli login' ile kendi Expo hesabınıza giriş yapıp 'npm run testflight' komutunu yeniden çalıştırın.");
    process.exit(run.status||1);
  }
}
command("npx",["--yes","eas-cli","whoami"],"Expo hesabı kontrolü");
command("npm",["run","sync:branding"],"Çalışkan Business logo ve splash senkronizasyonu");
command("npx",["--yes","expo","export","--platform","ios"],"iOS JavaScript paketinin derleme kontrolü");
command("npx",["--yes","eas-cli","build","--platform","ios","--profile","testflight","--non-interactive","--clear-cache","--wait"],"Çalışkan Business iOS TestFlight derlemesi");
command("npx",["--yes","eas-cli","submit","--platform","ios","--profile","testflight","--latest","--non-interactive","--wait"],"App Store Connect / TestFlight gönderimi");
console.log("\nÇalışkan Business TestFlight gönderimi tamamlandı. İşleme durumunu App Store Connect üzerinden kontrol edin.");
