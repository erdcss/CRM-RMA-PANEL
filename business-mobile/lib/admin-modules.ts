export type AdminModule = {
  slug: string;
  title: string;
  description: string;
  endpoint?: string;
  route?: string;
};

export type AdminModuleGroup = {
  title: string;
  items: AdminModule[];
};

export const ADMIN_MODULE_GROUPS: AdminModuleGroup[] = [
  {
    title: "Yönetim",
    items: [
      { slug: "dashboard", title: "Dashboard", description: "Canlı operasyon ve yönetim özeti.", route: "/dashboard" },
      { slug: "ana-sayfa", title: "Ana Sayfa", description: "Web ana sayfası içerik yönetimi." },
      { slug: "basvurular", title: "Başvurular", description: "B2B başvuru ve onay süreçleri.", endpoint: "/api/admin/b2b-applications" },
      { slug: "odeme-ekrani", title: "Ödeme Ekranı", description: "Ödeme ayarları ve yönetimi." },
      { slug: "reelsler", title: "Reelsler", description: "Reels içerik yönetimi." },
      { slug: "yapay-zeka", title: "Yapay Zeka", description: "Yönetim asistanı ve AI araçları." },
      { slug: "ayarlar", title: "Ayarlar", description: "Sistem, marka ve mobil uygulama ayarları." },
      { slug: "yoneticiler", title: "Yöneticiler", description: "Yönetici hesapları ve yetkiler." },
    ],
  },
  {
    title: "RMA",
    items: [
      { slug: "kayitlar", title: "Kayıtlar", description: "RMA kayıtları ve işlem akışı.", endpoint: "/api/tickets" },
      { slug: "istatistikler", title: "İstatistikler", description: "RMA istatistikleri.", endpoint: "/api/stats" },
      { slug: "musteriler", title: "Müşteriler", description: "Müşteri kayıtları.", endpoint: "/api/customers" },
      { slug: "depolar", title: "Depolar", description: "Depo kayıtları ve yönetimi.", endpoint: "/api/warehouses" },
      { slug: "tedarikciler", title: "Tedarikçiler", description: "Tedarikçi yönetimi.", endpoint: "/api/suppliers" },
      { slug: "faturalar", title: "Faturalar", description: "Fatura kayıtları.", endpoint: "/api/invoices" },
    ],
  },
  {
    title: "Operasyon",
    items: [
      { slug: "urunler", title: "Ürünler", description: "B2B ürün yönetimi.", endpoint: "/api/admin/b2b-products" },
      { slug: "urun-ekle", title: "Ürün Ekle", description: "Manuel ürün oluşturma ekranı." },
      { slug: "urun-ai-aktar", title: "AI ile Ürün Aktar", description: "PDF, görsel ve liste üzerinden AI ürün aktarımı." },
      { slug: "iade-islemleri", title: "İade İşlemleri", description: "İade ve onay süreçleri.", endpoint: "/api/admin/returns" },
      { slug: "stok-durumu", title: "Stok Durumu", description: "Ürün ve stok takibi.", endpoint: "/api/admin/b2b-products" },
      { slug: "siparisler", title: "Siparişler", description: "B2B sipariş yönetimi.", endpoint: "/api/admin/orders" },
    ],
  },
];

export const ADMIN_MODULES = ADMIN_MODULE_GROUPS.flatMap((group) => group.items);

export function getAdminModule(slug?: string | string[]) {
  const normalized = Array.isArray(slug) ? slug[0] : slug;
  return ADMIN_MODULES.find((item) => item.slug === normalized);
}
