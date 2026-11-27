import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { LogIn, UserPlus, PackageSearch, UserRound, Menu, X, ChevronRight, ShoppingCart, Tags, Flame, Boxes, Store, Star } from "lucide-react";
import { footerGroups, B2BSocialAndStores } from "@/components/b2b-footer";

import { Button } from "@/components/ui/button";
import { useBranding } from "@/hooks/use-branding";
import { useB2BCart } from "@/lib/b2b-cart";
import { trackCustomerUsageSession } from "@/lib/analytics";

type SessionUser = {
  id: number;
  username: string;
  role: string;
  appAccess: string;
  isActive: boolean;
  mustChangePassword?: boolean;
  email?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  companyName?: string | null;
};

async function loadSession(): Promise<SessionUser | null> {
  const response = await fetch("/api/auth/me", { credentials: "include" });
  if (response.status === 401) return null;
  if (!response.ok) return null;
  return response.json();
}

/** The mobile drawer and the public site's navigation share the exact same branding asset. */
function B2BWebLogo({ logo }: { logo?: string | null }) {
  const [failed, setFailed] = useState<string[]>([]);
  // Start with the real asset endpoint so the textual placeholder is not flashed
  // during an asynchronous branding request on every page refresh.
  const sources = Array.from(new Set([
    logo,
    "/api/public/branding-asset/b2b_logo",
    "/api/public/branding-asset/b2b_mobile_logo",
  ].filter((value): value is string => Boolean(value))));
  const source = sources.find(value => !failed.includes(value));

  return source ? (
    <img
      src={source}
      onError={() => setFailed(prev => [...prev, source])}
      alt="Çalışkan B2B"
      loading="eager"
      className="h-9 w-auto max-w-full object-contain object-left lg:h-11"
    />
  ) : (
    <span className="block whitespace-nowrap text-xs font-black tracking-tight text-slate-950 sm:text-base">
      ÇALIŞKAN B2B
    </span>
  );
}

