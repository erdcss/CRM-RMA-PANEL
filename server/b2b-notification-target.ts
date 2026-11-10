/**
 * Optional destination for a B2B customer notification.
 * Only pages of the official B2B storefront may be opened.
 * Store a canonical same-origin path, never user-supplied external URLs.
 */
export type NotificationTargetResult =
  | { ok: true; path: string | null }
  | { ok: false; error: string };

export function parseB2BNotificationTarget(input: unknown): NotificationTargetResult {
  if (input === undefined || input === null || input === "") return { ok:true, path:null };
  if (typeof input !== "string") return { ok:false,error:"Geçersiz bildirim bağlantısı" };
  const raw=input.trim();
  if (!raw) return { ok:true,path:null };
  if (raw.length>500 || /[\u0000-\u001f\u007f\\]/.test(raw)) {
    return {ok:false,error:"Bağlantı en fazla 500 karakter ve güvenli bir B2B adresi olmalı"};
  }
  if (!raw.startsWith("/") && !/^https:\/\//i.test(raw)) {
    return {ok:false,error:"Bağlantı /urun/... veya https://b2b.ecalisgan.com/... biçiminde olmalı"};
  }
  if (raw.startsWith("//")) return {ok:false,error:"Harici bağlantılara izin verilmez"};
  try {
    const url=new URL(raw,"https://b2b.ecalisgan.com");
    if (url.origin!=="https://b2b.ecalisgan.com" || url.username || url.password ||
        url.search || url.hash || /%(?:2f|5c|2e)/i.test(raw)) {
      return {ok:false,error:"Yalnızca Çalışkan B2B sitesindeki sayfa ve ürün bağlantıları kullanılabilir"};
    }
    // Disallow control, backslash or non-path URL tricks after parsing.
    const path=url.pathname;
    if (!path.startsWith("/") || path.startsWith("//") || path.length>450 ||
        /[\u0000-\u001f\u007f\\]/.test(path)) {
      return {ok:false,error:"Geçersiz sayfa yolu"};
    }
    return {ok:true,path};
  } catch {
    return {ok:false,error:"Geçerli bir B2B ürün veya sayfa bağlantısı girin"};
  }
}
