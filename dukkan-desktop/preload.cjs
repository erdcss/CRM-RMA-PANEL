"use strict";
const { ipcRenderer } = require("electron");

// Only visual theme state crosses the isolated desktop preload boundary.
window.addEventListener("DOMContentLoaded", () => {
  const root = document.documentElement;
  const update = () => ipcRenderer.send("dukkan:theme", root.classList.contains("dark"));
  new MutationObserver(update).observe(root,{attributes:true,attributeFilter:["class"]});
  update();
});
