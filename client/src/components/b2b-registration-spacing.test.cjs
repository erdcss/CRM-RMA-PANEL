const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");

const form=fs.readFileSync(path.join(__dirname,"b2b-registration-form.tsx"),"utf8");
const page=fs.readFileSync(path.join(__dirname,"../pages/b2b-register.tsx"),"utf8");

test("last revealed field never reserves a phantom trailing field gap",()=>{
  assert.match(form,/isLastVisible = false/);
  assert.match(form,/isLastVisible \? "px-1\.5 pt-1\.5 pb-2" : "px-1\.5 pt-1\.5 pb-4 sm:pb-5"/);
  for(let stage=0;stage<8;stage++){
    assert.ok(form.includes(`show={visibleStage >= ${stage}} isLastVisible={visibleStage === ${stage}}`));
  }
});
test("registration card keeps content-height and small bottom inset",()=>{
  assert.match(form,/className="px-5 pb-4 sm:px-8 sm:pb-5"/);
  assert.match(page,/className="h-fit min-w-0 self-start overflow-hidden rounded-\[24px\]/);
  // min-h-screen is valid on the page background; only the form card must size to content.
  const cardClasses = page.match(/className="h-fit min-w-0 self-start[^"]*"/)?.[0] || "";
  assert.ok(cardClasses, "the form card must use intrinsic content height");
  assert.doesNotMatch(cardClasses,/min-h-\[|h-screen|h-full/);
});

test("animated fields reveal with visible overflow after the height animation",()=>{
  assert.match(form,/transitionEnd: \{ overflow: "visible" \}/);
  assert.match(form,/height: 0, y: -8, overflow: "hidden"/);
  assert.match(form,/className="min-w-0"/);
  assert.doesNotMatch(form,/className="min-w-0 overflow-hidden"/);
});
test("registration inputs and category select keep their focus ring inside rounded borders",()=>{
  const numberOfInputsWithInsetFocus = (form.match(/focus-visible:ring-inset focus-visible:ring-offset-0 focus-visible:ring-amber-400/g)||[]).length;
  assert.equal(numberOfInputsWithInsetFocus, 7);
  assert.match(form,/px-1\.5 pt-1\.5 pb-2/);
});
