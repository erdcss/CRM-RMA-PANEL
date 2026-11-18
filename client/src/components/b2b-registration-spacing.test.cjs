const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const form=fs.readFileSync(path.join(__dirname,"b2b-registration-form.tsx"),"utf8");
const page=fs.readFileSync(path.join(__dirname,"../pages/b2b-register.tsx"),"utf8");

test("last revealed field never reserves a phantom trailing field gap",()=>{
  assert.match(form,/isLastVisible = false/);
  assert.match(form,/isLastVisible \? "pb-0" : "pb-3 sm:pb-4"/);
  for(let stage=0;stage<8;stage++){
    assert.ok(form.includes(`show={visibleStage >= ${stage}} isLastVisible={visibleStage === ${stage}}`));
  }
});
test("registration card keeps content-height and small bottom inset",()=>{
  assert.match(form,/className="px-5 pb-4 sm:px-8 sm:pb-5"/);
  assert.match(page,/className="h-fit min-w-0 self-start overflow-hidden rounded-\[24px\]/);
  assert.doesNotMatch(page,/min-h-\[|h-screen|h-full/);
});
