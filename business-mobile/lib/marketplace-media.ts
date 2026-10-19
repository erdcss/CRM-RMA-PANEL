import * as ImagePicker from "expo-image-picker";
import { apiFetch } from "./api";

const MAX_IMAGE=4*1024*1024;
const MAX_VIDEO=60*1024*1024;
type UploadResult={url:string;mime:string;size:number};

async function readBase64(blob:Blob):Promise<string>{
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onload=()=>resolve(String(reader.result||"").split(",")[1]||"");
    reader.onerror=()=>reject(new Error("Dosya okunamadı."));
    reader.readAsDataURL(blob);
  });
}
export async function pickAndUploadSellerImage():Promise<string|null>{
  const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
  if(!permission.granted)throw new Error("Görsel yüklemek için fotoğraf izni gerekiyor.");
  const picked=await ImagePicker.launchImageLibraryAsync({
    mediaTypes:["images"],allowsEditing:false,base64:true,quality:0.85
  });
  if(picked.canceled||!picked.assets?.[0])return null;
  const asset=picked.assets[0];
  if(asset.fileSize&&asset.fileSize>MAX_IMAGE)throw new Error("Görsel en fazla 4 MB olabilir.");
  const mime=asset.mimeType==="image/png"?"image/png":asset.mimeType==="image/webp"?"image/webp":"image/jpeg";
  let base64=asset.base64;
  if(!base64){
    const blob=await fetch(asset.uri).then(r=>r.blob());
    if(blob.size>MAX_IMAGE)throw new Error("Görsel en fazla 4 MB olabilir.");
    base64=await readBase64(blob);
  }
  const uploaded=await apiFetch<UploadResult>("/api/marketplace/seller/media",{
    method:"POST",body:JSON.stringify({dataUrl:`data:${mime};base64,${base64}`})
  });
  return uploaded.url;
}
/** Video is sent in independent 2 MB chunks: we never base64-encode the complete video. */
export async function pickAndUploadSellerVideo(onProgress?:(progress:number)=>void):Promise<string|null>{
  const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
  if(!permission.granted)throw new Error("Video seçmek için fotoğraf arşivi izni gerekiyor.");
  const chosen=await ImagePicker.launchImageLibraryAsync({
    mediaTypes:["videos"],allowsEditing:false,quality:1
  });
  if(chosen.canceled||!chosen.assets?.[0])return null;
  const asset=chosen.assets[0];
  const blob=await fetch(asset.uri).then(r=>r.blob());
  const size=blob.size;
  if(size<1||size>MAX_VIDEO)throw new Error("MP4 video en fazla 60 MB olabilir.");
  if(asset.mimeType&&!/video\/(mp4|quicktime)/i.test(asset.mimeType))
    throw new Error("MP4 video yükleyin. iPhone MOV dosyalarını önce MP4'e dönüştürün.");
  const start=await apiFetch<{uploadId:string;chunkSize:number;partCount:number}>(
    "/api/marketplace/seller/video-upload/start",{
      method:"POST",body:JSON.stringify({size})
    }
  );
  for(let index=0;index<start.partCount;index++){
    const chunk=blob.slice(index*start.chunkSize,Math.min(size,(index+1)*start.chunkSize));
    const base64=await readBase64(chunk);
    await apiFetch("/api/marketplace/seller/video-upload/part",{
      method:"POST",body:JSON.stringify({uploadId:start.uploadId,partIndex:index,data:base64})
    });
    onProgress?.((index+1)/start.partCount);
  }
  const result=await apiFetch<UploadResult>("/api/marketplace/seller/video-upload/complete",{
    method:"POST",body:JSON.stringify({uploadId:start.uploadId})
  });
  return result.url;
}
