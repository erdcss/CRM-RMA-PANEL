import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { NotificationCenter } from "@/components/notification-center";
import Dashboard from "@/pages/dashboard";
import Kayitlar from "@/pages/kayitlar";
import Istatistikler from "@/pages/istatistikler";
import Musteriler from "@/pages/musteriler";
import Ayarlar from "@/pages/ayarlar";
import Depolar from "@/pages/depolar";
import Tedarikciler from "@/pages/tedarikciler";
import Faturalar from "@/pages/faturalar";
import KayitDetay from "@/pages/kayit-detay";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Yoneticiler from "@/pages/yoneticiler";
import YapayZeka from "@/pages/yapay-zeka";
import AdminProductAdd from "@/pages/admin-product-add";
import AdminProducts from "@/pages/admin-products";
import AdminProductAiImport from "@/pages/admin-product-ai-import";
import AdminProductEdit from "@/pages/admin-product-edit";
import AdminReturns from "@/pages/admin-returns";
import AdminStock from "@/pages/admin-stock";
import AdminOrders from "@/pages/admin-orders";
import AdminOrderDetail from "@/pages/admin-order-detail";
import AdminApplications from "@/pages/admin-applications";
import AdminHomepage from "@/pages/admin-homepage";
import AdminCategoryEdit from "@/pages/admin-category-edit";
import AdminPaymentSettingsPage from "@/pages/admin-payment-settings";
import AdminReels from "@/pages/admin-reels";
import AdminNotifications from "@/pages/admin-notifications";
import B2BStorefront from "@/pages/b2b-storefront";
import B2BProductPage from "@/pages/b2b-product";
import B2BLogin from "@/pages/b2b-login";
import B2BRegister from "@/pages/b2b-register";
import B2BAccount from "@/pages/b2b-account";
import B2BOrders from "@/pages/b2b-orders";
import B2BPaymentPage from "@/pages/b2b-payment";
import B2BSupport from "@/pages/b2b-support";
import B2BInfoPage from "@/pages/b2b-info";
import AdminMarketplace from "@/pages/admin-marketplace";
import MarketplaceSeller from "@/pages/marketplace-seller";
import MarketplaceSellerProduct from "@/pages/marketplace-seller-product";
import { MarketplaceDirectory, MarketplaceShop, MarketplaceBuyerInbox, MarketplaceProduct, MarketplaceReels } from "@/pages/marketplace-public";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useBranding } from "@/hooks/use-branding";
import { trackSession } from "@/lib/analytics";

function isMarketplaceHost() {
  const configuredMode = String((import.meta as any).env?.VITE_APP_MODE || "").toLowerCase();
  if (configuredMode === "marketplace") return true;
  if (configuredMode === "admin" || configuredMode === "b2b") return false;
  if (typeof window === "undefined") return false;
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "pazaryeri.ecalisgan.com" ||
    hostname.startsWith("pazaryeri-") && hostname.endsWith(".up.railway.app");
}

function isB2BHost() {
  const configuredMode = String((import.meta as any).env?.VITE_APP_MODE || "").toLowerCase();
  if (configuredMode === "b2b") return true;
  if (configuredMode === "admin") return false;
  if (typeof window === "undefined") return false;

  const hostname = window.location.hostname.toLowerCase();
  return (
    hostname === "b2b.ecalisgan.com" ||
    hostname.startsWith("caliskan-b2b-web-") ||
    hostname.includes("caliskan-b2b-web")
  );
}

