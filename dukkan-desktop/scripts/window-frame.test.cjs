const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const path=require("node:path");
test("desktop uses native draggable caption with system window controls",async()=>{
 let options;
 const win={once(){},webContents:{setWindowOpenHandler(){},on(){}},loadURL(){return Promise.resolve();}};
 const electron={app:{whenReady:()=>Promise.resolve(),on(){}},BrowserWindow:class{constructor(opts){options=opts;return win;}},Menu:{setApplicationMenu(){}},shell:{},dialog:{},net:{fetch:async()=>({ok:false})},nativeImage:{}};
 electron.ipcMain={handle(){}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,"..","main.cjs"),"utf8"),{require:(id)=>id==="electron"?electron:require(id),process:{env:{},platform:"win32"},URL,console,__dirname:path.join(__dirname,".."),Buffer});
 await Promise.resolve();
 assert.ok(options);
 for(const key of ["frame","movable","resizable","minimizable","maximizable","closable"])assert.equal(options[key],true,key);
 assert.equal(options.titleBarStyle,"default");
 assert.equal(options.titleBarOverlay,undefined);
 assert.equal(options.webPreferences.contextIsolation,true);
 assert.equal(options.webPreferences.sandbox,true);
 assert.equal(options.webPreferences.nodeIntegration,false);
});

test("shipping print uses fixed one-label paper size and rejects invalid input",async()=>{
 let handler;
 const electron={app:{whenReady:()=>new Promise(()=>{}),on(){}},ipcMain:{handle(name,fn){assert.equal(name,"dukkan:print-shipping-label");handler=fn;}},BrowserWindow:class{},shell:{},dialog:{},Menu:{},net:{},nativeImage:{}};
 const source=fs.readFileSync(path.join(__dirname,"..","main.cjs"),"utf8");
 vm.runInNewContext(source,{require:(id)=>id==="electron"?electron:require(id),process:{env:{},platform:"win32"},URL,console,__dirname:path.join(__dirname,".."),Buffer});
 const frame={url:"https://admin.ecalisgan.com/dukkan"};
 assert.equal((await handler({senderFrame:frame,sender:{mainFrame:frame}},"bad")).ok,false);
 const foreign={url:"https://example.com/"};
 assert.equal((await handler({senderFrame:foreign,sender:{mainFrame:foreign}},"bad")).ok,false);
 assert.match(source,/pageSize:\{width:100000,height:150000\}/);
 assert.match(source,/copies:1/);
 assert.match(source,/marginType:"none"/);
 assert.match(source,/landscape:false/);
});
