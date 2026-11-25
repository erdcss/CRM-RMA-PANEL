const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const babel = require('@babel/core');
const plugin = require('./typography-policy.cjs');
const root = path.resolve(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
function compile(code, name='app/typography-example.tsx') {
  return babel.transformSync(code, {filename:path.join(root,name), configFile:false, babelrc:false,
    parserOpts:{plugins:['jsx','typescript']}, plugins:[[plugin,{root}]]}).code;
}
test('only Poppins Regular, no bold, no italic, no letter spacing; policy takes precedence',()=>{
  const policy=read('components/ui/AppTypography.tsx');
  assert.match(policy,/APP_FONT_FAMILY = 'PoppinsRegular'/);
  assert.match(policy,/fontWeight: '400'/);
  assert.match(policy,/fontStyle: 'normal'/);
  assert.match(policy,/letterSpacing: 0/);
  assert.equal((policy.match(/style=\{\[style,LOCKED_TYPOGRAPHY\]\}/g)||[]).length,2);
  assert.match(read('app/_layout.tsx'),/Poppins-Regular\.ttf/);
  assert.ok(fs.statSync(path.join(root,'assets/fonts/Poppins-Regular.ttf')).size>10000);
});
test('imports of text, input, namespace and animated text are rewritten, icons and layout are untouched',()=>{
  const output=compile("import {Text as T, TextInput, Animated, View} from 'react-native'; import * as RN from 'react-native'; const x=<View><T style={{fontWeight:'900',letterSpacing:8}}/><TextInput/><Animated.Text/><RN.Text/><RN.Animated.Text/></View>;");
  assert.match(output,/from "\.\.\/components\/ui\/AppTypography"/);
  assert.match(output,/Text as T/);
  assert.match(output,/AnimatedText/);
  assert.doesNotMatch(output,/<(?:Animated|RN)\./);
  assert.match(output,/<View>/);
  assert.match(output,/from 'react-native'/);
});
test('a direct commonjs UI import is rejected, and dependencies are untouched',()=>{
  assert.throws(()=>compile("const RN=require('react-native');"),/typography policy is mandatory/);
  assert.doesNotMatch(compile("import { Text } from 'react-native';",'node_modules/example/index.tsx'),/AppTypography/);
});
