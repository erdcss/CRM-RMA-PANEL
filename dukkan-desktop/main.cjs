const { app, BrowserWindow, shell, dialog, Menu, net, nativeImage, ipcMain } = require("electron");
const path=require("node:path");

const TARGET = process.env.DUKKAN_URL || "https://admin.ecalisgan.com/dukkan";
const base = new URL(TARGET);
if (base.protocol !== "https:" && !(base.hostname === "localhost" && base.protocol === "http:")) {
  throw new Error("Çalışkan Dükkan yalnızca HTTPS üzerinden açılabilir");
}

function permitted(url) {
  try {
    const value = new URL(url);
    return value.origin === base.origin;
  } catch { return false; }
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 940,
    minHeight: 620,
    show: false,
    title: "Çalışkan Dükkan",
    backgroundColor: "#f5f7fb",
    // Use the native OS caption: Windows handles drag, double-click maximize,
    // restore-and-drag and Snap without relying on remote page CSS.
    frame: true,
    titleBarStyle: "default",
    movable: true,
    resizable: true,
    minimizable: true,
    maximizable: true,
    closable: true,
    icon: undefined,
    webPreferences: {
      preload:path.join(__dirname,"preload.cjs"),
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });
  win.once("ready-to-show", () => win.show());
  // The administrator-uploaded Dükkan logo is also the runtime Windows application icon.
  if (process.platform === "win32") {
    void (async () => {
      try {
        const response = await net.fetch(new URL("/api/public/branding", base.origin).toString());
        if (!response.ok) return;
        const branding = await response.json();
        const logo = branding?.dukkan_logo;
        if (typeof logo !== "string" || !logo.startsWith("/api/public/branding-asset/dukkan_logo?")) return;
        const imageResponse = await net.fetch(new URL(logo, base.origin).toString());
        if (!imageResponse.ok || !String(imageResponse.headers.get("content-type")||"").startsWith("image/")) return;
        const bytes = Buffer.from(await imageResponse.arrayBuffer());
        if (bytes.byteLength > 9_000_000) return;
        const icon = nativeImage.createFromBuffer(bytes);
        if (!icon.isEmpty() && !win.isDestroyed()) win.setIcon(icon);
      } catch (error) { console.warn("Dükkan logosu yüklenemedi:", error.message); }
    })();
  }
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith("https://")) void shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (event, url) => {
    if (!permitted(url)) {
      event.preventDefault();
      if (url.startsWith("https://")) void shell.openExternal(url);
    }
  });
  win.loadURL(base.toString()).catch((error) => {
    dialog.showErrorBox("Çalışkan Dükkan", "Sunucuya bağlanılamadı: " + error.message);
  });
}

// Isolated, fixed-size print channel. No arbitrary HTML, paths or printer
// options cross the remote-page boundary; only a validated label PNG.
let labelPrinting=false;
ipcMain.handle("dukkan:print-shipping-label",async(event,png)=>{
  if(!event.senderFrame||event.senderFrame!==event.sender.mainFrame||!permitted(event.senderFrame.url))
    return {ok:false,error:"Yetkisiz yazdırma isteği."};
  if(labelPrinting)return {ok:false,error:"Bir etiket zaten yazdırılıyor."};
  if(typeof png!=="string"||png.length>8000000||!/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(png))
    return {ok:false,error:"Geçersiz etiket görseli."};
  labelPrinting=true;
  let printWindow;
  try{
    const bytes=Buffer.from(png.slice("data:image/png;base64,".length),"base64");
    // Check PNG signature and IHDR dimensions before native image decoding.
    if(bytes.length<33||bytes.subarray(0,8).toString("hex")!=="89504e470d0a1a0a"||
       bytes.toString("ascii",12,16)!=="IHDR"||bytes.readUInt32BE(16)!==1200||bytes.readUInt32BE(20)!==1800)
      throw Error("Etiket ölçüsü geçersiz.");
    const image=nativeImage.createFromBuffer(bytes);
    if(image.isEmpty())throw Error("Etiket görseli okunamadı.");
    const safeImage=image.toDataURL();
    printWindow=new BrowserWindow({show:false,width:400,height:600,webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true,webSecurity:true}});
    printWindow.webContents.setWindowOpenHandler(()=>({action:"deny"}));
    const html='<!doctype html><html><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'"><style>@page{size:100mm 150mm;margin:0}html,body{width:100%;height:100%;margin:0;padding:0;overflow:hidden}img{position:fixed;left:3mm;top:4.5mm;width:94mm;height:141mm;display:block;object-fit:contain;break-inside:avoid}</style></head><body><img src="'+safeImage+'"></body></html>';
    await printWindow.loadURL("data:text/html;charset=utf-8,"+encodeURIComponent(html));
    await printWindow.webContents.executeJavaScript("document.images[0].decode()");
    return await new Promise(resolve=>printWindow.webContents.print({
      silent:false,printBackground:true,landscape:false,color:false,copies:1,
      pageSize:{width:100000,height:150000},margins:{marginType:"none"},scaleFactor:100,
      header:"",footer:""
    },(success,reason)=>resolve(success?{ok:true}:{ok:false,error:/cancel/i.test(reason||"")?"cancelled":reason||"Yazdırma başarısız."})));
  }catch(e){return {ok:false,error:String(e.message||e)};}
  finally{if(printWindow&&!printWindow.isDestroyed())printWindow.destroy();labelPrinting=false;}
});

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
