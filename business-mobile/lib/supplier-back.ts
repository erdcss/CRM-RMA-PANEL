import type { Screen } from "../types";

/** Back never means logout. Only the explicit menu action can end a session. */
export function supplierBackAction(screen: Screen):
  {kind:"navigate";screen:Screen}|{kind:"confirm-exit"} {
  if(screen.name==="supplierOrderDetail") {
    return {kind:"navigate",screen:{name:"marketplace",tab:"orders"}};
  }
  if(screen.name==="aiProductStudio"&&screen.mode==="supplier") {
    return {kind:"navigate",screen:{name:"marketplace",tab:"products"}};
  }
  if(screen.name==="marketplace") {
    return !screen.tab||screen.tab==="overview"
      ? {kind:"confirm-exit"}
      : {kind:"navigate",screen:{name:"marketplace",tab:"overview"}};
  }
  return {kind:"navigate",screen:{name:"marketplace",tab:"overview"}};
}
