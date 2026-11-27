import test from "node:test";
import assert from "node:assert/strict";
import {BusinessReadCache} from "../lib/read-cache.ts";

test("dedupes same session GET and respects freshness/force", async () => {
  let now=0, calls=0;
  const cache=new BusinessReadCache(10,30,()=>now);
  const loader=async()=>++calls;
  assert.deepEqual(await Promise.all([cache.read("a","products",loader),cache.read("a","products",loader)]),[1,1]);
  assert.equal(await cache.read("a","products",loader),1);
  assert.equal(await cache.read("a","products",loader,true),2);
  now=20;
  assert.equal(cache.peek("a","products"),2);
  assert.equal(await cache.read("a","products",loader),3);
  now=51;
  assert.equal(cache.peek("a","products"),undefined);
});
test("no cross-session cache, failed requests not cached, invalidated in-flight cannot repopulate", async () => {
  const cache=new BusinessReadCache();
  await cache.read("a","products",async()=>["private A"]);
  assert.equal(cache.peek("b","products"),undefined);
  await assert.rejects(cache.read("b","products",async()=>{throw Error("offline")}));
  assert.equal(cache.peek("b","products"),undefined);
  let resolve;
  const pending=cache.read("b","products",()=>new Promise(r=>{resolve=r;}));
  await Promise.resolve();
  cache.clear();
  resolve(["stale"]);
  await pending;
  assert.equal(cache.peek("b","products"),undefined);
});
