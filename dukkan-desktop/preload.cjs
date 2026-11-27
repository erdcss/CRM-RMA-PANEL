"use strict";
const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("caliskanDukkan",Object.freeze({
  printShippingLabel:(png)=>ipcRenderer.invoke("dukkan:print-shipping-label",png)
}));
