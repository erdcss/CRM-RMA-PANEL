import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system/legacy";
import {extractAiDocument,type AiDocumentResult,type AiDocumentSection} from "./remote-db";

export async function pickAiDocument(section:AiDocumentSection):Promise<AiDocumentResult|null>{
 const result=await DocumentPicker.getDocumentAsync({
  type:["application/pdf","image/jpeg","image/png","image/webp"],
  copyToCacheDirectory:true
 });
 if(result.canceled||!result.assets?.length)return null;
 const asset=result.assets[0];
 if(asset.size&&asset.size>8_000_000)throw Error("Belge 8 MB sınırını aşıyor");
 const suffix=asset.name.split(".").pop()?.toLowerCase()||"";
 const mimeType=asset.mimeType||({pdf:"application/pdf",jpg:"image/jpeg",jpeg:"image/jpeg",png:"image/png",webp:"image/webp"} as Record<string,string>)[suffix]||"";
 if(!["application/pdf","image/jpeg","image/png","image/webp"].includes(mimeType))throw Error("PDF, JPG, PNG veya WEBP seçiniz");
 const base64=await FileSystem.readAsStringAsync(asset.uri,{encoding:FileSystem.EncodingType.Base64});
 return extractAiDocument(section,{name:asset.name,mimeType,base64});
}
