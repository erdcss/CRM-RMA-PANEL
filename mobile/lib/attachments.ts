import * as FileSystem from 'expo-file-system/legacy';

import { supabase } from './supabase';

export type RmaAttachment = {
  id: number;
  ticket_id: number;
  product_id: number | null;
  file_name: string;
  file_path: string;
  mime_type: string | null;
  size_bytes: number | null;
  document_type: string;
  created_at: string;
};

function errorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message;
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === 'string' && message.trim()) return message;
  }
  return fallback;
}

function base64ToArrayBuffer(base64: string) {
  const binary = globalThis.atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
}

export async function persistLocalImage(localUri: string) {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) return localUri;
  try {
    const dest = `${cacheDir}rma-picked-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: localUri, to: dest });
    return dest;
  } catch (error) {
    throw new Error(`Görsel kaydedilemedi: ${errorMessage(error, 'galeriden tekrar deneyin')}`);
  }
}

async function readLocalImageBytes(localUri: string) {
  const cacheDir = FileSystem.cacheDirectory;
  if (!cacheDir) {
    throw new Error('Geçici dosya klasörü kullanılamıyor.');
  }

  let fileUri = localUri;
  try {
    const dest = `${cacheDir}rma-upload-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: localUri, to: dest });
    fileUri = dest;
  } catch {
    if (!localUri.startsWith('file://')) {
      throw new Error('Seçilen görsel uygulamaya kopyalanamadı. Galeriden tekrar deneyin.');
    }
  }

  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    if (!base64) {
      throw new Error('Görsel dosyası boş.');
    }
    return base64ToArrayBuffer(base64);
  } catch (error) {
    throw new Error(`Görsel okunamadı: ${errorMessage(error, 'bilinmeyen hata')}`);
  }
}

export async function listProductAttachments(ticketId: number, productId: number) {
  const { data, error } = await supabase
    .from('rma_attachments')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('product_id', productId)
    .eq('document_type', 'product_photo')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as RmaAttachment[];
}

export async function listTicketAttachments(ticketId: number) {
  const { data, error } = await supabase
    .from('rma_attachments')
    .select('*')
    .eq('ticket_id', ticketId)
    .eq('document_type', 'product_photo')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data ?? []) as RmaAttachment[];
}

export async function getAttachmentSignedUrl(filePath: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from('rma-attachments')
    .createSignedUrl(filePath, expiresIn);

  if (error) throw error;
  return data.signedUrl;
}

export async function uploadProductPhoto(
  ticketId: number,
  productId: number,
  localUri: string,
  fileName?: string,
) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error('Fotoğraf yüklemek için oturum gerekli.');
  }

  const bytes = await readLocalImageBytes(localUri);
  const safeName = (fileName ?? `photo-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `tickets/${ticketId}/products/${productId}/${Date.now()}-${safeName}`;
  const mimeType = 'image/jpeg';

  const { error: uploadError } = await supabase.storage
    .from('rma-attachments')
    .upload(path, bytes, { contentType: mimeType, upsert: false });

  if (uploadError) {
    throw new Error(errorMessage(uploadError, 'Görsel depolamaya yüklenemedi.'));
  }

  const { data, error: metadataError } = await supabase
    .from('rma_attachments')
    .insert({
      ticket_id: ticketId,
      product_id: productId,
      file_name: safeName,
      file_path: path,
      mime_type: mimeType,
      size_bytes: bytes.byteLength,
      document_type: 'product_photo',
    })
    .select('*')
    .single();

  if (metadataError) {
    await supabase.storage.from('rma-attachments').remove([path]);
    throw new Error(errorMessage(metadataError, 'Görsel kaydı oluşturulamadı.'));
  }

  return data as RmaAttachment;
}

export async function deleteAttachment(attachment: RmaAttachment) {
  await supabase.storage.from('rma-attachments').remove([attachment.file_path]);
  const { error } = await supabase.from('rma_attachments').delete().eq('id', attachment.id);
  if (error) throw error;
}
