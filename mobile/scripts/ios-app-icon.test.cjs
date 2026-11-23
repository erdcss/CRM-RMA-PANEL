const test = require('node:test');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');
const { renderOpaqueIosIcon } = require('./ios-app-icon.cjs');

function logo(width, height, transparent = false) {
  const source = new PNG({ width, height });
  for (let i = 0; i < source.data.length; i += 4) {
    source.data[i] = 255;
    source.data[i + 1] = 204;
    source.data[i + 2] = 0;
    source.data[i + 3] = transparent ? 0 : 255;
  }
  if (transparent) {
    const x0 = Math.floor(width / 4), x1 = Math.ceil(width * 3 / 4);
    const y0 = Math.floor(height / 4), y1 = Math.ceil(height * 3 / 4);
    for (let y = y0; y < y1; y++)
      for (let x = x0; x < x1; x++)
        source.data[(y * width + x) * 4 + 3] = 255;
  }
  return PNG.sync.write(source);
}

test('opaque square B2B artwork fills the entire iOS launcher icon', () => {
  const png = renderOpaqueIosIcon(logo(256, 256));
  assert.equal(png.readUInt32BE(16), 1024);
  assert.equal(png.readUInt32BE(20), 1024);
  assert.equal(png[25], 2, 'iOS icon must be RGB without an alpha channel');
  const parsed = PNG.sync.read(png);
  for (const [x, y] of [[0, 0], [1023, 0], [0, 1023], [1023, 1023], [512, 512]]) {
    const i = (y * 1024 + x) * 4;
    assert.deepEqual([...parsed.data.subarray(i, i + 3)], [255, 204, 0],
      'No black inset may surround square icon art');
  }
});

test('transparent square logo is composited on gold instead of black', () => {
  const png = renderOpaqueIosIcon(logo(240, 240, true));
  assert.equal(png[25], 2);
  const parsed = PNG.sync.read(png);
  assert.deepEqual([...parsed.data.subarray(0, 3)], [255, 204, 0]);
  const center = (512 * 1024 + 512) * 4;
  assert.ok(parsed.data[center] > 200);
  assert.ok(parsed.data[center + 1] > 130);
});

test('rectangular transparent logo is centered on an opaque gold background', () => {
  const png = renderOpaqueIosIcon(logo(240, 80, true));
  assert.equal(png.readUInt32BE(16), 1024);
  assert.equal(png.readUInt32BE(20), 1024);
  assert.equal(png[25], 2);
  const parsed = PNG.sync.read(png);
  assert.deepEqual([...parsed.data.subarray(0, 3)], [255, 204, 0]);
  const center = (512 * 1024 + 512) * 4;
  assert.ok(parsed.data[center] > 200);
  assert.ok(parsed.data[center + 1] > 130);
});
