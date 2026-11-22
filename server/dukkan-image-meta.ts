import {createHash} from "node:crypto";

export type ImageDimensions={width:number;height:number;mime:string;bytes:number;sha256:string};
export function base64Image(data:unknown):{buffer:Buffer;mime:string}|null{
  if(typeof data!=="string")return null;
  const match=/^data:image\/(png|jpeg|webp);base64,([a-zA-Z0-9+/=]+)$/.exec(data);
  if(!match||match[2].length>6_000_000)return null;
  const buffer=Buffer.from(match[2],"base64");
  if(!buffer.length||buffer.length>4_500_000)return null;
  return {buffer,mime:"image/"+match[1]};
}
export function imageDimensions(image:unknown):ImageDimensions|null{
  const parsed=base64Image(image);
  if(!parsed)return null;
  const {buffer,mime}=parsed;
  let width=0,height=0;
  if(mime==="image/png"&&buffer.length>=24&&buffer.subarray(1,4).toString()==="PNG"){
    width=buffer.readUInt32BE(16);height=buffer.readUInt32BE(20);
  }else if(mime==="image/jpeg"&&buffer.length>4&&buffer[0]===255&&buffer[1]===216){
    let i=2;
    while(i+9<buffer.length){
      if(buffer[i]!==255){i++;continue;}
      const marker=buffer[i+1];
      if(marker===216||marker===1){i+=2;continue;}
      if(marker===217||marker===218)break;
      const length=buffer.readUInt16BE(i+2);
      if(length<2||i+2+length>buffer.length)break;
      if([192,193,194,195,198,199,201,202].includes(marker)){
        height=buffer.readUInt16BE(i+5);width=buffer.readUInt16BE(i+7);break;
      }
      i+=length+2;
    }
  }else if(mime==="image/webp"&&buffer.length>=30&&buffer.toString("ascii",0,4)==="RIFF"&&buffer.toString("ascii",8,12)==="WEBP"){
    const kind=buffer.toString("ascii",12,16);
    if(kind==="VP8X"){
      width=buffer.readUIntLE(24,3)+1;height=buffer.readUIntLE(27,3)+1;
    }else if(kind==="VP8 "&&buffer.length>=30){
      width=buffer.readUInt16LE(26)&0x3fff;height=buffer.readUInt16LE(28)&0x3fff;
    }else if(kind==="VP8L"&&buffer.length>=25){
      const val=buffer.readUInt32LE(21);width=1+(val&0x3fff);height=1+((val>>14)&0x3fff);
    }
  }
  if(width<1||height<1||width>20000||height>20000)return null;
  return {width,height,mime,bytes:buffer.length,sha256:createHash("sha256").update(buffer).digest("hex")};
}
export function qualityBand(meta:ImageDimensions|null):"missing"|"critical"|"low"|"adequate"{
  if(!meta)return "missing";
  const edge=Math.max(meta.width,meta.height);
  return edge<200?"critical":edge<800?"low":"adequate";
}
export function isExactOfficialMatch(sku:string,brand:string,title:string,body:string):boolean{
  const norm=(s:string)=>s.toLocaleLowerCase("tr-TR").replace(/ı/g,"i").replace(/[^a-z0-9]/g,"");
  const model=norm(sku),clean=norm(title),text=norm(body),br=norm(brand);
  if(!br||!clean.includes(br))return false;
  if(model.length>=5&&clean.includes(model))return true;
  // The following exact supplier alias is verified against a supplier catalogue page.
  if(sku==="UV-16"&&clean.includes("baofenguv16pro")&&text.includes("uv16pro"))return true;
  return false;
}