function Router() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/pazaryeri" component={AdminMarketplace} />
      <Route path="/kayitlar" component={Kayitlar} />
      <Route path="/kayit/:id" component={KayitDetay} />
      <Route path="/istatistikler" component={Istatistikler} />
      <Route path="/musteriler" component={Musteriler} />
      <Route path="/depolar" component={Depolar} />
      <Route path="/tedarikciler" component={Tedarikciler} />
      <Route path="/faturalar" component={Faturalar} />
      <Route path="/ayarlar" component={Ayarlar} />
      <Route path="/yoneticiler" component={Yoneticiler} />
      <Route path="/yapay-zeka" component={YapayZeka} />
      <Route path="/urunler" component={AdminProducts} />
      <Route path="/urunler/ekle" component={AdminProductAdd} />
      <Route path="/urunler/ai-aktar" component={AdminProductAiImport} />
      <Route path="/urunler/:id" component={AdminProductEdit} />
      <Route path="/urun-ekle" component={AdminProductAdd} />
      <Route path="/iade-islemleri" component={AdminReturns} />
      <Route path="/stok-durumu" component={AdminStock} />
      <Route path="/siparisler/:id" component={AdminOrderDetail} />
      <Route path="/siparisler" component={AdminOrders} />
      <Route path="/basvurular" component={AdminApplications} />
      <Route path="/ana-sayfa/kategori/:category" component={AdminCategoryEdit} />
      <Route path="/ana-sayfa" component={AdminHomepage} />
      <Route path="/odeme-ekrani" component={AdminPaymentSettingsPage} />
      <Route path="/reelsler" component={AdminReels} />
      <Route path="/bildirimler" component={AdminNotifications} />
      <Route component={NotFound} />
    </Switch>
  );
}

function AppContent() {
  const { data: user, isLoading } = useQuery<{ id: number; username: string; role: string; appAccess: string; isActive: boolean } | null>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
    }
  }, []);

  return (
    <>
      {isLoading ? null : user && ["super_admin", "admin"].includes(user.role) ? (
          <SidebarProvider defaultOpen={true} style={style as React.CSSProperties}>
            <div className="flex h-dvh max-h-dvh w-full overflow-hidden">
              <AppSidebar username={user.username} role={user.role} />
              <div className="flex flex-col flex-1 min-w-0 min-h-0">
                <header className="flex items-center justify-between p-4 border-b shrink-0 pt-[max(1rem,env(safe-area-inset-top))]">
                  <SidebarTrigger className="md:hidden" data-testid="button-sidebar-toggle" />
                  <div className="flex items-center gap-2">
                    <NotificationCenter />
                    <ThemeToggle />
                  </div>
                </header>
                <div className="flex-1 min-h-0 overflow-hidden">
                  <Router />
                </div>
              </div>
            </div>
          </SidebarProvider>
        ) : (
          <Login />
        )}
      <Toaster />
    </>
  );
}

function MarketplaceDomainRedirect() {
  const destination = typeof window === "undefined"
    ? "https://pazaryeri.ecalisgan.com/"
    : "https://pazaryeri.ecalisgan.com" +
      (window.location.pathname === "/satici" || window.location.pathname === "/satici/" ? "/" : window.location.pathname) +
      window.location.search;
  useEffect(() => {
    window.location.replace(destination);
  }, [destination]);
  return <main className="flex min-h-screen items-center justify-center bg-[#f8f8f6] px-4 text-center text-slate-900">
    <div className="space-y-3">
      <h1 className="text-xl font-bold">Pazaryeri yeni adrese taşındı</h1>
      <p className="text-sm text-slate-600">Pazaryeri işlemleri artık ayrı platform üzerinden yapılıyor.</p>
      <a href={destination} className="inline-block rounded-xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white">Pazaryerine git</a>
    </div>
  </main>;
}

