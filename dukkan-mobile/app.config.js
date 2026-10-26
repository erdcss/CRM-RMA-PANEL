const fs=require("node:fs");
const path=require("node:path");

module.exports=({config})=>{
  const icon=path.join(__dirname,"assets","dukkan-icon.png");
  if(!fs.existsSync(icon))return config;
  return {
    ...config,
    icon:"./assets/dukkan-icon.png",
    ios:{...config.ios,icon:"./assets/dukkan-icon.png"},
    android:{...config.android,icon:"./assets/dukkan-icon.png"}
  };
};
