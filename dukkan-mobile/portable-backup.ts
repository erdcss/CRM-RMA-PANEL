import * as SQLite from "expo-sqlite";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import * as DocumentPicker from "expo-document-picker";
import {closeDb,getDb} from "./local-db";

// Windows and mobile use a common SQLite schema; transfer is a full, explicit
// replacement with user confirmation, never concurrent, real-time sync.
const dbName="dukkan.sqlite";
const nativePath=()=>SQLite.defaultDatabaseDirectory.replace(/\/$/,"")+"/"+dbName;
const unique=()=>new Date().toISOString().replace(/[:.]/g,"-");
function ensureFileSystem(){
 if(!FileSystem.cacheDirectory||!FileSystem.documentDirectory)throw new Error("Uygulama depolama alanı bulunamadı");
}
async function exists(uri:string){return (await FileSystem.getInfoAsync(uri)).exists;}
async function safeDelete(uri:string){if(await exists(uri))await FileSystem.deleteAsync(uri,{idempotent:true});}
async function normalizedExport(){
 ensureFileSystem();
 const db=await getDb();
 await db.execAsync("PRAGMA wal_checkpoint(TRUNCATE)");
 await closeDb();
 const path=(FileSystem.cacheDirectory as string)+"Caliskan-Dukkan-Yedek-"+unique()+".sqlite";
 try {
  await FileSystem.copyAsync({from:nativePath(),to:path});
  if(!(await exists(path)))throw new Error("Yedek dosyası oluşturulamadı");
  return path;
 }finally{await getDb();}
}
export async function exportBackup(){
 const path=await normalizedExport();
 if(!await Sharing.isAvailableAsync())throw new Error("Paylaşım bu cihazda desteklenmiyor");
 await Sharing.shareAsync(path,{mimeType:"application/x-sqlite3",dialogTitle:"Çalışkan Dükkan yedeği",UTI:"public.database"});
}
export async function importBackup():Promise<boolean>{
 ensureFileSystem();
 const r=await DocumentPicker.getDocumentAsync({type:"*/*",copyToCacheDirectory:true,multiple:false});
 if(r.canceled||!r.assets[0])return false;
 const asset=r.assets[0];
 if(asset.size && asset.size>100_000_000)throw new Error("Yedek dosyası 100 MB sınırını aşıyor");
 const stagingName="dukkan-import.sqlite";
 const stage=SQLite.defaultDatabaseDirectory.replace(/\/$/,"")+"/"+stagingName;
 await safeDelete(stage);
 await FileSystem.copyAsync({from:asset.uri,to:stage});
 let test:SQLite.SQLiteDatabase|undefined;
 try{
  test=await SQLite.openDatabaseAsync(stagingName);
  const check=await test.getFirstAsync<{integrity_check:string}>("PRAGMA integrity_check");
  if(check?.integrity_check!=="ok")throw new Error("Veritabanı bozuk");
  const tables=await test.getAllAsync<{name:string}>("SELECT name FROM sqlite_master WHERE type='table'");
  const names=new Set(tables.map(x=>x.name));
  for(const required of ["settings","parties","products","invoices","invoice_lines","ledger","payments","banks","bank_movements","cash_movements","instruments","orders","order_lines","stock_movements"]){
   if(!names.has(required))throw new Error("Geçersiz Çalışkan Dükkan yedeği: "+required);
  }
  const relations=await test.getAllAsync("PRAGMA foreign_key_check");
  if(relations.length)throw new Error("Yedek ilişkisel bütünlük kontrolünden geçemedi");
 }finally{if(test)await test.closeAsync();}
 // Preserve a rollback copy in app documents. This is not an automatic cloud backup.
 const rollback=(FileSystem.documentDirectory as string)+"Dukkan-Eski-Yedek-"+unique()+".sqlite";
 const db=await getDb();await db.execAsync("PRAGMA wal_checkpoint(TRUNCATE)");
 await closeDb();
 let swapped=false;
 try{
  await FileSystem.copyAsync({from:nativePath(),to:rollback});
  await SQLite.deleteDatabaseAsync(dbName);
  for(const suffix of ["-wal","-shm","-journal"])await safeDelete(nativePath()+suffix);
  await FileSystem.copyAsync({from:stage,to:nativePath()});
  await getDb();
  swapped=true;
 }catch(error){
  await closeDb();
  await SQLite.deleteDatabaseAsync(dbName).catch(()=>{});
  await FileSystem.copyAsync({from:rollback,to:nativePath()});
  await getDb();
  throw error;
 }finally{
  await safeDelete(stage);
 }
 return swapped;
}
