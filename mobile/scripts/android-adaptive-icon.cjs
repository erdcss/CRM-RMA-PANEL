const fs = require("node:fs");
const path = require("node:path");
const { createHash } = require("node:crypto");
const { PNG } = require("pngjs");

/**
 * Android adaptive icons mask a large part of the 108dp foreground.
 * Keep the ENTIRE admin logo inside the circular safe zone instead of
 * passing the full-bleed iOS icon as the adaptive foreground.
 */
function makeAndroidAdaptiveIcon(logoPath, assetsDir, fullBleed = false) {
  const input = fs.readFileSync(path.join(assetsDir, path.basename(logoPath)));
  const source = PNG.sync.read(input);
  if (!source.width || !source.height || source.width > 4096 || source.height > 4096) {
    throw new Error("Android logo boyutları desteklenmiyor (maksimum 4096x4096).");
  }
  const size = 1024;
  // Trim transparent borders in an admin-supplied Android-specific icon.
  // Internal whitespace that is already baked into an opaque PNG must be
  // removed when preparing the 1024x1024 admin artwork.
  let cropLeft = 0, cropTop = 0, cropRight = source.width - 1, cropBottom = source.height - 1;
  if (fullBleed) {
    let minX = source.width, minY = source.height, maxX = -1, maxY = -1;
    for (let y = 0; y < source.height; y++) for (let x = 0; x < source.width; x++) {
      if (source.data[(y * source.width + x) * 4 + 3] > 20) {
        if (x < minX) minX = x; if (x > maxX) maxX = x;
        if (y < minY) minY = y; if (y > maxY) maxY = y;
      }
    }
    if (maxX < 0) throw new Error("Android uygulama ikonu tamamen şeffaf olamaz.");
    cropLeft = minX; cropTop = minY; cropRight = maxX; cropBottom = maxY;
  }
  const cropWidth = cropRight - cropLeft + 1;
  const cropHeight = cropBottom - cropTop + 1;
  // The safe area is a circle whose diameter is ~62% of the icon canvas.
  // Limit the entire source rectangle's diagonal, so even its corners remain visible.
  const safeDiagonal = size * 0.60;
  // Android-specific admin artwork is sized to fill the launcher mask;
  // the shared iOS icon retains conservative safe-zone sizing.
  const scale = fullBleed
    ? (size * 1.00) / Math.max(cropWidth, cropHeight)
    : safeDiagonal / Math.hypot(cropWidth, cropHeight);
  const width = Math.max(1, Math.round(cropWidth * scale));
  const height = Math.max(1, Math.round(cropHeight * scale));
  const left = Math.floor((size - width) / 2);
  const top = Math.floor((size - height) / 2);
  const output = new PNG({ width: size, height: size, colorType: 6 });

  // Bilinear sampling prevents an aliased/blurry logo on dense phone displays.
  for (let y = 0; y < height; y++) {
    const fy = cropTop + (y + 0.5) * cropHeight / height - 0.5;
    const sy0 = Math.max(0, Math.min(source.height - 1, Math.floor(fy)));
    const sy1 = Math.min(source.height - 1, sy0 + 1);
    const wy = Math.max(0, Math.min(1, fy - sy0));
    for (let x = 0; x < width; x++) {
      const fx = cropLeft + (x + 0.5) * cropWidth / width - 0.5;
      const sx0 = Math.max(0, Math.min(source.width - 1, Math.floor(fx)));
      const sx1 = Math.min(source.width - 1, sx0 + 1);
      const wx = Math.max(0, Math.min(1, fx - sx0));
      const weights = [(1-wx)*(1-wy), wx*(1-wy), (1-wx)*wy, wx*wy];
      const coords = [[sx0,sy0],[sx1,sy0],[sx0,sy1],[sx1,sy1]];
      const rgba = [0,0,0,0];
      for (let p = 0; p < 4; p++) {
        const [sx,sy] = coords[p];
        const offset = (sy * source.width + sx) * 4;
        const alpha = source.data[offset + 3] / 255;
        const contribution = weights[p] * alpha;
        rgba[3] += contribution;
        for (let channel = 0; channel < 3; channel++) rgba[channel] += contribution * source.data[offset + channel];
      }
      const offset = ((top + y) * size + left + x) * 4;
      const alpha = rgba[3];
      for (let channel = 0; channel < 3; channel++) {
        output.data[offset + channel] = alpha > 0 ? Math.round(rgba[channel] / alpha) : 0;
      }
      output.data[offset + 3] = Math.round(alpha * 255);
    }
  }

  const buffer = PNG.sync.write(output);
  const hash = createHash("sha256").update(buffer).digest("hex").slice(0,12);
  const filename = `managed-android-foreground-${hash}.png`;
  const target = path.join(assetsDir, filename);
  if (!fs.existsSync(target)) fs.writeFileSync(target, buffer);
  return `./assets/${filename}`;
}

module.exports = { makeAndroidAdaptiveIcon };
