const { app, BrowserWindow, shell, dialog, Menu, net, nativeImage } = require("electron");

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

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  createWindow();
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});
app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
