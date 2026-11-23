/**
 * App Store safe iOS launcher icon derived from the admin-managed B2B logo.
 * Keep the source logo (and splash) unchanged. Only the native launcher icon
 * is rendered on a solid branded background as an opaque 1024px RGB PNG.
 *
 * The Apple App Store icon cannot contain an alpha channel and must be square.
 */
const fs = require('node:fs');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { PNG } = require('pngjs');

const SIZE = 1024;
const PADDING = 64;
const BACKGROUND = [16, 16, 16];

function renderOpaqueIosIcon(sourceBuffer) {
  const source = PNG.sync.read(sourceBuffer);
  if (
    !Number.isSafeInteger(source.width) ||
    !Number.isSafeInteger(source.height) ||
    source.width < 1 || source.height < 1 ||
    source.width > 8192 || source.height > 8192 ||
    source.width * source.height > 16_000_000
  ) {
    throw new Error('iOS logo boyutu geçersiz veya çok büyük');
  }

  const output = new PNG({ width: SIZE, height: SIZE, colorType: 6 });
  for (let i = 0; i < output.data.length; i += 4) {
    output.data[i] = BACKGROUND[0];
    output.data[i + 1] = BACKGROUND[1];
    output.data[i + 2] = BACKGROUND[2];
    output.data[i + 3] = 255;
  }

  const scale = Math.min(
    (SIZE - 2 * PADDING) / source.width,
    (SIZE - 2 * PADDING) / source.height
  );
  const w = Math.max(1, Math.round(source.width * scale));
  const h = Math.max(1, Math.round(source.height * scale));
  const offsetX = Math.floor((SIZE - w) / 2);
  const offsetY = Math.floor((SIZE - h) / 2);

  // Bilinear sampling with premultiplied alpha prevents colored halos
  // around transparent text and produces smooth small icon lettering.
  for (let y = 0; y < h; y++) {
    const sy = (y + 0.5) / scale - 0.5;
    const iy = Math.floor(sy);
    const fy = sy - iy;
    for (let x = 0; x < w; x++) {
      const sx = (x + 0.5) / scale - 0.5;
      const ix = Math.floor(sx);
      const fx = sx - ix;
      const neighbors = [
        [ix, iy, (1 - fx) * (1 - fy)],
        [ix + 1, iy, fx * (1 - fy)],
        [ix, iy + 1, (1 - fx) * fy],
        [ix + 1, iy + 1, fx * fy],
      ];
      let coverage = 0;
      const premult = [0, 0, 0];
      for (const [nx, ny, weight] of neighbors) {
        const cx = Math.max(0, Math.min(source.width - 1, nx));
        const cy = Math.max(0, Math.min(source.height - 1, ny));
        const src = (cy * source.width + cx) * 4;
        const opacity = (source.data[src + 3] / 255) * weight;
        coverage += opacity;
        for (let channel = 0; channel < 3; channel++)
          premult[channel] += source.data[src + channel] * opacity;
      }
      const target = ((y + offsetY) * SIZE + (x + offsetX)) * 4;
      for (let channel = 0; channel < 3; channel++)
        output.data[target + channel] = Math.round(
          Math.max(0, Math.min(255, premult[channel] + BACKGROUND[channel] * (1 - coverage)))
        );
      output.data[target + 3] = 255;
    }
  }

  // colorType 2 writes RGB without *any* alpha channel (not just alpha=255).
  const icon = PNG.sync.write(output, { colorType: 2 });
  if (icon.readUInt32BE(16) !== SIZE || icon.readUInt32BE(20) !== SIZE ||
      icon[25] !== 2) {
    throw new Error('Oluşturulan iOS ikonu 1024x1024 RGB değil.');
  }
  return icon;
}

function writeOpaqueIosIcon(logoPath, assetsDirectory) {
  const resolved = path.resolve(logoPath);
  const icon = renderOpaqueIosIcon(fs.readFileSync(resolved));
  const digest = createHash('sha256').update(icon).digest('hex').slice(0, 12);
  const name = `managed-ios-app-icon-${digest}.png`;
  const destination = path.join(assetsDirectory, name);
  fs.mkdirSync(assetsDirectory, { recursive: true });
  if (!fs.existsSync(destination) || !fs.readFileSync(destination).equals(icon))
    fs.writeFileSync(destination, icon);
  return './assets/' + name;
}

module.exports = { renderOpaqueIosIcon, writeOpaqueIosIcon };
