"use strict";
const {contextBridge,ipcRenderer}=require("electron");
contextBridge.exposeInMainWorld("dukkan",Object.freeze({
  call:(command,payload={})=>ipcRenderer.invoke("dukkan:call",command,payload),
  backup:()=>ipcRenderer.invoke("dukkan:backup"),
  restore:()=>ipcRenderer.invoke("dukkan:restore"),
  print:(id)=>ipcRenderer.invoke("dukkan:print",id),
  version:()=>ipcRenderer.invoke("dukkan:version")
}));
