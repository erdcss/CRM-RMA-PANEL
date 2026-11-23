/**
 * Release safety: a GitHub push for status checks must not launch extra
 * (billable) iOS builds. Codemagic API launches are a separate action.
 */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const yaml = fs.readFileSync(path.join(root,'codemagic.yaml'),'utf8');
const action = fs.readFileSync(path.join(root,'.github/workflows/b2b-codemagic-direct-testflight.yml'),'utf8');

function workflowBlock(name) {
  const marker = '  ' + name + ':';
  const begin = yaml.indexOf(marker);
  assert(begin >= 0, 'Codemagic workflow missing: ' + name);
  const rest = yaml.slice(begin + marker.length);
  const next = rest.search(/^  [a-z][a-z0-9_-]+:/m);
  return next < 0 ? rest : rest.slice(0,next);
}
for (const name of ['caliskan-b2b-ios', 'caliskan-b2b-testflight']) {
  const block = workflowBlock(name);
  assert.match(block, /triggering:\s*\n\s*events:\s*\[\s*\]/, name + ' must be manual/API-only');
  assert.doesNotMatch(block, /triggering:\s*\n\s*events:\s*\n\s*-\s*push/, name + ' must not start on pushes');
}
const beta = workflowBlock('caliskan-b2b-testflight');
assert.match(beta, /submit_to_testflight:\s*true/);
assert.match(beta, /submit_to_app_store:\s*false/);
assert.match(action, /workflowId:\s*'caliskan-b2b-testflight'/);
assert.match(action, /Operation: verify/);
console.log('Çalışkan B2B: no duplicate webhook iOS builds; explicit API TestFlight remains configured.');
