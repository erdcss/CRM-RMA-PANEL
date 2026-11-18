import test from "node:test";
import assert from "node:assert/strict";
import {normalizedB2BMobile,registrationStepReadiness, type RegistrationProgressValues} from "./b2b-registration-progress";

const complete: RegistrationProgressValues = {
  companyName:"Çalışkan Elektronik",firstName:"Ahmet",lastName:"Yılmaz",
  email:"satis@example.com",phone:"0532 123 45 67",companyCategory:"Elektrik & Elektronik",
  taxNumber:"1234567890",taxValid:true,taxChecking:false,
};

test("inputs unlock in the expected company, name, email, phone, category, tax order",()=>{
  assert.deepEqual(registrationStepReadiness(complete),[true,true,true,true,true,true,true]);
  assert.deepEqual(registrationStepReadiness({...complete,companyName:" "}),[false,true,true,true,true,true,true]);
  assert.deepEqual(registrationStepReadiness({...complete,firstName:" "}),[true,false,true,true,true,true,true]);
  assert.deepEqual(registrationStepReadiness({...complete,lastName:" "}),[true,true,false,true,true,true,true]);
  assert.deepEqual(registrationStepReadiness({...complete,email:"bad-mail"}),[true,true,true,false,true,true,true]);
  assert.deepEqual(registrationStepReadiness({...complete,phone:"555"}),[true,true,true,true,false,true,true]);
  assert.deepEqual(registrationStepReadiness({...complete,companyCategory:""}),[true,true,true,true,true,false,true]);
  assert.deepEqual(registrationStepReadiness({...complete,taxValid:false}),[true,true,true,true,true,true,false]);
  assert.deepEqual(registrationStepReadiness({...complete,taxChecking:true}),[true,true,true,true,true,true,false]);
});

test("Turkish mobile phone formats normalize without dropping valid digits",()=>{
  for(const phone of ["5321234567","0532 123 45 67","+90 532 123 45 67"]){
    assert.equal(normalizedB2BMobile(phone),"5321234567");
  }
  assert.equal(normalizedB2BMobile("123"),"123");
});
