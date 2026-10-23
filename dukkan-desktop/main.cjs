const { app, BrowserWindow, shell, dialog } = require("electron");
const path = require("node:path");

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
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      webSecurity: true
    }
  });
  win.once("ready-to-show", () => win.show());
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

app.whenReady().then(() => {
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
