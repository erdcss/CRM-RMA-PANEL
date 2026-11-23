const test = require('node:test');
const assert = require('node:assert/strict');
const { PNG } = require('pngjs');
const { renderOpaqueIosIcon } = require('./ios-app-icon.cjs');

function logo(width, height, transparent) {
  const source = new PNG({width, height});
  for(let i=0;i<source.data.length;i+=4) {
    source.data[i]=255; source.data[i+1]=204; source.data[i+2]=0;
    source.data[i+3]=transparent?0:255;
  }
  if(transparent) {
    const x0=Math.floor(width/4), x1=Math.ceil(width*3/4);
    const y0=Math.floor(height/4), y1=Math.ceil(height*3/4);
    for(let y=y0;y<y1;y++) for(let x=x0;x<x1;x++)
      source.data[(y*width+x)*4+3]=255;
  }
  return PNG.sync.write(source);
}
test('rectangular transparent source becomes opaque 1024px RGB icon',()=>{
  const png=renderOpaqueIosIcon(logo(240,80,true));
  assert.equal(png.readUInt32BE(16),1024);
  assert.equal(png.readUInt32BE(20),1024);
  assert.equal(png[25],2,'PNG must be RGB without any alpha channel');
  const parsed=PNG.sync.read(png);
  assert.deepEqual([...parsed.data.subarray(0,3)],[16,16,16]);
  const center=(512*1024+512)*4;
  assert.ok(parsed.data[center]>200,'center should display the yellow logo');
  assert.ok(parsed.data[center+1]>130);
});
test('square PNG stays valid for the Apple App Store',()=>{
  const png=renderOpaqueIosIcon(logo(100,100,false));
  assert.equal(png[25],2);
  assert.equal(PNG.sync.read(png).width,1024);
});
