import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import {getBusinessToken} from './auth';

const API=(process.env.EXPO_PUBLIC_API_URL||'https://admin.ecalisgan.com').replace(/\/$/,'');

export async function openBusinessSupportFile(ticketId:number,fileId:number,fileName:string,mimeType:string){
  const token=getBusinessToken();
  if(!token)throw new Error('Oturum bulunamadı.');
  if(!Number.isSafeInteger(ticketId)||!Number.isSafeInteger(fileId))throw new Error('Geçersiz dosya');
  const response=await fetch(
    `${API}/api/admin/b2b-support/${ticketId}/attachments/${fileId}`,
    {headers:{Authorization:`Bearer ${token}`}},
  );
  if(!response.ok)throw new Error('Dosya alınamadı veya erişim izniniz bulunmuyor.');
  const bytes=new Uint8Array(await response.arrayBuffer());
  if(!bytes.length||bytes.length>5*1024*1024)throw new Error('Dosya boyutu geçersiz.');
  if(!await Sharing.isAvailableAsync())throw new Error('Dosya görüntüleme bu cihazda desteklenmiyor.');
  let base64='';
  for(let i=0;i<bytes.length;i+=12288){
    const chunk=bytes.subarray(i,i+12288);
    let binary='';
    for(let j=0;j<chunk.length;j++)binary+=String.fromCharCode(chunk[j]);
    base64+=globalThis.btoa(binary);
  }
  const safe=(fileName||'destek').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100);
  const path=`${FileSystem.cacheDirectory}destek-${ticketId}-${fileId}-${safe}`;
  await FileSystem.writeAsStringAsync(path,base64,{encoding:FileSystem.EncodingType.Base64});
  await Sharing.shareAsync(path,{mimeType,dialogTitle:'Destek dosyasını aç veya paylaş'});
}