export function B2BHeader({ middle }: { middle?: ReactNode }) {
  const [drawerOpen,setDrawerOpen] = useState(false);
  const [location] = useLocation();

  useEffect(() => {
    setDrawerOpen(false);
  }, [location]);

  useEffect(() => {
    if (!drawerOpen) return;

    // The B2B document uses a dedicated .b2b-site scroll container.
    // Lock that container rather than the (already non-scrolling) body.
    const scroller = document.querySelector<HTMLElement>(".b2b-site");
    const previousOverflow = scroller?.style.overflowY ?? "";
    const previousOverscroll = scroller?.style.overscrollBehaviorY ?? "";
    if (scroller) {
      scroller.style.overflowY = "hidden";
      scroller.style.overscrollBehaviorY = "none";
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (scroller) {
        scroller.style.overflowY = previousOverflow;
        scroller.style.overscrollBehaviorY = previousOverscroll;
      }
    };
  }, [drawerOpen]);
  const { data: branding } = useBranding();
  const { itemCount } = useB2BCart();
  const { data: session } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: loadSession,
    retry: false,
    staleTime: 15_000,
  });

  const loggedIn =
    session?.role === "b2b_customer" &&
    session?.isActive === true;

  useEffect(() => {
    if (loggedIn) trackCustomerUsageSession();
  }, [loggedIn]);

  return (
    <>
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[64px] w-full min-w-0 max-w-[1600px] items-center gap-1.5 px-2 sm:gap-3 sm:px-5 lg:h-[76px] xl:px-6">
        <button type="button" onClick={()=>setDrawerOpen(true)} aria-label="Menüyü aç" aria-expanded={drawerOpen} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#111] transition hover:bg-[#fff1ae] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffcc00] md:hidden"><Menu className="h-6 w-6"/></button>
        <Link href="/" className="flex min-w-0 flex-1 items-center overflow-hidden sm:flex-none">
          <span className="block min-w-0 max-w-[124px] sm:max-w-none"><B2BWebLogo logo={branding?.b2b_logo} /></span>
        </Link>

        {middle ? <div className="mx-auto hidden w-full max-w-2xl md:block">{middle}</div> : <div className="hidden flex-1 sm:block" />}

        <Link href="/siparislerim" aria-label={itemCount ? `Sepet, ${itemCount} koli` : "Sepet"} className="relative ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 text-slate-950 transition hover:border-amber-400 hover:bg-amber-50 sm:w-auto sm:gap-2 sm:px-3">
          <ShoppingCart className="h-5 w-5" /><span className="hidden text-sm font-bold lg:inline">Sepet</span>
          {itemCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#ffcc00] px-1 text-[10px] font-black text-[#0b192d] sm:static">{itemCount > 99 ? "99+" : itemCount}</span>}
        </Link>
        {loggedIn ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="h-9 w-9 border border-slate-200 bg-slate-100 px-0 text-slate-800 hover:bg-slate-200 sm:w-auto sm:px-4"
            >
              <Link href="/siparislerim" aria-label="Siparişler" className="relative">
                <PackageSearch className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Siparişler</span>
                {itemCount > 0 ? (
                  <span className="ml-1 inline-flex min-w-5 items-center justify-center rounded-full bg-white px-1.5 text-[10px] font-bold text-slate-950">
                    {itemCount > 99 ? "99+" : itemCount}
                  </span>
                ) : null}
              </Link>
            </Button>
            <Button asChild className="h-9 w-9 bg-slate-950 px-0 hover:bg-slate-800 sm:w-auto sm:px-4">
              <Link href="/hesabim" aria-label="Hesabım">
                <UserRound className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Hesabım</span>
              </Link>
            </Button>
          </div>
        ) : (
          <div className="ml-auto flex shrink-0 items-center gap-1 sm:gap-2">
            <Button asChild className="h-9 w-9 shrink-0 bg-slate-950 px-0 text-[11px] font-bold hover:bg-slate-800 sm:w-auto sm:px-4 sm:text-sm">
              <Link href="/uye-girisi" aria-label="Bayi Girişi">
                <LogIn className="h-4 w-4 sm:mr-2" />
                <span className="sr-only sm:not-sr-only">Bayi Girişi</span>
              </Link>
            </Button>
            <Button asChild className="h-9 w-9 shrink-0 bg-[#ffcc00] px-0 text-[11px] font-bold text-slate-950 hover:bg-[#f3c000] sm:w-auto sm:px-4 sm:text-sm">
              <Link href="/kayit-ol" aria-label="Kayıt Ol">
                <UserPlus className="h-4 w-4 sm:mr-2" />
                <span className="sr-only sm:not-sr-only">Kayıt Ol</span>
              </Link>
            </Button>
          </div>
        )}
      </div>
      {middle ? <div className="mx-auto w-full max-w-[1600px] px-3 pb-3 md:hidden">{middle}</div> : null}
      <nav aria-label="Masaüstü mağaza menüsü" className="hidden border-t border-white/10 bg-[#0b192d] text-white md:block">
        <div className="mx-auto flex h-12 max-w-[1600px] items-center justify-between gap-3 px-5 xl:px-6">
          <Link href="/kategoriler" className="flex items-center gap-2 text-xs font-semibold hover:text-[#ffcc00] lg:text-sm"><Boxes className="h-4 w-4 text-[#ffcc00]" /> Tüm Kategoriler</Link>
          <Link href="/kampanyalar" className="flex items-center gap-2 text-xs font-semibold hover:text-[#ffcc00] lg:text-sm"><Tags className="h-4 w-4 text-[#ffcc00]" /> Kampanyalar</Link>
          <a href="/#yeni-gelenler" className="flex items-center gap-2 text-xs font-semibold hover:text-[#ffcc00] lg:text-sm"><Star className="h-4 w-4 text-[#ffcc00]" /> Yeni Ürünler</a>
          <a href="/#urunler" className="flex items-center gap-2 text-xs font-semibold hover:text-[#ffcc00] lg:text-sm"><Flame className="h-4 w-4 text-[#ffcc00]" /> Toptan Ürünler</a>
          <Link href="/magazalar" className="flex items-center gap-2 text-xs font-semibold hover:text-[#ffcc00] lg:text-sm"><Store className="h-4 w-4 text-[#ffcc00]" /> Tedarikçiler</Link>
          <Link href="/siparislerim" className="text-xs font-semibold hover:text-[#ffcc00] lg:text-sm">Sipariş Listem</Link>
        </div>
      </nav>
    </header>
    {typeof document !== "undefined" ? createPortal(
      <div
        className={`fixed inset-0 z-[100] h-[100dvh] transition-all duration-300 md:hidden ${drawerOpen ? "pointer-events-auto visible" : "pointer-events-none invisible"}`}
        aria-hidden={!drawerOpen}
        data-pull-refresh-ignore
      >
        <button
          type="button"
          aria-label="Menüyü kapat"
          className={`absolute inset-0 h-full w-full touch-none bg-black/60 transition-opacity duration-300 ${drawerOpen ? "opacity-100" : "opacity-0"}`}
          onClick={() => setDrawerOpen(false)}
        />
        <aside
          role="dialog"
          aria-modal="true"
          aria-label="Çalışkan B2B menüsü"
          className={`absolute inset-y-0 left-0 flex w-[min(88vw,360px)] flex-col overflow-hidden bg-white shadow-2xl transition-transform duration-300 ${drawerOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex min-h-16 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
            <Link href="/" onClick={() => setDrawerOpen(false)} className="flex min-w-0 items-center">
              <B2BWebLogo logo={branding?.b2b_logo} />
            </Link>
            <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-slate-900" onClick={() => setDrawerOpen(false)} aria-label="Kapat"><X className="h-6 w-6"/></button>
          </div>
          <nav className="min-h-0 flex-1 overflow-y-auto overscroll-y-contain px-4 py-4 [-webkit-overflow-scrolling:touch]">
            <Link href="/" onClick={()=>setDrawerOpen(false)} className="flex min-h-12 items-center justify-between border-b border-slate-100 font-bold">Ana Sayfa<ChevronRight className="h-4 w-4"/></Link>
            <Link href="/kategoriler" onClick={()=>setDrawerOpen(false)} className="flex min-h-12 items-center justify-between border-b border-slate-100 font-bold">Kategoriler<ChevronRight className="h-4 w-4"/></Link>
            {loggedIn ? <Link href="/siparislerim" onClick={()=>setDrawerOpen(false)} className="flex min-h-12 items-center justify-between border-b border-slate-100 font-bold">Siparişlerim<ChevronRight className="h-4 w-4"/></Link> : null}
            {!loggedIn && <>
              <Link href="/uye-girisi" onClick={()=>setDrawerOpen(false)} className="flex min-h-12 items-center justify-between border-b border-slate-100 font-bold">Bayi Girişi<ChevronRight className="h-4 w-4"/></Link>
              <Link href="/kayit-ol" onClick={()=>setDrawerOpen(false)} className="flex min-h-12 items-center justify-between border-b border-slate-100 font-bold">Kayıt Ol<ChevronRight className="h-4 w-4"/></Link>
            </>}
            {footerGroups.map(group=><div key={group.title} className="border-b border-slate-100 py-3"><h3 className="mb-2 text-sm font-black text-slate-950">{group.title}</h3>{group.links.map(([label,href])=>href.startsWith("https://")?
              <a key={label} href={href} onClick={()=>setDrawerOpen(false)} className="block py-2 pl-3 text-sm text-slate-600 hover:text-yellow-700">{label}</a>:
              <Link key={label} href={href} onClick={()=>setDrawerOpen(false)} className="block py-2 pl-3 text-sm text-slate-600 hover:text-yellow-700">{label}</Link>)}</div>)}
          </nav>
          <div className="shrink-0 bg-[#111] p-5 text-white"><B2BSocialAndStores compact/></div>
        </aside>
      </div>,
      document.body,
    ) : null}
    </>
  );
}
