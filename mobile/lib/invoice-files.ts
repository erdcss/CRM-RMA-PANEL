import * as FileSystem from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { API_BASE_URL } from './api';
import { localAuth } from './supabase';

/** Download a private PDF using the B2B bearer token, then offer the OS PDF
 * viewer / sharing sheet. Never leak access tokens in URLs or public links.
 */
export async function openB2BInvoice(invoiceId: number) {
  const { token } = await localAuth.getRequestCredentials();
  if (!token) throw new Error('Faturayı açmak için tekrar giriş yapın.');
  const response = await fetch(
    `${API_BASE_URL}/api/b2b/invoices/${encodeURIComponent(String(invoiceId))}/file`,
    { headers: { Authorization: `Bearer ${token}`, Accept: 'application/pdf' } },
  );
  if (!response.ok) throw new Error(response.status === 404
    ? 'Fatura PDF dosyası henüz yüklenmemiş.'
    : 'Fatura PDF dosyası alınamadı.');
  if (!(await Sharing.isAvailableAsync())) {
    throw new Error('Bu cihazda PDF görüntüleme veya paylaşma desteği bulunamadı.');
  }
  const content = new Uint8Array(await response.arrayBuffer());
  if (content.byteLength < 5 || content.byteLength > 5*1024*1024 ||
      String.fromCharCode(...content.slice(0,5)) !== '%PDF-') {
    throw new Error('Sunucudan geçerli bir PDF alınamadı.');
  }
  // Encode each multiple-of-three chunk separately to avoid giant spread calls.
  let base64 = '';
  for (let i = 0; i < content.byteLength; i += 12288) {
    const slice = content.subarray(i, i + 12288);
    let binary = '';
    for (let j = 0; j < slice.length; j++) binary += String.fromCharCode(slice[j]);
    base64 += globalThis.btoa(binary);
  }
  const target = `${FileSystem.cacheDirectory}b2b-fatura-${invoiceId}.pdf`;
  await FileSystem.writeAsStringAsync(target, base64, { encoding: FileSystem.EncodingType.Base64 });
  await Sharing.shareAsync(target, { mimeType: 'application/pdf', UTI: 'com.adobe.pdf', dialogTitle: 'Faturanızı Görüntüleyin' });
}
