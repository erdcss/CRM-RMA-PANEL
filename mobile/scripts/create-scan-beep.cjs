// Deterministic short two-tone barcode confirmation WAV (PCM 16-bit mono).
const fs = require('node:fs');
const path = require('node:path');
const sampleRate = 22050;
const duration = 0.115;
const count = Math.round(sampleRate * duration);
const data = Buffer.alloc(count * 2);
for (let i = 0; i < count; i++) {
  const t = i / sampleRate;
  const frequency = t < 0.058 ? 1046.5 : 1318.5;
  const envelope = Math.pow(Math.sin(Math.PI * i / count), 0.6);
  const sample = Math.round(Math.sin(2 * Math.PI * frequency * t) * envelope * 0.28 * 32767);
  data.writeInt16LE(sample, i * 2);
}
const header = Buffer.alloc(44);
header.write('RIFF', 0);
header.writeUInt32LE(36 + data.length, 4);
header.write('WAVEfmt ', 8);
header.writeUInt32LE(16, 16);
header.writeUInt16LE(1, 20);
header.writeUInt16LE(1, 22);
header.writeUInt32LE(sampleRate, 24);
header.writeUInt32LE(sampleRate * 2, 28);
header.writeUInt16LE(2, 32);
header.writeUInt16LE(16, 34);
header.write('data', 36);
header.writeUInt32LE(data.length, 40);
const output = path.join(__dirname, '..', 'assets', 'scan-beep.wav');
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, Buffer.concat([header, data]));
console.log('[scan-beep] WAV ready');