function B2BWebsite() {
  useEffect(() => {
    document.title = "Çalışkan B2B";
    void trackSession();
    const timer = window.setInterval(() => {
      void trackSession();
    }, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="b2b-site h-dvh min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain">
      <Switch>
        <Route path="/" component={B2BStorefront} />
        <Route path="/urun/:id" component={B2BProductPage} />
        <Route path="/magazalar" component={MarketplaceDirectory} />
        <Route path="/reels" component={MarketplaceReels} />
        <Route path="/magaza/:slug/urun/:productId">{(params) => <MarketplaceProduct slug={params.slug} productId={params.productId} />}</Route>
        <Route path="/magaza/:slug">{(params) => <MarketplaceShop slug={params.slug} />}</Route>
        <Route path="/satici/urun/:id" component={MarketplaceDomainRedirect} />
        <Route path="/satici" component={MarketplaceDomainRedirect} />
        <Route path="/mesajlarim" component={MarketplaceBuyerInbox} />
        <Route path="/pazaryeri-sepetim" component={B2BOrders} />
        <Route path="/uye-girisi" component={B2BLogin} />
        <Route path="/login" component={B2BLogin} />
        <Route path="/kayit-ol" component={B2BRegister} />
        <Route path="/hesabim" component={B2BAccount} />
        <Route path="/siparislerim" component={B2BOrders} />
        <Route path="/odeme" component={B2BPaymentPage} />
        <Route path="/destek" component={B2BSupport} />
        <Route path="/hakkimizda" component={B2BInfoPage} />
        <Route path="/iletisim" component={B2BInfoPage} />
        <Route path="/kampanyalar" component={B2BInfoPage} />
        <Route path="/akademi" component={B2BInfoPage} />
        <Route path="/support" component={B2BSupport} />
        <Route component={B2BStorefront} />
      </Switch>
    </div>
  );
}

function MarketplaceWebsite() {
  useEffect(() => {
    document.title = "Çalışkan B2B | Tedarikçi Paneli";
  }, []);
  return (
    <div className="b2b-site h-dvh min-h-0 overflow-x-hidden overflow-y-auto overscroll-y-contain">
      <Switch>
        <Route path="/" component={MarketplaceSeller} />
        <Route path="/satici" component={MarketplaceSeller} />
        <Route path="/satici/urun/:id">{(params) => <MarketplaceSellerProduct id={params.id} />}</Route>
        <Route path="/urun/:id" component={B2BProductPage} />
        <Route path="/magazalar" component={MarketplaceDirectory} />
        <Route path="/magaza/:slug/urun/:productId">{(params) => <MarketplaceProduct slug={params.slug} productId={params.productId} />}</Route>
        <Route path="/magaza/:slug">{(params) => <MarketplaceShop slug={params.slug} />}</Route>
        <Route path="/reels" component={MarketplaceReels} />
        <Route path="/mesajlarim" component={MarketplaceBuyerInbox} />
        <Route path="/pazaryeri-sepetim" component={B2BOrders} />
        <Route path="/uye-girisi" component={B2BLogin} />
        <Route path="/login" component={B2BLogin} />
        <Route path="/kayit-ol" component={B2BRegister} />
        <Route component={MarketplaceSeller} />
      </Switch>
    </div>
  );
}

function BrandingRuntime() {
  const { data: branding } = useBranding();

  useEffect(() => {
    const marketplace = isMarketplaceHost();
    const isB2B = isB2BHost() || marketplace;
    const appName = marketplace ? "Çalışkan B2B | Tedarikçi Paneli" : isB2B ? "Çalışkan B2B" : "Çalışkan Core";
    const iconEndpoint = `/api/public/branding-icon/${isB2B ? "b2b" : "admin"}?v=6`;
    const uploadedFavicon = isB2B ? branding?.b2b_favicon : branding?.admin_favicon;

    document.title = appName;

    const applicationName = document.querySelector<HTMLMetaElement>('meta[name="application-name"]');
    if (applicationName) applicationName.content = appName;

    const appleTitle = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-title"]');
    if (appleTitle) appleTitle.content = appName;

    let icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (!icon) {
      icon = document.createElement("link");
      icon.rel = "icon";
      document.head.appendChild(icon);
    }
    icon.href = uploadedFavicon || iconEndpoint;

    let appleIcon = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!appleIcon) {
      appleIcon = document.createElement("link");
      appleIcon.rel = "apple-touch-icon";
      document.head.appendChild(appleIcon);
    }
    appleIcon.href = uploadedFavicon || iconEndpoint;

    let manifest = document.querySelector<HTMLLinkElement>('link[rel="manifest"]');
    if (!manifest) {
      manifest = document.createElement("link");
      manifest.rel = "manifest";
      document.head.appendChild(manifest);
    }
    manifest.href = `/manifest.webmanifest?v=6&app=${isB2B ? "b2b" : "admin"}`;
  }, [branding?.admin_favicon, branding?.b2b_favicon]);

  return null;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <BrandingRuntime />
        {isMarketplaceHost() ? <MarketplaceWebsite /> : isB2BHost() ? <B2BWebsite /> : <AppContent />}
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
