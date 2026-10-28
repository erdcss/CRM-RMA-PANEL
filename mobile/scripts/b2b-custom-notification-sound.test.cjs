"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { syncB2BCustomSound, validateWav } = require("./b2b-custom-notification-sound.cjs");

function wav({bits=16, channels=1, sampleRate=44100}={}) {
  const audio=Buffer.alloc(256);
  const buf=Buffer.alloc(44+audio.length);
  buf.write("RIFF",0,"ascii");buf.writeUInt32LE(buf.length-8,4);
  buf.write("WAVEfmt ",8,"ascii");buf.writeUInt32LE(16,16);
  buf.writeUInt16LE(1,20);buf.writeUInt16LE(channels,22);
  buf.writeUInt32LE(sampleRate,24);
  const blockAlign=channels*bits/8;
  buf.writeUInt32LE(sampleRate*blockAlign,28);
  buf.writeUInt16LE(blockAlign,32);buf.writeUInt16LE(bits,34);
  buf.write("data",36,"ascii");buf.writeUInt32LE(audio.length,40);
  audio.copy(buf,44);return buf;
}
function response(status, buf) {
  return {
    status, ok:status>=200&&status<300,
    async arrayBuffer(){return Uint8Array.from(buf||[]).buffer;},
  };
}
function sandbox(t) {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),"b2b-sound-"));
  t.after(()=>fs.rmSync(dir,{recursive:true,force:true}));
  return dir;
}
test("valid 16 bit mono WAV is installed into native Expo plugin",async t=>{
  const dir=sandbox(t), bytes=wav(), expo={plugins:["expo-router"]};
  const result=await syncB2BCustomSound({
    api:"https://admin.example",assetsDir:dir,expo,required:true,
    fetchWithRetry:async()=>response(200,bytes),
  });
  assert.deepEqual(result,{included:true,bytes:bytes.length});
  assert.deepEqual(fs.readFileSync(path.join(dir,"b2b-custom.wav")),bytes);
  assert.deepEqual(expo.plugins.at(-1),["expo-notifications",{sounds:["./assets/b2b-custom.wav"]}]);
  assert.equal(expo.plugins.filter(p=>Array.isArray(p)&&p[0]==="expo-notifications").length,1);
});
test("missing custom sound stops a release instead of silently defaulting",async t=>{
  const dir=sandbox(t);
  await assert.rejects(syncB2BCustomSound({
    api:"https://admin.example",assetsDir:dir,expo:{plugins:[]},required:true,
    fetchWithRetry:async()=>response(404),
  }),/TestFlight build durduruldu/);
});
test("optional builds can use the default sound without a stale plugin",async t=>{
  const dir=sandbox(t), expo={plugins:[["expo-notifications",{sounds:["./assets/b2b-custom.wav"]}],"expo-router"]};
  const out=await syncB2BCustomSound({
    api:"https://admin.example",assetsDir:dir,expo,
    fetchWithRetry:async()=>response(404),
  });
  assert.deepEqual(out,{included:false});
  assert.deepEqual(expo.plugins,["expo-router"]);
});
test("iOS incompatible WAV formats are rejected",async t=>{
  const dir=sandbox(t), expo={plugins:[]};
  assert.throws(()=>validateWav(wav({bits:24})),/PCM 16-bit mono/);
  await assert.rejects(syncB2BCustomSound({
    api:"https://admin.example",assetsDir:dir,expo,required:true,
    fetchWithRetry:async()=>response(200,Buffer.alloc(80)),
  }),/WAV/);
  assert.equal(fs.existsSync(path.join(dir,"b2b-custom.wav")),false);
});
test("remote audio HTTP errors fail instead of silently losing sound",async t=>{
  const dir=sandbox(t);
  await assert.rejects(syncB2BCustomSound({
    api:"https://admin.example",assetsDir:dir,expo:{plugins:[]},
    fetchWithRetry:async()=>response(503),
  }),/HTTP 503/);
});
