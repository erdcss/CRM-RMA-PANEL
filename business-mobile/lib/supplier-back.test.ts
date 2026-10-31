import { supplierBackAction } from "./supplier-back";

function expect(label:string,actual:unknown,expected:unknown) {
  if(JSON.stringify(actual)!==JSON.stringify(expected)) {
    throw new Error(label+": got "+JSON.stringify(actual)+" expected "+JSON.stringify(expected));
  }
}

expect("order detail back returns to supplier orders",
  supplierBackAction({name:"supplierOrderDetail",id:19}),
  {kind:"navigate",screen:{name:"marketplace",tab:"orders"}});
expect("AI studio back returns to products",
  supplierBackAction({name:"aiProductStudio",mode:"supplier"}),
  {kind:"navigate",screen:{name:"marketplace",tab:"products"}});
expect("orders back returns to supplier overview",
  supplierBackAction({name:"marketplace",tab:"orders"}),
  {kind:"navigate",screen:{name:"marketplace",tab:"overview"}});
expect("tools back returns to supplier overview",
  supplierBackAction({name:"marketplace",tab:"settings"}),
  {kind:"navigate",screen:{name:"marketplace",tab:"overview"}});
expect("supplier root back confirms app exit without logging out",
  supplierBackAction({name:"marketplace",tab:"overview"}),{kind:"confirm-exit"});
expect("initial supplier root back confirms app exit",
  supplierBackAction({name:"marketplace"}),{kind:"confirm-exit"});
console.log("Supplier navigation tests passed");
