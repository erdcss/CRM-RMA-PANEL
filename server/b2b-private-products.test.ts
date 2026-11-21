import test from "node:test";
import assert from "node:assert/strict";
import {parseAssignedCustomerId,canReadProductForCustomer} from "../shared/b2b-private-product-policy";

test("public products are readable while exclusive products require exact owner",()=>{
  assert.equal(canReadProductForCustomer(null,null),true);
  assert.equal(canReadProductForCustomer(null,24),true);
  assert.equal(canReadProductForCustomer(24,null),false);
  assert.equal(canReadProductForCustomer(24,25),false);
  assert.equal(canReadProductForCustomer(24,24),true);
});
test("recipient validation fails closed for non-integer, zero, negative and unsafe values",()=>{
  for(const invalid of [-1,0,0.5,"not a user","-1","0","1.4","1e8",{},[],2147483648]){
    assert.deepEqual(parseAssignedCustomerId(invalid),{ok:false});
  }
  assert.deepEqual(parseAssignedCustomerId(24),{ok:true,id:24});
  assert.deepEqual(parseAssignedCustomerId("24"),{ok:true,id:24});
  assert.deepEqual(parseAssignedCustomerId(null),{ok:true,id:null});
});
