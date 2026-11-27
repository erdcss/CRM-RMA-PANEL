import assert from "node:assert/strict";
import test from "node:test";
import {generateDukkanSetupCode,isDukkanSetupCode,DUKKAN_SETUP_TTL_MINUTES} from "./dukkan-staff-password";
test("staff codes have a separate namespace, 128 bits of entropy and a 15-minute lifetime",()=>{
 const codes=Array.from({length:100},()=>generateDukkanSetupCode());
 assert.equal(new Set(codes).size,100);assert.ok(codes.every(isDukkanSetupCode));
 assert.equal(DUKKAN_SETUP_TTL_MINUTES,15);assert.equal(isDukkanSetupCode("123456"),false);assert.equal(isDukkanSetupCode("DUK-123"),false);
});
