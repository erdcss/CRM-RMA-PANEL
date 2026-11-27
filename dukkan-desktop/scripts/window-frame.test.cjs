const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
test("desktop uses native draggable caption with system window controls",async()=>{
 let options;
 const win={once(){},webContents:{setWindowOpenHandler(){},on(){}},loadURL(){return Promise.resolve();}};
 const electron={app:{whenReady:()=>Promise.resolve(),on(){}},BrowserWindow:class{constructor(opts){options=opts;return win;}},Menu:{setApplicationMenu(){}},shell:{},dialog:{},net:{fetch:async()=>({ok:false})},nativeImage:{}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"..","main.cjs"),"utf8"),{require:(id)=>id==="electron"?electron:require(id),process:{env:{},platform:"win32"},URL,console});
 await Promise.resolve();
 assert.ok(options);
 for(const key of ["frame","movable","resizable","minimizable","maximizable","closable"])assert.equal(options[key],true,key);
 assert.equal(options.titleBarStyle,"default");
 assert.equal(options.titleBarOverlay,undefined);
 assert.equal(options.webPreferences.contextIsolation,true);
 assert.equal(options.webPreferences.sandbox,true);
 assert.equal(options.webPreferences.nodeIntegration,false);
});
