import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useQuery } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { LogIn, PackageSearch, UserRound, Menu, X, ChevronRight } from "lucide-react";
import { footerGroups, B2BSocialAndStores, B2BMobileDownloadHeader } from "@/components/b2b-footer";

import { Button } from "@/components/ui/button";
import { useBranding } from "@/hooks/use-branding";
import { useB2BCart } from "@/lib/b2b-cart";

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
  return logo ? (
    <img
      src={logo}
      alt="Çalışkan B2B"
      className="h-9 w-auto max-w-[150px] object-contain object-left sm:h-10 sm:max-w-[175px]"
    />
  ) : (
    <span className="text-sm font-black tracking-tight text-slate-950 sm:text-base">
      ÇALIŞKAN <span className="text-[10px] align-top">B2B</span>
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

  return (
    <>
    <header className="sticky top-0 z-40 border-b bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-[60px] max-w-6xl items-center gap-3 px-4">
        <button type="button" onClick={()=>setDrawerOpen(true)} aria-label="Menüyü aç" aria-expanded={drawerOpen} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-[#111] transition hover:bg-[#fff1ae] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ffcc00] md:hidden"><Menu className="h-6 w-6"/></button>
        <Link href="/" className="flex shrink-0 items-center">
          <B2BWebLogo logo={branding?.b2b_logo} />
        </Link>

        {middle ? <div className="mx-auto hidden w-full max-w-xl md:block">{middle}</div> : <div className="flex-1" />}

        {loggedIn ? (
          <div className="ml-auto flex shrink-0 items-center gap-2">
            <Button
              asChild
              variant="ghost"
              className="border border-slate-200 bg-slate-100 px-2 text-slate-800 hover:bg-slate-200 sm:px-4"
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
            <Button asChild className="bg-slate-950 px-2 hover:bg-slate-800 sm:px-4">
              <Link href="/hesabim" aria-label="Hesabım">
                <UserRound className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Hesabım</span>
              </Link>
            </Button>
          </div>
        ) : (
          <Button asChild className="ml-auto shrink-0 bg-slate-950 hover:bg-slate-800">
            <Link href="/uye-girisi">
              <LogIn className="mr-2 h-4 w-4" />
              Giriş Yap
            </Link>
          </Button>
        )}
      </div>
      <B2BMobileDownloadHeader />
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
