import {
  LayoutDashboard, FileText, BarChart3, Users, Settings, Package, Truck, Box,
  ScanLine, LogOut, UserCog, Wrench, ChevronDown, ChevronRight, Bell,
  ShoppingCart, RotateCcw,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem, SidebarFooter,
} from "@/components/ui/sidebar";
import { Link, useLocation } from "wouter";
import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

const rmaItems = [
  { title: "RMA Dashboard", url: "/rma", icon: LayoutDashboard },
  { title: "Kayıtlar", url: "/kayitlar", icon: FileText },
  { title: "Tedarikçiler", url: "/tedarikciler", icon: Truck },
  { title: "Tedarikçiye Hazırlık", url: "/tedarikci-hazirlik", icon: Truck },
  { title: "Koliler", url: "/koliler", icon: Box },
  { title: "Barkod Tara", url: "/koli-tara", icon: ScanLine },
  { title: "RMA Ürünleri", url: "/urunler", icon: Package },
  { title: "İstatistikler", url: "/istatistikler", icon: BarChart3 },
];

const generalItems = [
  { title: "Satışlar", url: "/satislar", icon: ShoppingCart },
  { title: "Ürünler", url: "/b2b-urunler", icon: Package },
  { title: "İade İşlemleri", url: "/iadeler", icon: RotateCcw },
  { title: "Kullanıcılar", url: "/musteriler", icon: Users },
];

const systemItems = [
  { title: "Yönetici Hesapları", url: "/yoneticiler", icon: UserCog },
  { title: "Push Bildirim Yönetimi", url: "/push-bildirimler", icon: Bell },
  { title: "Ayarlar", url: "/ayarlar", icon: Settings },
];

export function AppSidebar() {
  const [location] = useLocation();
  const { signOut } = useAuth();
  const rmaActive = rmaItems.some((item) => location === item.url || location.startsWith(`${item.url}/`));
  const [rmaOpen, setRmaOpen] = useState(rmaActive);

  const renderItem = (item: { title:string; url:string; icon:any }) => {
    const isActive = location === item.url || location.startsWith(`${item.url}/`);
    return (
      <SidebarMenuItem key={item.title}>
        <SidebarMenuButton asChild isActive={isActive} data-testid={`link-${item.title.toLowerCase()}`}>
          <Link href={item.url}>
            <item.icon className="h-4 w-4" />
            <span>{item.title}</span>
          </Link>
        </SidebarMenuButton>
      </SidebarMenuItem>
    );
  };

  return (
    <Sidebar>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel className="text-lg font-bold flex items-center gap-2 mb-3">
            <img src="/api/app-branding/admin/logo" alt="" className="h-8 w-8 object-contain" onError={(e) => { e.currentTarget.src = "/logo.png"; }} />
            Çalışkan B2B
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>{renderItem({ title:"Dashboard", url:"/", icon:LayoutDashboard })}</SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Genel</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>{generalItems.map(renderItem)}</SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Operasyon</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton type="button" isActive={rmaActive} onClick={() => setRmaOpen((v) => !v)}>
                  <Wrench className="h-4 w-4" />
                  <span className="flex-1">RMA</span>
                  {rmaOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </SidebarMenuButton>
              </SidebarMenuItem>
              {rmaOpen && <div className="ml-3 border-l border-sidebar-border pl-2 space-y-0.5">{rmaItems.map(renderItem)}</div>}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Sistem</SidebarGroupLabel>
          <SidebarGroupContent><SidebarMenu>{systemItems.map(renderItem)}</SidebarMenu></SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        <button type="button" onClick={() => signOut()} className="flex w-full items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <LogOut className="h-4 w-4" /> Çıkış Yap
        </button>
        <div className="flex items-center justify-center"><span className="text-xs text-muted-foreground">Çalışkan Yönetim Paneli v1.0</span></div>
      </SidebarFooter>
    </Sidebar>
  );
}
