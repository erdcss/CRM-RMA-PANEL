import test from "node:test";
import assert from "node:assert/strict";
import {parseB2BNotificationTarget} from "./b2b-notification-target";

test("accepts only B2B internal product and page targets",()=>{
  for (const [value,expected] of [
    ["/urun/145","/urun/145"],
    ["https://b2b.ecalisgan.com/urun/mp-42","/urun/mp-42"],
    ["https://b2b.ecalisgan.com/kategoriler","/kategoriler"],
    ["/kategori/ev-aletleri","/kategori/ev-aletleri"],
    ["/","/"],
  ] as const) assert.deepEqual(parseB2BNotificationTarget(value),{ok:true,path:expected});
});
test("empty is optional for existing automatic, immediate and scheduled messages",()=>{
  for (const value of [undefined,null,"", " "])
    assert.deepEqual(parseB2BNotificationTarget(value),{ok:true,path:null});
});
test("rejects offsite, script and ambiguous URLs",()=>{
  const bad=[
    "https://evil.example/urun/1","http://b2b.ecalisgan.com/urun/2",
    "https://b2b.ecalisgan.com.evil.example/urun/3",
    "//evil.example/path","javascript:alert(1)","/urun/2?next=https://evil.example",
    "/urun/2#fragment","/urun/%2e%2e/admin","/urun/%2fsecret",
    "/urun\\foo","https://user:pass@b2b.ecalisgan.com/urun/1",
    "https://b2b.ecalisgan.com:555/urun/3",
  ];
  for (const value of bad) assert.equal(parseB2BNotificationTarget(value).ok,false,value);
});
