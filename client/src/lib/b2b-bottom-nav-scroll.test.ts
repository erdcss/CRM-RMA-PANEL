import test from "node:test";
import assert from "node:assert/strict";
import { initialB2BBottomNavScroll,updateB2BBottomNavScroll } from "./b2b-bottom-nav-scroll";

test("mobile bar stays open at page top and fades after deliberate downward scroll",()=>{
  let track=initialB2BBottomNavScroll();
  track=updateB2BBottomNavScroll(track,40);
  assert.equal(track.compact,false);
  track=updateB2BBottomNavScroll(track,102);
  assert.equal(track.compact,true);
});

test("small scroll jitter never toggles the compact state",()=>{
  let track=updateB2BBottomNavScroll(initialB2BBottomNavScroll(),130);
  assert.equal(track.compact,true);
  track=updateB2BBottomNavScroll(track,129.5);
  assert.equal(track.compact,true);
  track=updateB2BBottomNavScroll(track,129);
  assert.equal(track.compact,true);
});

test("upward scroll restores navigation while remaining in the middle of the page",()=>{
  let track=updateB2BBottomNavScroll(initialB2BBottomNavScroll(),250);
  track=updateB2BBottomNavScroll(track,240);
  assert.equal(track.compact,true);
  track=updateB2BBottomNavScroll(track,230);
  assert.equal(track.compact,false);
});

test("after returning to top, the bar is always full size",()=>{
  let track=updateB2BBottomNavScroll(initialB2BBottomNavScroll(),250);
  track=updateB2BBottomNavScroll(track,60);
  assert.equal(track.compact,false);
  assert.equal(track.travel,0);
});

test("short upward bounce does not hide the menu until deliberate downward scrolling resumes",()=>{
  let track=updateB2BBottomNavScroll(initialB2BBottomNavScroll(),240);
  track=updateB2BBottomNavScroll(track,216);
  assert.equal(track.compact,false);
  track=updateB2BBottomNavScroll(track,222);
  assert.equal(track.compact,false);
  track=updateB2BBottomNavScroll(track,245);
  assert.equal(track.compact,true);
});
