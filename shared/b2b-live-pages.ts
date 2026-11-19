/** Public B2B storefront page buckets for anonymous and signed-in web sessions.
 * Never store full URLs, query strings, product IDs, names or account details. */
export const B2B_LIVE_PAGE_LABELS={
  home:"Ana Sayfa",
  products:"Ürün Detayları",
  categories:"Kategoriler",
  stores:"Mağazalar",
  store:"Mağaza Sayfaları",
  reels:"Reels",
  campaigns:"Kampanyalar",
  register:"Bayi Kayıt",
  login:"Bayi Girişi",
  account:"Hesabım",
  orders:"Siparişlerim",
  cart:"Sepet",
  payment:"Ödeme",
  messages:"Mesajlarım",
  support:"Destek",
  seller:"Satıcı Alanı",
  info:"Bilgilendirme",
  other:"Diğer Sayfalar",
} as const;
export type B2BLivePageKey=keyof typeof B2B_LIVE_PAGE_LABELS;
export function classifyB2BLivePage(raw:unknown):B2BLivePageKey|null{
  if(typeof raw!=="string"||!raw.startsWith("/")||raw.length>1024)return null;
  // Restrict the classifier to a pathname; reject rather than retain user-controlled URL data.
  const path=raw.split(/[?#]/,1)[0].replace(/\/+$/,"")||"/";
  if(path==="/")return "home";
  if(/^\/urun\/[^/]+$/i.test(path))return "products";
  if(path==="/kategoriler"||/^\/kategori\/[^/]+(?:\/alt\/[^/]+)?$/i.test(path))return "categories";
  if(path==="/magazalar")return "stores";
  if(/^\/magaza\/[^/]+(?:\/urun\/[^/]+)?$/i.test(path))return "store";
  if(path==="/reels")return "reels";
  if(path==="/kampanyalar")return "campaigns";
  if(path==="/kayit-ol")return "register";
  if(path==="/uye-girisi"||path==="/login")return "login";
  if(path==="/hesabim")return "account";
  if(path==="/siparislerim")return "orders";
  if(path==="/pazaryeri-sepetim")return "cart";
  if(path==="/odeme"||path.startsWith("/odeme/"))return "payment";
  if(path==="/mesajlarim")return "messages";
  if(path==="/destek"||path==="/support")return "support";
  if(path==="/satici"||path.startsWith("/satici/"))return "seller";
  if(["/hakkimizda","/iletisim","/akademi","/privacy","/gizlilik-politikasi","/kullanim-kosullari"].includes(path))return "info";
  return "other";
}
