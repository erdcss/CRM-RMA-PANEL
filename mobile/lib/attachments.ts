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

  const response = await fetch(localUri);
  const bytes = await response.arrayBuffer();
  const safeName = (fileName ?? `photo-${Date.now()}.jpg`).replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `tickets/${ticketId}/products/${productId}/${Date.now()}-${safeName}`;
  const mimeType = safeName.endsWith('.png') ? 'image/png' : 'image/jpeg';

  const { error: uploadError } = await supabase.storage
    .from('rma-attachments')
    .upload(path, bytes, { contentType: mimeType, upsert: false });

  if (uploadError) throw uploadError;

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
    throw metadataError;
  }

  return data as RmaAttachment;
}

export async function deleteAttachment(attachment: RmaAttachment) {
  await supabase.storage.from('rma-attachments').remove([attachment.file_path]);
  const { error } = await supabase.from('rma_attachments').delete().eq('id', attachment.id);
  if (error) throw error;
}
