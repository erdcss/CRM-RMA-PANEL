"use strict";

// Shared by local builds and EAS remote pre-install. iOS custom sounds must
// physically exist in the native bundle; an admin upload alone is insufficient.
const fs = require("node:fs");
const path = require("node:path");

const SOUND_NAME = "b2b-custom.wav";
const SOUND_PATH = "./assets/" + SOUND_NAME;
const MAX_BYTES = 512 * 1024;

function validateWav(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.length < 44 || bytes.length > MAX_BYTES)
    throw new Error("Özel bildirim WAV dosyası eksik veya 512 KB üzerinde");
  if (bytes.toString("ascii", 0, 4) !== "RIFF" ||
      bytes.toString("ascii", 8, 12) !== "WAVE")
    throw new Error("Özel bildirim sesi WAV (RIFF/WAVE) değil");

  let fmt = false, data = false;
  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkSize = bytes.readUInt32LE(offset + 4);
    const end = offset + 8 + chunkSize;
    if (end > bytes.length) throw new Error("WAV veri bölümü eksik");
    const kind = bytes.toString("ascii", offset, offset + 4);
    if (kind === "fmt ") {
      if (chunkSize < 16) throw new Error("WAV fmt bölümü geçersiz");
      const base = offset + 8;
      const codec = bytes.readUInt16LE(base);
      const channels = bytes.readUInt16LE(base + 2);
      const sampleRate = bytes.readUInt32LE(base + 4);
      const bits = bytes.readUInt16LE(base + 14);
      if (codec !== 1 || channels !== 1 || bits !== 16 ||
          sampleRate < 8000 || sampleRate > 48000)
        throw new Error("iOS bildirimi için WAV PCM 16-bit mono (8-48 kHz) olmalı");
      fmt = true;
    }
    if (kind === "data" && chunkSize > 0) data = true;
    offset = end + (chunkSize % 2);
  }
  if (!fmt || !data) throw new Error("WAV format veya ses verisi eksik");
}

async function syncB2BCustomSound({ api, assetsDir, expo, fetchWithRetry, required = false }) {
  const url = api.replace(/\\/$/, "") + "/api/public/b2b-notification-sound?t=" + Date.now();
  const response = await fetchWithRetry(url, { headers: { Accept: "audio/wav" } });
  if (response.status === 404) {
    if (required) throw new Error("TestFlight build durduruldu: Admin panelinde özel bildirim sesi kayıtlı değil");
    // Remove a previously injected native plugin when sound was deleted.
    expo.plugins = (expo.plugins || []).filter(p =>
      !(typeof p === "string" ? p === "expo-notifications" :
        Array.isArray(p) && p[0] === "expo-notifications"));
    return { included: false };
  }
  if (!response.ok) throw new Error("Özel bildirim sesi indirilemedi: HTTP " + response.status);
  const bytes = Buffer.from(await response.arrayBuffer());
  validateWav(bytes);
  fs.mkdirSync(assetsDir, { recursive: true });
  fs.writeFileSync(path.join(assetsDir, SOUND_NAME), bytes);
  expo.plugins = (expo.plugins || []).filter(p =>
    !(typeof p === "string" ? p === "expo-notifications" :
      Array.isArray(p) && p[0] === "expo-notifications"));
  expo.plugins.push(["expo-notifications", { sounds: [SOUND_PATH] }]);
  console.log("[b2b-sound] iOS/Android native bildirim sesi eklendi:", SOUND_NAME, bytes.length, "bytes");
  return { included: true, bytes: bytes.length };
}

module.exports = { SOUND_NAME, SOUND_PATH, validateWav, syncB2BCustomSound };
