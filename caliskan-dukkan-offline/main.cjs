"use strict";
const {app,BrowserWindow,ipcMain,dialog}=require("electron");
const fs=require("node:fs");
const path=require("node:path");
const {initialize,execute,backup,restore,invoiceHTML}=require("./backend.cjs");
let mainWindow;
function windowCreate(){
  mainWindow=new BrowserWindow({
    width:1450,height:940,minWidth:1050,minHeight:690,
    title:"Çalışkan Dükkan — Ön Muhasebe",backgroundColor:"#f4f6fa",
    autoHideMenuBar:true,
    webPreferences:{preload:path.join(__dirname,"preload.cjs"),nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}
  });
  mainWindow.webContents.setWindowOpenHandler(()=>({action:"deny"}));
  mainWindow.webContents.on("will-navigate",(e,url)=>{if(!url.startsWith("file://"))e.preventDefault();});
  mainWindow.loadFile("index.html");
  mainWindow.on("closed",()=>{mainWindow=null;});
}
app.whenReady().then(async()=>{
  const dataDir=app.getPath("userData");
  await initialize(path.join(dataDir,"dukkan.sqlite"));
  ipcMain.handle("dukkan:call",async(_e,command,data)=>{try{return {ok:true,data:await execute(command,data||{})};}catch(e){return {ok:false,error:e.message||"İşlem başarısız"};}});
  ipcMain.handle("dukkan:version",()=>app.getVersion());
  ipcMain.handle("dukkan:backup",async()=>{
    const r=await dialog.showSaveDialog(mainWindow,{title:"Veritabanı yedeğini kaydet",defaultPath:"Caliskan-Dukkan-Yedek-"+new Date().toISOString().slice(0,10)+".sqlite",filters:[{name:"SQLite",extensions:["sqlite"]}]});
    if(r.canceled||!r.filePath)return {cancelled:true};
    fs.writeFileSync(r.filePath,backup());return {ok:true,path:r.filePath};
  });
  ipcMain.handle("dukkan:restore",async()=>{
    const r=await dialog.showOpenDialog(mainWindow,{title:"Veritabanı yedeğini geri yükle",properties:["openFile"],filters:[{name:"SQLite",extensions:["sqlite","db"]}]});
    if(r.canceled||!r.filePaths[0])return {cancelled:true};
    const choice=await dialog.showMessageBox(mainWindow,{type:"warning",buttons:["Vazgeç","Mevcut verileri değiştir"],defaultId:0,cancelId:0,title:"Yedeği geri yükle",message:"Mevcut tüm Çalışkan Dükkan kayıtları, seçtiğiniz yedekle değiştirilecektir. Önce ayrıca yedek almanız önerilir."});
    if(choice.response!==1)return {cancelled:true};
    try{restore(fs.readFileSync(r.filePaths[0]));mainWindow.reload();return {ok:true};}catch(e){return {ok:false,error:e.message};}
  });
  ipcMain.handle("dukkan:print",async(_e,id)=>{
    try{
      const html=invoiceHTML(id);
      const win=new BrowserWindow({width:850,height:1080,show:true,autoHideMenuBar:true,webPreferences:{nodeIntegration:false,sandbox:true,contextIsolation:true}});
      win.webContents.setWindowOpenHandler(()=>({action:"deny"}));
      await win.loadURL("data:text/html;charset=utf-8,"+encodeURIComponent(html));
      return {ok:true};
    }catch(e){return {ok:false,error:e.message};}
  });
  windowCreate();
  app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)windowCreate();});
}).catch(e=>{dialog.showErrorBox("Çalışkan Dükkan başlatılamadı",String(e.stack||e));app.quit();});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
