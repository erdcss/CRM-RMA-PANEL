import { supabase } from './supabase';

export async function uploadRmaPdf(ticketId: number, uri: string, fileName: string) {
  const { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session) {
    throw new Error('PDF arşivlemek için Supabase oturumu gerekli.');
  }

  const response = await fetch(uri);
  const bytes = await response.arrayBuffer();
  const path = `tickets/${ticketId}/${Date.now()}-${fileName}`;

  const { error: uploadError } = await supabase.storage
    .from('rma-pdfs')
    .upload(path, bytes, {
      contentType: 'application/pdf',
      upsert: false,
    });

  if (uploadError) throw uploadError;

  const { error: metadataError } = await supabase.from('rma_attachments').insert({
    ticket_id: ticketId,
    file_name: fileName,
    file_path: path,
    mime_type: 'application/pdf',
    size_bytes: bytes.byteLength,
    document_type: 'generated_pdf',
  });

  if (metadataError) {
    await supabase.storage.from('rma-pdfs').remove([path]);
    throw metadataError;
  }

  return path;
}
