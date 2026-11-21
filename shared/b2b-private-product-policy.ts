/** Non-empty recipient ID limits product access to exactly that customer account. */
export function parseAssignedCustomerId(raw:unknown):{ok:true;id:number|null}|{ok:false}{
  if(raw===null||raw===undefined||raw==="")return {ok:true,id:null};
  if(typeof raw!=="number"&&typeof raw!=="string")return {ok:false};
  if(!/^[1-9][0-9]{0,9}$/.test(String(raw)))return {ok:false};
  const value=Number(raw);
  return Number.isSafeInteger(value)&&value>0&&value<=2147483647?{ok:true,id:value}:{ok:false};
}
export function canReadProductForCustomer(assignedId:number|null,viewerId:number|null):boolean{
  return assignedId===null||(viewerId!==null&&assignedId===viewerId);
}
