import { Switch, Route, useLocation } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ThemeToggle } from "@/components/theme-toggle";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import Dashboard from "@/pages/dashboard";
import Kayitlar from "@/pages/kayitlar";
import Istatistikler from "@/pages/istatistikler";
import Musteriler from "@/pages/musteriler";
import Urunler from "@/pages/urunler";
import Ayarlar from "@/pages/ayarlar";
import KayitDetay from "@/pages/kayit-detay";
import LoginPage from "@/pages/login";
import SignupPage from "@/pages/kaydol";
import NotFound from "@/pages/not-found";
import { useEffect } from "react";

function AppRouter() {
  return (
    <Switch>
      <Route path="/" component={Dashboard} />
      <Route path="/kayitlar" component={Kayitlar} />
      <Route path="/kayit/:id" component={KayitDetay} />
      <Route path="/istatistikler" component={Istatistikler} />
      <Route path="/musteriler" component={Musteriler} />
      <Route path="/urunler" component={Urunler} />
      <Route path="/ayarlar" component={Ayarlar} />
      <Route component={NotFound} />
    </Switch>
  );
}

function MainShell() {
  const { user, signOut } = useAuth();
  const style = {
    "--sidebar-width": "16rem",
    "--sidebar-width-icon": "3rem",
  };

  return (
    <SidebarProvider style={style as React.CSSProperties}>
      <div className="flex h-screen w-full">
        <AppSidebar />
        <div className="flex flex-col flex-1 min-w-0">
          <header className="flex items-center justify-between p-4 border-b gap-4">
            <SidebarTrigger data-testid="button-sidebar-toggle" />
            <div className="flex items-center gap-3 ml-auto">
              <span className="text-sm text-muted-foreground hidden sm:inline">{user?.email}</span>
              <Button variant="outline" size="sm" onClick={() => signOut()}>
                Çıkış
              </Button>
              <ThemeToggle />
            </div>
          </header>
          <div className="flex-1 overflow-hidden">
            <AppRouter />
          </div>
        </div>
      </div>
    </SidebarProvider>
  );
}

function AuthLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center text-muted-foreground">
      Yükleniyor…
    </div>
  );
}

function AppGate() {
  const { session, loading } = useAuth();
  const [location, setLocation] = useLocation();

  const isAuthPage = location === "/login" || location === "/kaydol";

  useEffect(() => {
    if (loading) return;

    if (!session && !isAuthPage) {
      setLocation("/login");
      return;
    }

    if (session && isAuthPage) {
      setLocation("/");
    }
  }, [session, loading, isAuthPage, setLocation]);

  if (loading) {
    return <AuthLoading />;
  }

  if (!session && !isAuthPage) {
    return <AuthLoading />;
  }

  if (session && isAuthPage) {
    return <AuthLoading />;
  }

  if (!session) {
    return (
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/kaydol" component={SignupPage} />
        <Route component={LoginPage} />
      </Switch>
    );
  }

  return <MainShell />;
}

function App() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/service-worker.js").catch((error) => {
        console.error("Service Worker registration failed:", error);
      });
    }
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <AppGate />
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
