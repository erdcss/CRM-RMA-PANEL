import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from './api';
import { localAuth } from './supabase';

/**
 * Private support files are streamed with the owner's bearer token.
 * Never place credentials into URLs or make these attachments public.
 */
export async function openB2BSupportFile(ticketId:number,fileId:number,fileName:string,mimeType:string) {
  if(!Number.isSafeInteger(ticketId)||!Number.isSafeInteger(fileId))throw new Error('Geçersiz dosya');
  const {token}=await localAuth.getRequestCredentials();
  if(!token)throw new Error('Dosyayı açmak için giriş yapın.');
  const result=await fetch(
    `${API_BASE_URL}/api/b2b/support/${ticketId}/attachments/${fileId}`,
    {headers:{Authorization:`Bearer ${token}`}},
  );
  if(!result.ok)throw new Error('Dosyaya erişilemedi. Talep kapanmış olabilir.');
  const bytes=new Uint8Array(await result.arrayBuffer());
  if(bytes.byteLength<1||bytes.byteLength>5*1024*1024)throw new Error('Dosya boyutu geçersiz.');
  if(!await Sharing.isAvailableAsync())throw new Error('Bu cihazda dosya paylaşımı kullanılamıyor.');
  const safeName=(fileName||'destek-dosyasi').replace(/[^a-zA-Z0-9._-]/g,'_').slice(0,100);
  let base64='';
  for(let i=0;i<bytes.length;i+=12288){
    const part=bytes.subarray(i,i+12288);
    let binary='';
    for(let j=0;j<part.length;j++)binary+=String.fromCharCode(part[j]);
    base64+=globalThis.btoa(binary);
  }
  const file=`${FileSystem.cacheDirectory}b2b-${ticketId}-${fileId}-${safeName}`;
  await FileSystem.writeAsStringAsync(file,base64,{encoding:FileSystem.EncodingType.Base64});
  await Sharing.shareAsync(file,{mimeType:mimeType||'application/octet-stream',
    dialogTitle:'Destek dosyasını aç veya paylaş'});
}
