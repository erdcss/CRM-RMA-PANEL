import test from "node:test";
import assert from "node:assert/strict";
import {DEFAULT_HOMEPAGE_DRAWERS,loadHomepageDrawers,saveHomepageDrawers} from "./admin-homepage-drawer";

test("each homepage section opens independently and drawer state survives a page reload",()=>{
  const old=Object.getOwnPropertyDescriptor(globalThis,"window");
  const store=new Map<string,string>();
  try{
    // Server-side or test rendering has no window; defaults remain safe.
    Object.defineProperty(globalThis,"window",{configurable:true,value:undefined});
    assert.deepEqual(loadHomepageDrawers(),DEFAULT_HOMEPAGE_DRAWERS);

    Object.defineProperty(globalThis,"window",{configurable:true,value:{
      localStorage:{
        getItem:(key:string)=>store.get(key)??null,
        setItem:(key:string,value:string)=>{store.set(key,value);},
      },
    }});
    assert.deepEqual(loadHomepageDrawers(),{categories:true,campaign:false,banners:false});
    saveHomepageDrawers({categories:false,campaign:true,banners:false});
    assert.deepEqual(loadHomepageDrawers(),{categories:false,campaign:true,banners:false});
    store.set("caliskan_admin_homepage_drawers_v1",JSON.stringify({
      categories:"false",campaign:true,banners:false,unknown:true,
    }));
    assert.deepEqual(loadHomepageDrawers(),{categories:true,campaign:true,banners:false});
    store.set("caliskan_admin_homepage_drawers_v1","not-json");
    assert.deepEqual(loadHomepageDrawers(),DEFAULT_HOMEPAGE_DRAWERS);
    store.set("caliskan_admin_homepage_drawers_v1",JSON.stringify([]));
    assert.deepEqual(loadHomepageDrawers(),DEFAULT_HOMEPAGE_DRAWERS);
  }finally{
    if(old)Object.defineProperty(globalThis,"window",old);
    else Reflect.deleteProperty(globalThis,"window");
  }
});
