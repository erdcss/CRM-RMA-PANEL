"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
test("mobil ve Windows SQLite şeması birebir aynı",()=>{
 const desktop=fs.readFileSync(path.join(root,"caliskan-dukkan-offline/backend.cjs"),"utf8");
 const mobile=fs.readFileSync(path.join(root,"dukkan-mobile/local-db.ts"),"utf8");
 const marker="const schema=String.raw"+String.fromCharCode(96);
 assert.ok(desktop.includes(marker),"Windows SQL şeması bulunamadı");
 const expected=desktop.split(marker)[1].split(String.fromCharCode(96)+";")[0];
 const exportLine=mobile.split("\n").find(x=>x.startsWith("export const DUKKAN_SCHEMA = "));
 assert.ok(exportLine,"Mobil SQL şeması bulunamadı");
 const actual=JSON.parse(exportLine.slice("export const DUKKAN_SCHEMA = ".length,-1));
 assert.equal(actual,expected,"Farklı SQLite şemaları veri transferini bozabilir");
});
test("Native UI web yönetim panelini açmıyor",()=>{
 const ui=fs.readFileSync(path.join(root,"dukkan-mobile/App.tsx"),"utf8");
 assert.ok(ui.includes('from "./local-db"'));
 assert.ok(!ui.includes("react-native-webview"));
 assert.ok(!ui.includes("admin.ecalisgan.com"));
});
test("TestFlight bundle ID sabit",()=>{
 const expo=JSON.parse(fs.readFileSync(path.join(root,"dukkan-mobile/app.json"),"utf8"));
 assert.equal(expo.expo.ios.bundleIdentifier,"com.caliskan.dukkan");
 assert.equal(expo.expo.name,"Çalışkan Dükkan");
});
