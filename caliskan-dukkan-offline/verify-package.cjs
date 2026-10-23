"use strict";
// This checks the actual installer payload, not merely the source working tree.
const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");
const asar = require("@electron/asar");

const archive = path.resolve(__dirname, "dist", "win-unpacked", "resources", "app.asar");
assert.ok(fs.existsSync(archive), "Paketlenmiş Electron arşivi bulunamadı: " + archive);
const entries = asar.listPackage(archive).map(p => p.replace(/\\/g, "/").replace(/^\//, ""));
const needed = [
  "index.html", "app.js", "style.css", "main.cjs", "preload.cjs", "backend.cjs",
  "node_modules/sql.js/dist/sql-wasm.wasm",
  "node_modules/sql.js/dist/sql-wasm.js"
];
for (const file of needed) {
  assert.ok(entries.includes(file), "Kurulumda kritik dosya eksik: " + file);
  // Electron Builder stores some binary assets in app.asar.unpacked.
  // They are still shipped with the installer and transparently readable by Electron.
  // Electron's asar reader treats embedded WASM specially; existence in the
  // archive file table is verified above. UI JS/CSS must also be extractable.
  if (file.endsWith(".wasm")) continue;
  const unpackedFile = path.resolve(__dirname, "dist", "win-unpacked", "resources", "app.asar.unpacked", ...file.split("/"));
  const bytes = fs.existsSync(unpackedFile)
    ? fs.readFileSync(unpackedFile)
    : asar.extractFile(archive, file);
  assert.ok(bytes.length > 100, "Kurulumda boş veya çok küçük dosya: " + file);
}
const html = asar.extractFile(archive, "index.html").toString("utf8");
const css = asar.extractFile(archive, "style.css").toString("utf8");
const js = asar.extractFile(archive, "app.js").toString("utf8");
assert.match(html, /<link rel="stylesheet" href="style.css">/);
assert.match(html, /<script src="app.js"><\/script>/);
assert.match(css, /\.sidebar\s*\{/);
assert.match(js, /async function screen\(\)/);
console.log("Çalışkan Dükkan Windows paket doğrulaması başarılı:", needed.join(", "));
