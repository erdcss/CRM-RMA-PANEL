import type { Express } from 'express';
import { requireAdmin } from './auth';

export function registerProductAIRoutes(app: Express) {
  app.post('/api/product-ai/extract', async (req, res) => {
    if (!requireAdmin(req)) return res.status(403).json({ error: 'Yönetici yetkisi gerekli' });
    return res.status(501).json({ error: 'AI sağlayıcısı yapılandırılmadı' });
  });
  app.post('/api/product-ai/prepare-image', async (req, res) => {
    if (!requireAdmin(req)) return res.status(403).json({ error: 'Yönetici yetkisi gerekli' });
    const { dataUrl } = req.body || {};
    if (!dataUrl) return res.status(400).json({ error: 'Görsel gerekli' });
    return res.json({ source: dataUrl, status: 'preview' });
  });
}
