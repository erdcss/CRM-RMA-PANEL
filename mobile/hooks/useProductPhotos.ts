import { useCallback, useEffect, useState } from 'react';

import {
  getAttachmentSignedUrl,
  listTicketAttachments,
  type RmaAttachment,
} from '@/lib/attachments';

export function useTicketProductPhotos(ticketId: number) {
  const [attachments, setAttachments] = useState<RmaAttachment[]>([]);
  const [urls, setUrls] = useState<Record<number, string>>({});
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!Number.isFinite(ticketId)) return;
    try {
      setLoading(true);
      const rows = await listTicketAttachments(ticketId);
      setAttachments(rows);

      const nextUrls: Record<number, string> = {};
      await Promise.all(
        rows.map(async (row) => {
          if (!row.product_id) return;
          try {
            nextUrls[row.product_id] = await getAttachmentSignedUrl(row.file_path);
          } catch {
            // ignore individual url failures
          }
        }),
      );
      setUrls(nextUrls);
    } finally {
      setLoading(false);
    }
  }, [ticketId]);

  useEffect(() => {
    load();
  }, [load]);

  const getProductPhotoUrl = (productId: number) => urls[productId] ?? null;

  const setProductPhotoUrl = (productId: number, url: string) => {
    setUrls((prev) => ({ ...prev, [productId]: url }));
  };

  return {
    attachments,
    loading,
    reload: load,
    getProductPhotoUrl,
    setProductPhotoUrl,
  };
}
